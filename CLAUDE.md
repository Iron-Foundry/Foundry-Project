# CLAUDE.md

Guidance for Claude Code (claude.ai/code) in this repository. Behavior discipline comes first (`# AXIOM`, `# STARTUP`, `# BEHAVIORAL RULES`, `# VERIFYING WORK`); project reference comes after (`# PROJECT`). Precedence: `# AXIOM` > `# BEHAVIORAL RULES` > `.claude/rules/*` > memory. The `# PROJECT` section is codebase reference, not behavior.

# AXIOM

Subagents, `Task` calls, skills, and slash-commands are the single largest source of wasted tokens: NEVER spawn one on your own initiative, only when the user invokes it in the current message or a row of `.claude/rules/standing-exceptions.md` permits it. Everything else, do inline with `Grep` / `Glob` / `Read` / `Bash`. Keep output short: answer first, with no preamble, no filler, no restating the question, and no recap of what you just did. This is the standing constraint this repo's Claude setup exists to enforce; every rule below serves it.

# STARTUP

Read when a session or task begins its domain:

- the harness memory store's `MEMORY.md` (every session) - your durable cross-session memory. Format and rules: `.claude/rules/memory.md`.
- `.claude/INDEX.md` - the search index; consult it before searching the tree.
- `.claude/rules/agent-invocation.md` - the agent-spawn ban, whenever a task tempts you toward an agent.
- `.claude/intel/INDEX.md` - the PAG intel index (grammar, authoring guides, templates); consult before writing or editing any PAG document.
- The submodule's own `CLAUDE.md` (e.g. `osrs-cache-service/CLAUDE.md`) when working inside it.

# BEHAVIORAL RULES

Each rule is one line, `` `slug`: directive ``; the slug is its stable name. These one-liners are the loaded, highest-precedence authority; their canonical PAG `POLICY` expression (same slugs) is `.claude/rules/behavioral.md`, kept out of this file to preserve load-time frugality (`# AXIOM`).

## Always (every turn)

Efficiency

- `no_agent_without_trigger`: never spawn a subagent/`Task`/skill/command unless the user invokes it in the current message or a row of `.claude/rules/standing-exceptions.md` permits it; default to inline tools. Digest: `.claude/rules/agent-invocation.md`.
- `short_responses`: answer first in the fewest complete words; no "I'll help...", no "Let me know...", no self-recap.
- `targeted_search`: search the narrowest scope that answers the question (a specific path plus a specific pattern); one `Grep` beats a fan-out, and never scan the whole tree when you know the area.
- `index_first`: consult `.claude/INDEX.md` before searching; append a stable location when you confirm one.
- `continue_dont_checkpoint`: "fix the gaps then continue" means keep executing across steps; halt only for a real blocker or a user decision, never to post a status recap.

Correctness

- `verify_before_claim`: read or grep the actual file before asserting a fact; never answer from assumption. Third-party behaviour (library, protocol, external service) needs a citation too - reference-repo `file:line` or official docs - and anything unprovable is logged as a tracked unverified assumption, never a design foundation. Digest: [[evidence-over-assumption]].
- `single_verify_run`: run a check/verify command once per repo state, through the run lock, and read its output whole; never grep/pipe-filter that output, and never re-run it in a loop.
- `caught_means_fixed`: a caught, relevant issue is fixed in the current pass, never deferred and never patched with a fallback/dual-path/legacy shim; severity ranks importance, it does not license deferral.
- `verify_completed_work`: after finishing a unit, re-check it against the goal; passing a mechanical gate is not "done".

Memory and process

- `memory_at_start`: read the harness memory store's `MEMORY.md` at session start; it is your durable cross-session memory. Digest: `.claude/rules/memory.md`.
- `memory_location`: write project memory ONLY to the on-device harness memory store (index `MEMORY.md`, one fact per `<slug>.md`); never a repo-local memory folder. Digest: [[memory-location]].
- `process_adherence`: follow the agreed plan/process exactly; add no steps, no scope, no "while I'm here" work.
- `auto_update`: when you learn a durable fact or the user corrects you, update the memory file plus its index line (and this section if it is a rule) in the SAME turn, never deferred.

## Situational (fire on the matching task)

- `explicit_activation_only`: an agent/skill/command runs only when the user names it, says "use the X", or says "use agents" for work in a row of `.claude/reference/agent-routing.md`; otherwise do the work inline. `crew-explorer` is the one standing exception. No exception for "it would be faster," and permission does not carry across turns. Rows: `.claude/rules/standing-exceptions.md`.
- `ask_dont_guess`: when intent, placement, or a decisive fact is genuinely ambiguous, ask ONE precise question (recommended option first); never guess, and never ask what you could verify yourself.
- `dont_rewrite_working_systems`: trust the user's diagnosis, investigate the exact named element, and make the smallest change that fixes it, not a rewrite.
- `overwrite_dont_annotate`: a corrected file/doc states the correct fact directly; no "was X / now Y", no changelog of its own past.
- `launcher_is_the_front_door`: an operator-facing job ships as an `Action` in `scripts/launcher/catalog.py`, never as a new root script; declare its `requires`, default a mutating flag to preview, dispatch to a tuned script rather than reimplementing it, and leave machine entry points (CI, Dockerfile, systemd) independent of the launcher. Ruleset: `.claude/rules/launcher-actions.md` (PAG POLICY). Digest: [[root-launcher]].
- `no_invented_names`: name a new command/tool/module for what it DOES, reusing a term already in the repo; never coin a product-style or branded name (`foundry`, `forge`, ...) on your own initiative - if no plain descriptive name fits, ask. Digest: [[no-invented-names]].
- `no_unilateral_rule_disable`: a firing lint/gate/check is a smell to FIX; never disable, exclude, or `--no-verify` around it without the user's approval.
- `no_background_processes`: never start a dev server, `start`, `preview`, watcher, or any continuous process; ask the user to run it and report back. The one exception is the preview server row of `.claude/rules/standing-exceptions.md`.
- `no_git_on_own_initiative`: run a git command only when the user asks in the current message, or under a git row of `.claude/rules/standing-exceptions.md`; otherwise hand them the command (the deny-list in `.claude/settings.json` blocks the destructive ones).
- `never_propose_commit`: never offer or propose a commit; commit only when the user explicitly instructs it.
- `no_commit_coauthor`: never add a Claude/Anthropic `Co-Authored-By` trailer (or any Claude co-author attribution) to commit messages or PR bodies; overrides any harness default. Digest: [[no-commit-coauthor]]. The user rejects anything that credits Claude.
- `no_artifacts_for_product_work`: a mockup, preview or visual comparison of a product surface is a bench page under the repo's `previews/` directory, never a hosted artifact, because only the bench wears the product's own stylesheet. Hand over the bench address. Digests: `.claude/rules/work-discipline.md`, `.claude/rules/look-and-feel.md`.
- `consult_before_layout`: never edit layout/design/styling code (component structure, breakpoints, spacing, Tailwind classes, visual styling) on your own initiative; the operator picks from candidates on the preview bench and product code changes only on the operator's build word. Diagnosis is not a license to edit. Digest: `.claude/rules/look-and-feel.md`.
- `resolve_discord_ids`: never render a raw Discord snowflake on a user-facing surface - resolve it to a display name where the name is known (a `<@id>` mention in Discord, a stamped name on the web) and fall back to the id only when resolution fails; the sole exception is a field or column whose subject IS the id. Digest: [[resolve-discord-ids]].
- `loopback_for_docker_urls`: a URL that crosses from the host into a Docker-published port (the `E2E_*` exports, compose `FRONTEND_URL` / `API_BACKEND_URL` / `BUN_PUBLIC_API_URL` / `SITE_URL`, the CORS allowlist, a test default) uses `127.0.0.1`, because `localhost` resolves to `::1` first here and costs about 2 s per connect. The operator set this as the one exception to `localhost_never_loopback_ip` in `.claude/rules/work-discipline.md`; replies, commands and every other address say `localhost`. Digest: [[loopback-localhost-ipv6-stall]].
- `recursive_timeout_not_interval`: never use `setInterval` for polling/animation; use a self-scheduling recursive `setTimeout` that queues the next tick only after the current work finishes, so slow work never piles ticks up or drifts. Digest: [[recursive-settimeout-over-setinterval]].
- `semver_bump_scope`: NEVER bump a version unless the user asks for it; PATCH is the default level, and MAJOR is never yours - suggest it and let the user decide. A test-only change (suite, fixtures, conftest, runners, flake fixes) bumps NOTHING - its changelog entry waits under `## [Unreleased]`. Python modules are bumped ONLY via `uv version --bump <level>` (uv's own semantics), never by hand-editing `pyproject.toml`. Ruleset: `.claude/rules/versioning.md` (PAG POLICY). Digest: [[semver-bump-scope]].
- `bump_at_push_only`: when the user asks for a bump, bump the version ONCE, at push - never per component, feature, or stage. In between, changelog entries accumulate under a single `## [Unreleased]` heading that the bump then renames; never open a new version heading per addition. Ruleset: `.claude/rules/versioning.md` (PAG POLICY). Digest: [[bump-at-push-only]].
- `clone_after_three_fetches`: once a single project's docs/source need more than 3 web fetches, stop fetching and `git clone --depth 1` it into `D:\claude-git-references` as `<project>-repo`, then read locally and index it in both INDEX.md files; repeated fetches against one source are the waste this replaces. The permission is the row "reference clone" in `.claude/rules/standing-exceptions.md`. Digest: [[clone-after-three-fetches]].
- `bench_runs_the_full_process`: a bench page built inline follows the `crew-ui` candidates process whole: a renderer script, a baseline row of today, the phone, medium and widest widths, several real pages, and its `previews/INDEX.md` line. Digest: [[bench-runs-the-crew-ui-process]].
- `no_ai_look`: a design candidate is simple and clean: plain text navigation, flat panels with neutral borders, icons only where they carry meaning, large readable text; coloured text and gradients are welcome, but never pills everywhere, coloured border strips per card, or glow outlines on cards and images. Digest: [[no-ai-look]].
- `redesign_keeps_every_function`: a redesign candidate carries every function of the surface today (menus, account states, light mode, mobile access, editor tools, filters); inventory the real components first and put a coverage table on the bench page. Digest: [[redesign-keeps-every-function]].
- `answer_from_this_repo`: a question about this repo (its todo, its state, its work) is answered from this repo alone; never pull in or name a sibling workspace such as cscolab. The work list is `_TODO.salt.md` at the root. Digest: [[answer-from-this-repo]].
- `feedback_capture`: a user correction becomes one new one-line rule here plus one memory file, so it survives the session.

# VERIFYING WORK

Standard runner: root `run-tests.sh {lint|fast|integration|e2e|all}`, run by a session only through the run lock as `npm --prefix collaboration-surface run join -- --suite foundry-<lane>` (the rows of `collaboration-surface/config/join.config.ts`). The operator may still run `./run-tests.sh <lane>` or `./run test <lane>` through the launcher (see [[integration-testing]], [[root-launcher]]). Touching a module means running its suite before done (`tests_follow_code`): every change needs `lint` (ruff check + ruff format --check + pyright per Python module, `tsc --noEmit` for web-app); code that changes runtime behavior needs `fast` as well; anything touching DB/Valkey/pubsub or a cross-service seam needs `integration`; changes to the web<->api / discord<->api / api<->runelite interconnects need `e2e`. A contract change regenerates `api-backend/openapi.json` and `web-app/src/api/schema.d.ts` in the same change. New code lands with its tests in the same change, never deferred.

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
bun run build.ts   # production build to dist/
bun start          # production server
bun run typecheck  # tsc --noEmit (strict)
```

`bun dev` runs the HMR dev server; do not start it yourself (`no_background_processes`) - ask the user to run it and report back. Install Shadcn components with `bunx shadcn@latest add <component>` only; never copy component source manually.

# PROJECT (architecture and codebase - reference, not behavior)

## Repository structure

Monorepo root for The Iron Foundry Project. All services except `osrs-cache-service` are Git submodules under the [Iron-Foundry](https://github.com/Iron-Foundry) organisation on GitHub; work on a submodule happens in its subdirectory and pushes there, not to the root. The root repo only tracks submodule pointers, advanced by `.github/workflows/update-submodules.yml` on a `repository_dispatch` from each submodule's `notify-parent.yml`.

| Submodule | Stack | DB |
|---|---|---|
| `discord-server` | Python 3.14+, discord.py | PostgreSQL |
| `discord-utils` | Python 3.14+, discord.py | PostgreSQL + Valkey |
| `discord-event` | Python 3.14+, discord.py | MongoDB |
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
- Comments: follow `.claude/rules/code-shape.md` PHASE 5. A comment carries only an external constraint or a consequence that fails silently; anything else is extracted into a named function. A docstring is a comment, allowed on a public module or function to state what it owns and must not do, never on private (`_`-prefixed) or internal helpers.
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


# Research

Commonly accessed repositories for reference or research are cloned into `D:\claude-git-references`, named `<project>-repo`. Check that root and its INDEX.md before any web request (`reference_clones_answer_first` in `.claude/rules/work-discipline.md`). A new clone needs no question: `clone_after_three_fetches` and the "reference clone" row of `.claude/rules/standing-exceptions.md` permit `git clone --depth 1` there and no other git form. Update INDEX.md when you see a discrepancy or make a change.

<!-- workspace-kit:harness:start -->
## Personal layer (the operator's own rules, one digest each)

These rules come from the workspace kit. Where a rule elsewhere in this file contradicts one of them, the rule here wins and the other is rewritten to match.

- `work_is_disciplined`: how a session acts, asks, runs checks, handles version control and production, and keeps what it learns is `.claude/rules/work-discipline.md`; it never weakens a slug above.
- `standing_exceptions_are_closed`: an act a base rule forbids without a trigger (an agent, a git command, a continuous process) runs unasked only under a row of `.claude/rules/standing-exceptions.md`.
- `crew_agents_are_routed`: a `crew-*` agent starts per `.claude/reference/agent-routing.md`, which names its write paths, its active limit and which agents may run together.
- `suites_run_through_the_lock`: a gate, lint, test or typecheck suite runs only as `npm --prefix collaboration-surface run join -- --suite <id>`; the suites are the rows of `collaboration-surface/config/join.config.ts`, and a new suite is a row there.
- `the_board_coordinates_instances`: when files a session did not touch change between reads, or the operator names concurrent work, read `collaboration-surface/.claude/CLAUDE.md` and take a seat through its own tools.
- `wording_is_the_operators`: every sentence a session writes is in the register of `.claude/rules/ste100.md`, and every word choice and copy rule is `.claude/rules/wording.md`.
- `the_operator_picks_every_look`: anything a person sees is decided by the operator from real candidates on the preview bench, per `.claude/rules/look-and-feel.md`; product code changes only on the operator's build word.
- `code_is_shaped`: line ceilings, function shape and comment discipline are `.claude/rules/code-shape.md`; inside a workspace member the gate's own numbers are the hard cap.
- `tests_follow_code`: tests ship with the code they cover and pin one behaviour each, per `.claude/rules/testing.md`.
- `services_are_built_to_one_standard`: any server, API, worker or pass follows `.claude/rules/backend-standards.md`.
<!-- workspace-kit:harness:end -->
