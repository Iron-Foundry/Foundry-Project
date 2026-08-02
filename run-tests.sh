#!/usr/bin/env bash
# One-command test runner for the monorepo.
#
#   ./run-tests.sh lint          ruff + pyright per Python module, tsc for web-app
#   ./run-tests.sh fast          fast suites only (no Docker): api + discord + cache + web
#   ./run-tests.sh integration   real-infra suites (Docker): api + discord testcontainers
#   ./run-tests.sh e2e           full stack E2E (Docker compose): playwright + discord_e2e
#   ./run-tests.sh all           everything (default)
#
# Steps within a lane run in parallel, capped by JOBS (default: CPU count).
# Each step's output is buffered and printed whole when it finishes, so logs
# never interleave; SERIAL=1 runs one step at a time with live output instead.
#
# The integration lane starts ONE Postgres + Valkey pair and points every module
# at it (TEST_DATABASE_URL / TEST_VALKEY_URI); each suite and each xdist worker
# carves out its own database. PYTEST_WORKERS overrides the xdist worker count.
#
# E2E auto-detects free host ports: it uses 3000/8000/5432 when free, otherwise
# 13000/18000/55432 (so it never fights a running dev stack), and always tears
# the stack down on exit.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export ROOT
COMPOSE="$ROOT/integration/docker-compose.e2e.yml"
FAILURES=0

JOBS="${JOBS:-$(nproc 2>/dev/null || echo 4)}"
SERIAL="${SERIAL:-0}"

c_green() { printf '\033[32m%s\033[0m\n' "$1"; }
c_red()   { printf '\033[31m%s\033[0m\n' "$1"; }
header()  { printf '\n\033[1m== %s ==\033[0m\n' "$1"; }

# Resolve uv/bun across Git Bash and WSL. A non-login shell may not have them on
# PATH; under WSL the tools are Windows installs reached via interop (uv.exe /
# bun.exe), so add both the native home bins and the Windows %USERPROFILE% bins.
_win_home=""
if command -v wslpath >/dev/null 2>&1; then
  _up="$(cmd.exe /c 'echo %USERPROFILE%' 2>/dev/null | tr -d '\r\n')"
  [ -n "$_up" ] && _win_home="$(wslpath -u "$_up" 2>/dev/null)"
elif command -v cygpath >/dev/null 2>&1 && [ -n "${USERPROFILE:-}" ]; then
  _win_home="$(cygpath -u "$USERPROFILE")"
fi
for _base in "${HOME:-}" "$_win_home"; do
  [ -n "$_base" ] || continue
  for _sub in .local/bin .bun/bin .cargo/bin; do
    _d="$_base/$_sub"
    [ -d "$_d" ] && case ":$PATH:" in *":$_d:"*) ;; *) PATH="$_d:$PATH" ;; esac
  done
done
export PATH

# UV/BUN resolve to a native binary or, under WSL, the Windows .exe via interop.
_resolve() { command -v "$1" 2>/dev/null || command -v "$1.exe" 2>/dev/null; }
UV="$(_resolve uv)"; BUN="$(_resolve bun)"
export UV BUN

if [ -z "$UV" ] && [ -z "$BUN" ]; then
  c_red "Neither uv nor bun found (searched \$HOME and ${_win_home:-<no windows home>})."
  c_red "Install them, or run from a shell where they resolve."
fi

# ----- step scheduler ----------------------------------------------------------
# spawn queues a step; reap_all waits for the queue in submission order, so the
# printed output is deterministic no matter which step finishes first.

_pids=(); _names=(); _logs=(); _starts=(); _head=0
_summary=()

_record() {
  # _record <name> <rc> <seconds>
  if [ "$2" -eq 0 ]; then
    c_green "PASS: $1 (${3}s)"
    _summary+=("$(printf '  %-52s PASS %5ss' "$1" "$3")")
  else
    c_red "FAIL: $1 (${3}s)"
    _summary+=("$(printf '  %-52s FAIL %5ss' "$1" "$3")")
    FAILURES=$((FAILURES + 1))
  fi
}

step() {
  # step "<name>" <cmd...> - run now, in the foreground, with live output.
  local name="$1"; shift
  local start rc=0
  start="$(date +%s)"
  header "$name"
  "$@" || rc=$?
  _record "$name" "$rc" "$(( $(date +%s) - start ))"
}

_reap_head() {
  local i="$_head" rc=0
  [ "$i" -lt "${#_pids[@]}" ] || return 0
  wait "${_pids[$i]}" || rc=$?
  header "${_names[$i]}"
  cat "${_logs[$i]}"
  rm -f "${_logs[$i]}"
  _record "${_names[$i]}" "$rc" "$(( $(date +%s) - ${_starts[$i]} ))"
  _head=$((_head + 1))
}

spawn() {
  # spawn "<name>" <cmd...> - queue a step to run alongside its siblings.
  local name="$1"; shift
  if [ "$SERIAL" = "1" ]; then
    step "$name" "$@"
    return
  fi
  while [ $(( ${#_pids[@]} - _head )) -ge "$JOBS" ]; do _reap_head; done
  local log; log="$(mktemp)"
  "$@" >"$log" 2>&1 &
  _pids+=("$!"); _names+=("$name"); _logs+=("$log"); _starts+=("$(date +%s)")
}

reap_all() {
  while [ "$_head" -lt "${#_pids[@]}" ]; do _reap_head; done
}

have_docker() { docker info >/dev/null 2>&1; }

port_busy() { (echo >"/dev/tcp/127.0.0.1/$1") >/dev/null 2>&1; }

require_docker() {
  if ! have_docker; then
    c_red "Docker is not available - skipping '$1'."
    return 1
  fi
}

# ----- fast suites -------------------------------------------------------------

run_fast() {
  spawn "api-backend (fast)"        bash -c 'cd "$ROOT/api-backend" && "$UV" run pytest -q -p no:cacheprovider'
  spawn "discord-server (fast)"     bash -c 'cd "$ROOT/discord-server" && "$UV" run pytest -q -p no:cacheprovider'
  spawn "discord-utils (fast)"      bash -c 'cd "$ROOT/discord-utils" && "$UV" run pytest -q -p no:cacheprovider'
  spawn "osrs-cache-service (fast)" bash -c 'cd "$ROOT/osrs-cache-service" && "$UV" run pytest -q -p no:cacheprovider'
  spawn "web-app (unit)"            bash -c 'cd "$ROOT/web-app" && "$BUN" test tests/'
  reap_all
}

# ----- lint + typecheck --------------------------------------------------------

# discord-event has no pytest suite yet, so it appears here (lint + types) but
# not in run_fast.
_PY_MODULES="api-backend discord-server discord-utils discord-event osrs-cache-service"

run_lint() {
  for module in $_PY_MODULES; do
    [ -d "$ROOT/$module" ] || continue
    spawn "$module (ruff)" bash -c \
      'cd "$ROOT/'"$module"'" && "$UV" run ruff check . && "$UV" run ruff format --check .'
    spawn "$module (pyright)" bash -c \
      'cd "$ROOT/'"$module"'" && "$UV" run pyright'
  done
  spawn "web-app (tsc)" bash -c 'cd "$ROOT/web-app" && "$BUN" run typecheck'
  reap_all
}

# ----- integration (one shared container pair) ---------------------------------

INFRA_PG=""
INFRA_VK=""

stop_integration_infra() {
  [ -n "$INFRA_PG" ] && docker rm -f "$INFRA_PG" >/dev/null 2>&1
  [ -n "$INFRA_VK" ] && docker rm -f "$INFRA_VK" >/dev/null 2>&1
  INFRA_PG=""; INFRA_VK=""
  return 0
}

start_integration_infra() {
  header "Starting shared Postgres + Valkey"
  INFRA_PG="$(docker run -d --rm \
    -e POSTGRES_USER=foundry -e POSTGRES_PASSWORD=foundry -e POSTGRES_DB=foundry \
    -p 127.0.0.1::5432 postgres:17-alpine)" || return 1
  INFRA_VK="$(docker run -d --rm -p 127.0.0.1::6379 valkey/valkey:8-alpine)" || return 1

  local pg_port vk_port ready=0
  pg_port="$(docker port "$INFRA_PG" 5432/tcp | head -1 | sed 's/.*://')"
  vk_port="$(docker port "$INFRA_VK" 6379/tcp | head -1 | sed 's/.*://')"
  [ -n "$pg_port" ] && [ -n "$vk_port" ] || return 1

  for _ in $(seq 1 60); do
    if docker exec "$INFRA_PG" pg_isready -U foundry -d foundry >/dev/null 2>&1 \
       && docker exec "$INFRA_VK" valkey-cli ping >/dev/null 2>&1; then ready=1; break; fi
    sleep 0.5
  done
  [ "$ready" -eq 1 ] || return 1

  export TEST_DATABASE_URL="postgresql+asyncpg://foundry:foundry@127.0.0.1:$pg_port/foundry"
  export TEST_VALKEY_URI="redis://127.0.0.1:$vk_port"
  # Under WSL the suites run as Windows uv.exe via interop, which only forwards
  # the env vars named in WSLENV.
  export WSLENV="TEST_DATABASE_URL:TEST_VALKEY_URI${WSLENV:+:$WSLENV}"
  c_green "Shared infra ready (postgres :$pg_port, valkey :$vk_port)."
}

run_integration() {
  require_docker integration || return 0
  if ! start_integration_infra; then
    c_red "FAIL: shared test infra did not start"
    FAILURES=$((FAILURES + 1))
    stop_integration_infra
    return 0
  fi
  trap stop_integration_infra RETURN

  # Measured on the shared infra: -n 0 -> 27s, -n 4 -> 21s. Keep this at or
  # below 15 - each worker takes its own Valkey logical database, and there are
  # only 16. The other two suites are ~2s each, so sharding them buys nothing.
  local workers="${PYTEST_WORKERS:-4}"
  spawn "api-backend (integration)" bash -c \
    'cd "$ROOT/api-backend" && "$UV" run pytest -m integration -o addopts= app/tests/integration -q -p no:cacheprovider -n '"$workers"' --dist loadgroup'
  spawn "discord-server (integration)" bash -c \
    'cd "$ROOT/discord-server" && "$UV" run pytest -m integration -o addopts= tests/integration -q -p no:cacheprovider'
  spawn "discord-utils (integration)" bash -c \
    'cd "$ROOT/discord-utils" && "$UV" run pytest -m integration -o addopts= tests/integration -q -p no:cacheprovider'
  reap_all
}

# ----- E2E (docker compose stack) ----------------------------------------------

run_e2e() {
  require_docker e2e || return 0

  local web=3000 api=8000 pg=5432 vk=6379 override=""
  if port_busy 3000 || port_busy 8000 || port_busy 5432 || port_busy 6379; then
    web=13000 api=18000 pg=55432 vk=16379
    c_green "Default ports busy - using $web/$api/$pg/$vk for the E2E stack."
    override="$(mktemp)"
    cat >"$override" <<EOF
services:
  postgres:
    ports: !override ["127.0.0.1:$pg:5432"]
  valkey:
    ports: !override ["127.0.0.1:$vk:6379"]
  api-backend:
    ports: !override ["127.0.0.1:$api:8000"]
    environment:
      API_BACKEND_URL: http://127.0.0.1:$api
      FRONTEND_URL: http://127.0.0.1:$web
  web-app:
    build:
      args:
        BUN_PUBLIC_API_URL: http://127.0.0.1:$api
    ports: !override ["127.0.0.1:$web:3000"]
    environment:
      BUN_PUBLIC_API_URL: http://127.0.0.1:$api
      SITE_URL: http://127.0.0.1:$web
EOF
  fi

  local files=(-f "$COMPOSE")
  [ -n "$override" ] && files+=(-f "$override")

  cleanup_e2e() {
    header "Tearing down E2E stack"
    docker compose "${files[@]}" down -v >/dev/null 2>&1
    [ -n "$override" ] && rm -f "$override"
    return 0
  }
  trap cleanup_e2e RETURN

  header "Building and starting E2E stack"
  # Clear any stack left by an interrupted prior run so we never reuse stale
  # containers/volumes (which can leave the stack unhealthy). --wait blocks on
  # the compose healthchecks, so no readiness polling is needed here.
  docker compose -f "$COMPOSE" down -v >/dev/null 2>&1 || true
  if ! docker compose "${files[@]}" up --build --wait; then
    c_red "FAIL: stack failed to start"; FAILURES=$((FAILURES + 1))
    docker compose "${files[@]}" logs --tail=50
    return 0
  fi
  c_green "Stack ready."

  # 127.0.0.1, never "localhost": the stack publishes on the IPv4 loopback only,
  # and a client that resolves "localhost" to ::1 first stalls ~2s on every
  # connect before falling back - measured at 2.056s vs 0.005s per Valkey
  # connect, which the per-test session fixtures pay over and over.
  export E2E_BASE_URL="http://127.0.0.1:$web"
  export E2E_API_URL="http://127.0.0.1:$api"
  export E2E_DB_DSN="postgresql://foundry:foundry@127.0.0.1:$pg/foundry"
  export E2E_VALKEY_URI="redis://127.0.0.1:$vk"
  export E2E_METRICS_API_KEY="e2e-metrics-key"
  export E2E_JWT_SECRET="e2e-test-secret-e2e-test-secret-01"
  # Under WSL the suites run as Windows uv.exe/bun.exe via interop; WSL only
  # forwards env vars named in WSLENV, so the E2E_* config must be listed there
  # or the Windows processes fall back to defaults and hit the wrong ports.
  export WSLENV="E2E_BASE_URL:E2E_API_URL:E2E_DB_DSN:E2E_VALKEY_URI:E2E_METRICS_API_KEY:E2E_JWT_SECRET${WSLENV:+:$WSLENV}"

  # Both suites mutate the same stack's database, so these stay serial.
  step "Playwright (web -> api -> DB)" bash -c \
    'cd "$ROOT/integration/e2e" && "$BUN" install >/dev/null && "$BUN" run browser >/dev/null && "$BUN" run test'

  step "discord_e2e (discord -> api, api -> runelite, auth journey)" bash -c \
    'cd "$ROOT/integration/discord_e2e" && "$UV" sync >/dev/null && "$UV" run pytest -q -p no:cacheprovider'
}

# ----- dispatch ----------------------------------------------------------------

case "${1:-all}" in
  lint)        run_lint ;;
  fast)        run_fast ;;
  integration) run_integration ;;
  e2e)         run_e2e ;;
  all)         run_lint; run_fast; run_integration; run_e2e ;;
  *) echo "usage: $0 {lint|fast|integration|e2e|all}" >&2; exit 2 ;;
esac

header "Summary"
[ "${#_summary[@]}" -gt 0 ] && printf '%s\n' "${_summary[@]}"
if [ "$FAILURES" -eq 0 ]; then c_green "All selected suites passed."; else c_red "$FAILURES suite(s) failed."; fi
exit "$FAILURES"
