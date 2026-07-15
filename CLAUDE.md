# CLAUDE.md

Guidance for Claude Code (claude.ai/code) in this repository. Behavior discipline comes first (`# AXIOM`, `# STARTUP`, `# BEHAVIORAL RULES`, `# VERIFYING WORK`); project reference comes after (`# PROJECT`). Precedence: `# AXIOM` > `# BEHAVIORAL RULES` > `.claude/rules/*` > memory. The `# PROJECT` section is codebase reference, not behavior.

# AXIOM

Subagents, `Task` calls, skills, and slash-commands are the single largest source of wasted tokens: NEVER spawn one on your own initiative, only when the user invokes it in the current message. Everything else, do inline with `Grep` / `Glob` / `Read` / `Bash`. Keep output short: answer first, with no preamble, no filler, no restating the question, and no recap of what you just did. This is the standing constraint this repo's Claude setup exists to enforce; every rule below serves it.

# STARTUP

Read when a session or task begins its domain:

- `.claude/memory/MEMORY.md` (every session) - your durable cross-session memory. Format and rules: `.claude/rules/memory.md`.
- `.claude/INDEX.md` - the search index; consult it before searching the tree.
- `.claude/rules/agent-invocation.md` - the agent-spawn ban, whenever a task tempts you toward an agent.
- The submodule's own `CLAUDE.md` (e.g. `osrs-cache-service/CLAUDE.md`) when working inside it.

# BEHAVIORAL RULES

Each rule is one line, `` `slug`: directive ``; the slug is its stable name.

## Always (every turn)

Efficiency

- `no_agent_without_trigger`: never spawn a subagent/`Task`/skill/command unless the user invokes it in the current message; default to inline tools. Digest: `.claude/rules/agent-invocation.md`.
- `short_responses`: answer first in the fewest complete words; no "I'll help...", no "Let me know...", no self-recap.
- `targeted_search`: search the narrowest scope that answers the question (a specific path plus a specific pattern); one `Grep` beats a fan-out, and never scan the whole tree when you know the area.
- `index_first`: consult `.claude/INDEX.md` before searching; append a stable location when you confirm one.
- `continue_dont_checkpoint`: "fix the gaps then continue" means keep executing across steps; halt only for a real blocker or a user decision, never to post a status recap.

Correctness

- `verify_before_claim`: read or grep the actual file before asserting a fact; never answer from assumption.
- `single_verify_run`: run a check/verify command once per repo state and read its output whole (`tail`); never grep/pipe-filter that output, and never re-run it in a loop.
- `caught_means_fixed`: a caught, relevant issue is fixed in the current pass, never deferred and never patched with a fallback/dual-path/legacy shim; severity ranks importance, it does not license deferral.
- `verify_completed_work`: after finishing a unit, re-check it against the goal; passing a mechanical gate is not "done".

Memory and process

- `memory_at_start`: read `.claude/memory/MEMORY.md` at session start; it is your durable cross-session memory. Digest: `.claude/rules/memory.md`.
- `process_adherence`: follow the agreed plan/process exactly; add no steps, no scope, no "while I'm here" work.
- `auto_update`: when you learn a durable fact or the user corrects you, update the memory file plus its index line (and this section if it is a rule) in the SAME turn, never deferred.

## Situational (fire on the matching task)

- `explicit_activation_only`: an agent/skill/command runs only when the user names it or says "use the X"; otherwise do the work inline. No exception for "it would be faster," and standing permission does not carry across turns.
- `ask_dont_guess`: when intent, placement, or a decisive fact is genuinely ambiguous, ask ONE precise question (recommended option first); never guess, and never ask what you could verify yourself.
- `dont_rewrite_working_systems`: trust the user's diagnosis, investigate the exact named element, and make the smallest change that fixes it, not a rewrite.
- `overwrite_dont_annotate`: a corrected file/doc states the correct fact directly; no "was X / now Y", no changelog of its own past.
- `no_unilateral_rule_disable`: a firing lint/gate/check is a smell to FIX; never disable, exclude, or `--no-verify` around it without the user's approval.
- `no_background_processes`: never start a dev server, `start`, `preview`, watcher, or any continuous process; ask the user to run it and report back.
- `no_git_on_own_initiative`: run a git command only when the user asks in the current message; otherwise hand them the command (the deny-list in `.claude/settings.json` blocks the destructive ones).
- `never_propose_commit`: never offer or propose a commit; commit only when the user explicitly instructs it.
- `feedback_capture`: a user correction becomes one new one-line rule here plus one memory file, so it survives the session.

# VERIFYING WORK

## Python services (discord-server, discord-utils, discord-event, api-backend, osrs-cache-service)

`uv` only - never `pip` or `uv pip install`.

```bash
uv add <package>          # add dependency
uv add --dev <package>    # add dev dependency
uv run ruff format .      # format
uv run ruff check . --fix # lint + autofix
uv run pyright            # type check
uv run pytest             # tests (anyio, dry-run/integration)
```

Every api-backend endpoint has a corresponding test in `app/tests/`.

## web-app

```bash
bun run build.ts # production build to dist/
bun start        # production server
```

`bun dev` runs the HMR dev server; do not start it yourself (`no_background_processes`) - ask the user to run it and report back. Install Shadcn components with `bunx shadcn@latest add <component>` only; never copy component source manually.

# PROJECT (architecture and codebase - reference, not behavior)

## Repository structure

Monorepo root for The Iron Foundry Project. All services are Git submodules under the [Iron-Foundry](https://github.com/Iron-Foundry) organisation; work on a submodule happens in its subdirectory and pushes there, not to the root. The root repo only tracks submodule pointers (auto-advanced by CI on submodule pushes).

| Submodule | Stack | DB |
|---|---|---|
| `discord-server` | Python 3.14+, discord.py | PostgreSQL |
| `discord-utils` | Python 3.14+, discord.py | PostgreSQL + Valkey |
| `discord-event` | Python 3.13+, discord.py | MongoDB |
| `api-backend` | Python 3.14+, FastAPI + Gunicorn | PostgreSQL + Valkey |
| `web-app` | TypeScript, React 19, Bun | - |
| `osrs-cache-service` | Python 3.14+, FastAPI + Gunicorn | PostgreSQL (dedicated `cache-postgres`) |

`osrs-cache-service` is a plain directory in this monorepo, not a submodule (see `osrs-cache-service/CLAUDE.md`).

## Infrastructure and secrets

Defined in `docker-compose.yml`. Services: PostgreSQL 17, MongoDB 8, Valkey 8 (Redis-compatible). All app containers share the `foundry` bridge network. `docker-compose.override.yml` is for local overrides; TLS/reverse-proxy config is in `docker-compose.traefik.yml`. Secrets are managed by Infisical (3rd-party). Always propagate an env change downstream to the example file and the docker-compose files.

## Code conventions

### Python

- PEP 8, 88-char line limit, type hints everywhere, loguru for logging, f-strings for formatting.
- Async testing uses anyio (not asyncio directly). Never use EM dashes, no emojis. Keep it simple and descriptive; code is flexible and reusable and functions do one thing.
- File size: 150 LOC max per Python file; split into sub-modules when approaching the limit.
- Comments: no inline comments, code is self-explanatory through naming. Docstrings are acceptable on public/user-facing functions and modules only, never on private (`_`-prefixed) or internal helpers.
- Dependency pins (all Python services): `kaleido==0.2.1` (1.x+ requires Chrome; 0.2.1 bundles its own renderer), `plotly<6` (plotly 6 broke kaleido 0.2.1 compatibility).

### TypeScript (web-app)

- Strict mode: no `any`, explicit return types on all exported functions and components.
- File size: component and pure-function files 150 LOC max; design/layout-heavy files 250 LOC max; split when approaching.
- Public page consistency: all public-facing pages match the established design language - `font-rs-bold` headings, `text-primary` / `text-muted-foreground` palette, `mx-auto max-w-5xl py-6 space-y-10` outer wrapper, Shadcn `<Card>` with `p-6` padding, `<Separator />` between major sections. Baseline: `/about`, `/rules`, `/home`.

## Service architectures

### api-backend

FastAPI app with lifespan-managed services. On startup it connects PostgreSQL (SQLAlchemy async) and Valkey; if `WOM_GROUP_ID` is set it starts `WomNameChangeService`, `ClanStatsService`, and `RankingService`; it runs background tasks `_discord_chat_subscriber` (Valkey pubsub to WebSocket broadcast) and `_party_expiry_task`. DB migrations via Alembic (`alembic/versions/`). Auth is Discord OAuth2 + JWT (HS256). Routers: assets, auth, badges, clan, config, content, events, members, parties, ranking, staff, surveys, ccdispatch.

### web-app

Entry `src/index.tsx` (Bun HTTP server). Routes via TanStack Router (`src/routes/`). UI components via Shadcn/ui (Radix UI + Tailwind CSS 4). The prod server (`src/prod-server.ts`) injects `API_URL` and per-route OG meta into `dist/index.html`. Env vars: `BUN_PUBLIC_API_URL` (API base URL), `SITE_URL` (default `https://ironfoundry.cc`).

### osrs-cache-service

Pulls OSRS game cache builds from the OpenRS2 Archive, decodes the JS5 binary cache format, and stores structured definitions (items, npcs, objects, varbits, sprites/icons) plus raw undecoded cache groups in a dedicated `cache-postgres` database. Exposes a read-only FastAPI. Only the latest cache build is retained. See `osrs-cache-service/CLAUDE.md` for the JS5 layer, the decoder registry pattern, and how to add a new definition type.

### discord-server

Entry `main.py` runs `asyncio.run(main())`. Core: `CommandHandler` (singleton managing the `app_commands.CommandTree`), `discord_client.py` (client setup with all guild intents), and `service_loader.py` / `service_handler.py` (feature loading pattern). Features are self-contained modules under `features/`: account, action_log, broadcast, member, parties, tickets, user_keys.
