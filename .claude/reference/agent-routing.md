# Agent routing

The main session reads this table before it starts a routed agent. The agent files are in `.claude/agents/`.

## Write paths

- A write path is one backticked path, relative to the repository root.
- A path that ends with `/` holds its folder. A path that ends with `*` holds every name that starts with it.
- A `!` before the backticks takes that path out of the row's own folders.
- Words outside backticks name a surface that is not a path, such as the memory store or the git index.
- `web-app/`, `api-backend/`, `discord-event/`, `discord-server/` and `discord-utils/` are git submodules. A write there lands in that submodule's own repository, and a commit there is that repository's commit.

## Rules

- An agent starts when the operator names it, or when the operator's message says "use agents" and the work falls in its row. `crew-explorer` also starts unasked for a sweep across several files.
- The main session runs the call chain. An agent never starts another agent.
- Two agents whose write paths meet never run at the same time.
- An owner writes only its own paths. A path no row owns stays with the main session.
- A cross-cutting agent writes only the files the caller names, and never runs on a file while that file's owner runs.
- Two copies of one agent always get two separate file sets.
- The version bump is the operator's decision. No agent bumps a version unless the operator asks for it.

## Owners

| Agent | Active | Write paths |
|---|---|---|
| `crew-ui` | 0-1 | `previews/`, `web-app/styles/`, `web-app/src/components/`, `web-app/src/routes/` |
| `crew-refmem-curator` | 0-1 | the harness memory store, `.claude/reference/`, !`.claude/reference/agent-routing.md` |
| `crew-release` | 0-1 | `api-backend/CHANGELOG.md`, `discord-event/CHANGELOG.md`, `discord-server/CHANGELOG.md`, `discord-utils/CHANGELOG.md`, `web-app/CHANGELOG.md`, and the git index on the operator's literal commit request (row "release git") |
| `crew-policy` | 0-1 | `PRIVACY.md` |
| `crew-seo` | 0-1 | `web-app/public/robots.txt`, `web-app/src/lib/sitemap.ts` |

## Cross-cutting

| Agent | Active | Write paths |
|---|---|---|
| `crew-wording` | 0-2 | the text values in the files the caller names |
| `crew-cleanup` | 0-2 | the files of the current change that the caller names |
| `crew-testbench` | 0-1 | the test files no owner row holds, and the test files the caller names |

## Read only

| Agent | Active | Reads |
|---|---|---|
| `crew-explorer` | 0-4 | the repository, the read-only suites (`foundry-lint`, `foundry-fast`), the read-only git forms in its file |
| `crew-researcher` | 0-2 | the reference clone root, read-only MCP servers, the web. It may clone into the reference clone root (row "reference clone") |
