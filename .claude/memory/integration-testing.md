---
name: integration-testing
description: Layered cross-service test setup (api/web/discord) - layers, markers, how to run
metadata:
  type: project
---

Cross-module integration testing, added 2026-07-22. Layered, hybrid placement.

**Primary entry point:** root `run-tests.sh` (user's preferred way to run) - `./run-tests.sh fast|integration|e2e|all`. Fast = no Docker (api+discord pytest, web bun test); integration = testcontainers; e2e = compose stack. It auto-picks free host ports (3000/8000/5432 else 13000/18000/55432), health-waits, and always tears the stack down. Per-service commands below are what it wraps.

**The user runs it under WSL** (`bash run-tests.sh` resolves to WSL bash). Hard-won details baked into the script:
- WSL bash has `$HOME=/home/..` (Linux) and no `cygpath`; uv/bun are Windows installs. The script derives the Windows home via `cmd.exe`+`wslpath` (Git Bash: `cygpath`+`$USERPROFILE`), adds `~/.local/bin`+`~/.bun/bin`, and resolves `$UV`/`$BUN` to `uv.exe`/`bun.exe` via interop (reusing the existing Windows venvs). All call sites go through `"$UV"`/`"$BUN"`.
- WSL only forwards env vars listed in `WSLENV` to Windows child processes. The e2e `E2E_*` vars MUST be added to `WSLENV` or the Windows uv.exe/bun.exe fall back to defaults (8000/5432) and hit the dev stack -> 401s + dev-DB pollution. The script exports `WSLENV` with them.
- Playwright browser install: use `bun run browser` (package script -> local `playwright` bin), never `bun x playwright install` (bun's `x` prompts/re-resolves and hangs under `>/dev/null`).
- E2E JWT secret is >=32 bytes (compose `JWT_SECRET` + `E2E_JWT_SECRET` match) to avoid pyjwt's InsecureKeyLengthWarning.

**Per-service (inside each submodule):**
- `api-backend`: fast suite is mocked (ASGI + AsyncMock DB/Valkey), default run (~440) deselects real-infra via `addopts = "-m 'not integration'"`. Real-infra tests in `app/tests/integration/` (marker `integration`): testcontainers Postgres+Valkey, `alembic upgrade head`, real `app.main:app` via `asgi_lifespan.LifespanManager`. Fixtures: `client`, `staff_client` (wraps `staff_permission_patches`), `seed_engine`. Coverage: seam tests (health/DB, metrics/report, ccdispatch WS) + real-DB router lifecycles (parties, surveys, content). Run: `uv run pytest -m integration -o addopts="" app/tests/integration`. Valkey uses a generic `DockerContainer` (not `testcontainers.redis`, which needs the `redis` pkg).
- Contract: `api-backend/openapi.json` is the committed source of truth; regen `uv run python scripts/generate_openapi.py` (needs `PYTHONPATH=.`); `test_openapi_contract.py` fails if stale. `test_inbound_contracts.py` validates root `fixtures/*.json` against inbound models.
- `web-app`: `bun test tests/` (happy-dom via `@happy-dom/global-registrator`, preloaded in `bunfig.toml`). Covers `apiFetch` error mapping, lib helpers (errors/competitions/assetUrl), a Testing-Library component render, and `api-contract.test.ts` (parses `apiFetch(...)` paths, checks each exists in committed `src/api/schema.d.ts`; regen `bun run gen:api-types`; skip `.d.ts` in the walk or it times out).
- `discord-server`: `uv run pytest` (default ~18, deselects `integration`) = smoke imports + `test_api_contracts.py` (MetricsReporter payload vs `fixtures/metrics_report.json`). Real-Postgres repo tests in `tests/integration/` (marker `integration`) build schema via `Base.metadata.create_all` (no own Alembic); run `uv run pytest -m integration -o addopts="" tests/integration`.

**Root E2E (`integration/`, not a submodule):** `docker compose -f integration/docker-compose.e2e.yml up --build -d` (self-contained test creds; standard ports 3000/8000/5432; api container self-migrates on boot). Playwright web->api->DB in `integration/e2e/` (`bun run test`); pytest in `integration/discord_e2e/` (`uv run pytest`) covers discord->api metrics, api->runelite ccdispatch WS, and an authed party journey (mints an HS256 JWT with `E2E_JWT_SECRET`, asserts DB status transitions). Override host ports with a `!override` ports file if the local dev stack occupies 5432/8000/3000. Note: a *missing* Authorization header is 422 (required-header), only a *malformed* token is 401.

**CI (Forgejo Actions, `codeberg-small`):** each submodule has `.forgejo/workflows/test.yml`; root `.forgejo/workflows/e2e.yml` runs on push to main / dispatch. Codeberg runners expose no Docker socket to the job, so that workflow does NOT use the compose stack: Postgres and Valkey come from `services:` (runner-created, reachable as hosts `postgres`/`valkey`) and api-backend (gunicorn) plus web-app (`bun src/prod-server.ts` after `bun run build.ts`) run as background processes in the job container on 8000/3000. The compose file remains the local path only. Submodule-only checkouts skip root-fixture contract tests (guarded by `fixtures/` existence). See [[forgejo-no-permissions-key]].

The web contract layer's first catch: 3 dead web api-client methods (`updateMe`, `listEntries`, `createEntry`) hitting non-existent endpoints - removed rather than adding unused api surface. See [[secrets-and-startup]] (both services auto-migrate on container start).
