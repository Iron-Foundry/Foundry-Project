#!/usr/bin/env bash
# One-command test runner for the monorepo.
#
#   ./run-tests.sh lint          ruff + pyright per Python module, tsc for web-app
#   ./run-tests.sh fast          fast suites only (no Docker): api + discord + cache + web
#   ./run-tests.sh integration   real-infra suites (Docker): api + discord testcontainers
#   ./run-tests.sh e2e           full stack E2E (Docker compose): playwright + discord_e2e
#   ./run-tests.sh all           everything (default)
#
# E2E auto-detects free host ports: it uses 3000/8000/5432 when free, otherwise
# 13000/18000/55432 (so it never fights a running dev stack), and always tears
# the stack down on exit.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export ROOT
COMPOSE="$ROOT/integration/docker-compose.e2e.yml"
FAILURES=0

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

step() {
  # step "<name>" <cmd...> - run in a subshell, record failure, keep going.
  local name="$1"; shift
  header "$name"
  if "$@"; then c_green "PASS: $name"; else c_red "FAIL: $name"; FAILURES=$((FAILURES + 1)); fi
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
  step "api-backend (fast)"        bash -c 'cd "$ROOT/api-backend" && "$UV" run pytest -q -p no:cacheprovider'
  step "discord-server (fast)"     bash -c 'cd "$ROOT/discord-server" && "$UV" run pytest -q -p no:cacheprovider'
  step "osrs-cache-service (fast)" bash -c 'cd "$ROOT/osrs-cache-service" && "$UV" run pytest -q -p no:cacheprovider'
  step "web-app (unit)"            bash -c 'cd "$ROOT/web-app" && "$BUN" test tests/'
}

# ----- lint + typecheck --------------------------------------------------------

# discord-utils and discord-event have no pytest suite yet, so they appear here
# (lint + types) but not in run_fast.
_PY_MODULES="api-backend discord-server discord-utils discord-event osrs-cache-service"

run_lint() {
  for module in $_PY_MODULES; do
    [ -d "$ROOT/$module" ] || continue
    step "$module (ruff)" bash -c \
      'cd "$ROOT/'"$module"'" && "$UV" run ruff check . && "$UV" run ruff format --check .'
    step "$module (pyright)" bash -c \
      'cd "$ROOT/'"$module"'" && "$UV" run pyright'
  done
  step "web-app (tsc)" bash -c 'cd "$ROOT/web-app" && "$BUN" run typecheck'
}

# ----- integration (testcontainers, no compose) --------------------------------

run_integration() {
  require_docker integration || return 0
  step "api-backend (integration)" bash -c \
    'cd "$ROOT/api-backend" && "$UV" run pytest -m integration -o addopts= app/tests/integration -q -p no:cacheprovider'
  step "discord-server (integration)" bash -c \
    'cd "$ROOT/discord-server" && "$UV" run pytest -m integration -o addopts= tests/integration -q -p no:cacheprovider'
}

# ----- E2E (docker compose stack) ----------------------------------------------

run_e2e() {
  require_docker e2e || return 0

  local web=3000 api=8000 pg=5432 override=""
  if port_busy 3000 || port_busy 8000 || port_busy 5432; then
    web=13000 api=18000 pg=55432
    c_green "Default ports busy - using $web/$api/$pg for the E2E stack."
    override="$(mktemp)"
    cat >"$override" <<EOF
services:
  postgres:
    ports: !override ["127.0.0.1:$pg:5432"]
  api-backend:
    ports: !override ["127.0.0.1:$api:8000"]
    environment:
      API_BACKEND_URL: http://localhost:$api
      FRONTEND_URL: http://localhost:$web
  web-app:
    build:
      args:
        BUN_PUBLIC_API_URL: http://localhost:$api
    ports: !override ["127.0.0.1:$web:3000"]
    environment:
      BUN_PUBLIC_API_URL: http://localhost:$api
      SITE_URL: http://localhost:$web
EOF
  fi

  local files=(-f "$COMPOSE")
  [ -n "$override" ] && files+=(-f "$override")

  cleanup_e2e() {
    header "Tearing down E2E stack"
    docker compose "${files[@]}" down -v >/dev/null 2>&1
    [ -n "$override" ] && rm -f "$override"
  }
  trap cleanup_e2e RETURN

  header "Building and starting E2E stack"
  # Clear any stack left by an interrupted prior run so we never reuse stale
  # containers/volumes (which can leave the stack unhealthy).
  docker compose -f "$COMPOSE" down -v >/dev/null 2>&1 || true
  if ! docker compose "${files[@]}" up --build --force-recreate -d; then
    c_red "FAIL: stack failed to start"; FAILURES=$((FAILURES + 1)); return 0
  fi

  header "Waiting for api + web"
  local ready=0
  for _ in $(seq 1 60); do
    if curl -sf "http://localhost:$api/health" >/dev/null \
       && curl -sf "http://localhost:$web/" >/dev/null; then ready=1; break; fi
    sleep 3
  done
  if [ "$ready" -ne 1 ]; then
    c_red "FAIL: stack did not become ready"; FAILURES=$((FAILURES + 1))
    docker compose "${files[@]}" logs --tail=50
    return 0
  fi
  c_green "Stack ready."

  export E2E_BASE_URL="http://localhost:$web"
  export E2E_API_URL="http://localhost:$api"
  export E2E_DB_DSN="postgresql://foundry:foundry@localhost:$pg/foundry"
  export E2E_METRICS_API_KEY="e2e-metrics-key"
  export E2E_JWT_SECRET="e2e-test-secret-e2e-test-secret-01"
  # Under WSL the suites run as Windows uv.exe/bun.exe via interop; WSL only
  # forwards env vars named in WSLENV, so the E2E_* config must be listed there
  # or the Windows processes fall back to defaults and hit the wrong ports.
  export WSLENV="E2E_BASE_URL:E2E_API_URL:E2E_DB_DSN:E2E_METRICS_API_KEY:E2E_JWT_SECRET${WSLENV:+:$WSLENV}"

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
if [ "$FAILURES" -eq 0 ]; then c_green "All selected suites passed."; else c_red "$FAILURES suite(s) failed."; fi
exit "$FAILURES"
