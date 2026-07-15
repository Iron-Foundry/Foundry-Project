<!-- Search index: recurring concern -> where it lives. Consult before searching (index_first); append a stable location when you confirm one. Keeps searches targeted instead of scanning the tree or spawning a search agent. Seeded from CLAUDE.md; grow it as you work. -->

# Index

## Submodules (work in the subdir and push there, not the root)
- `discord-server` — Python 3.14+ discord.py, PostgreSQL. Entry `main.py` → `asyncio.run(main())`. `CommandHandler` singleton over `app_commands.CommandTree`; `discord_client.py`; `service_loader.py`/`service_handler.py`. Features under `features/`: account, action_log, broadcast, member, parties, tickets, user_keys.
- `discord-utils` — Python 3.14+ discord.py, PostgreSQL + Valkey.
- `discord-event` — Python 3.13+ discord.py, MongoDB.
- `api-backend` — Python 3.14+ FastAPI + Gunicorn, PostgreSQL + Valkey. Routers: assets, auth, badges, clan, config, content, events, members, parties, ranking, staff, surveys, ccdispatch. Migrations `alembic/versions/`. Tests `app/tests/` (anyio, dry-run/integration; every endpoint has one).
- `web-app` — TypeScript, React 19, Bun. Entry `src/index.tsx`; routes `src/routes/` (TanStack Router); prod `src/prod-server.ts`; UI Shadcn/ui. Design baseline: `/about`, `/rules`, `/home`.
- `osrs-cache-service` — Python 3.14+ FastAPI, dedicated `cache-postgres`. JS5 decoder registry — see `osrs-cache-service/CLAUDE.md`.

## Config / infra / tooling
- `docker-compose.yml` (+ `.override.yml`, `.traefik.yml`) — PostgreSQL 17, MongoDB 8, Valkey 8; `foundry` bridge network.
- Secrets via Infisical; keep env changes in the example file + the compose files.
- Python: `uv` only (`uv add`, `uv run ruff/pytest/pyright`). Web: `bun`.

<!-- append below: <concern> -> <path> as you discover stable locations -->
