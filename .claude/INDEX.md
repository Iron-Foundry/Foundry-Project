<!-- Search index: recurring concern -> where it lives. Consult before searching (index_first); append a stable location when you confirm one. Keeps searches targeted instead of scanning the tree or spawning a search agent. Seeded from CLAUDE.md; grow it as you work. -->

# Index

## Submodules (work in the subdir and push there, not the root)
- `discord-server` — Python 3.14+ discord.py, PostgreSQL. Entry `main.py` → `asyncio.run(main())`. `CommandHandler` singleton over `app_commands.CommandTree`; `discord_client.py`; `service_loader.py`/`service_handler.py`. Features under `features/`: account, action_log, broadcast, member, parties, tickets, user_keys.
- `discord-utils` — Python 3.14+ discord.py, PostgreSQL + Valkey.
- `discord-event` — Python 3.13+ discord.py, MongoDB.
- `api-backend` — Python 3.14+ FastAPI + Gunicorn, PostgreSQL + Valkey. Routers: assets, auth, badges, clan, config, content, events, members, parties, ranking, staff, surveys, ccdispatch. Migrations `alembic/versions/`. Tests `app/tests/` (anyio, dry-run/integration; every endpoint has one).
- `web-app` — TypeScript, React 19, Bun. Two separate Bun servers: dev/HMR `src/index.tsx` (`bun dev`/`start`) and prod `src/prod-server.ts` (Docker CMD, OG-meta SPA injection). Shared `/embed/*` OG-image + fixtures + `_preview` handling in `src/embed/routes.ts` (`handleEmbedRoutes`); cards in `src/embed/*.tsx` (satori). Routes `src/routes/` (TanStack Router); UI Shadcn/ui. Design baseline: `/about`, `/rules`, `/home`.
- `osrs-cache-service` — Python 3.14+ FastAPI, dedicated `cache-postgres`. JS5 decoder registry — see `osrs-cache-service/CLAUDE.md`.

## Config / infra / tooling
- `docker-compose.yml` (+ `.override.yml`, `.traefik.yml`) — PostgreSQL 17, MongoDB 8, Valkey 8; `foundry` bridge network.
- Secrets via Infisical; keep env changes in the example file + the compose files.
- Python: `uv` only (`uv add`, `uv run ruff/pytest/pyright`). Web: `bun`.

## Reference repos (D:\claude-git-references)
- `wise-old-man-repo` — WiseOldMan (github.com/wise-old-man/wise-old-man). Used with `add-metric` skill for WOM metric additions.
- `clansocket-osrs-cache-extractor-repo` — clansocket OSRS cache extractor. Ground-truth for `osrs-cache-service` 2D item-icon rendering (model lighting/camera/HSL, `app/models/`).
- `discord.py-repo` — discord.py (github.com/Rapptz/discord.py). Library source for the discord-server/discord-utils/discord-event submodules (commands, app_commands, UI, intents).
- `cache-mediawiki-repo` — osrs-wiki cache-mediawiki. OSRS cache -> MediaWiki scripts; reference for `osrs-cache-service` cache decode/definition extraction.
- `osrs-wiki-maps-repo` — osrs-wiki maps tooling. Generates OSRS wiki map images; reference for `osrs-cache-service` map render/tiling.
- `wom.py-repo` — wom.py (github.com/jonxslays/wom.py). Async Python WiseOldMan API client; reference for WOM endpoints/models (pairs with `wise-old-man-repo`, `add-metric` skill).

<!-- append below: <concern> -> <path> as you discover stable locations -->
- web-app SEO / per-route meta: injected server-side in `web-app/src/prod-server.ts` (`buildOgTags` = title/description/canonical/OG/Twitter/article meta; `buildStructuredData` = JSON-LD). JSON-LD builders (Organization/WebSite/BreadcrumbList/Article) in `web-app/src/lib/structured-data.ts`; ld+json scripts carry the CSP nonce. Sitemap `web-app/src/lib/sitemap.ts` (emits `<lastmod>` from each content entry's `updated_at`, sourced from the api-backend `GET /content/{page_type}/categories` tree — that endpoint returns an untyped `list[dict]`, so no openapi/schema.d.ts contract for those fields); robots `web-app/public/robots.txt`.
