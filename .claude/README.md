# Claude behaviour layer

This folder holds how Claude works in this repository. What the code is (stacks, per-service architecture, style) lives in CLAUDE.md `# PROJECT`, and this layer does not touch it.

## Two layers

- **The repository's own rules** — CLAUDE.md `# AXIOM`, `# STARTUP`, `# BEHAVIORAL RULES` and `# VERIFYING WORK`, with their PAG expressions in `.claude/rules/behavioral.md`, `testing.md`, `versioning.md`, `launcher-actions.md`, and the prose digests `agent-invocation.md` and `memory.md`.
- **The operator's personal layer** — the marked block at the end of CLAUDE.md and the digests it cites: `work-discipline.md`, `standing-exceptions.md`, `wording.md`, `ste100.md`, `look-and-feel.md`, `code-shape.md`, `testing.md`, `backend-standards.md`. The workspace kit installs and refreshes this layer with `npm run kit:install -- --target <this repo> --layer harness --merge` from the kit's root. Where the two layers disagree, the personal layer wins and the repository's rule is rewritten to match.

## File manifest

- **`.claude/rules/`** — one digest per concern, as listed above.
- **`.claude/agents/`** — `crew-*` agents, routed by `.claude/reference/agent-routing.md`, plus `agent-creator-agent.md` and `forensic-context-verifier.md`.
- **`.claude/intel/`** — the PAG grammar, guides, keywords and templates. `.claude/intel/INDEX.md` lists them.
- **`.claude/INDEX.md`** — a search index (concern → location), consulted before a search.
- **`.claude/settings.json`** — the deny-list for destructive git, `sed` and `awk`, and the run-lock hook from `collaboration-surface/`.
- **`collaboration-surface/`** — the run lock and the board. Every suite a session runs is a row in `collaboration-surface/config/join.config.ts`, run as `npm --prefix collaboration-surface run join -- --suite <id>`.
- **`previews/`** — the preview bench for looks decisions.
- **Memory** — the harness memory store on this machine (`~/.claude/projects/<repo-hash>/memory/`), out of the repository. Format: `.claude/rules/memory.md`.

## Enforce and verify

- No agent, `Task`, skill or slash-command spawns unless the user names it in the current message, or a row of `.claude/rules/standing-exceptions.md` permits it.
- Responses answer first, with no preamble, filler or self-recap.
- Searches name a specific path and pattern, and `.claude/INDEX.md` is consulted first.
- The harness memory store's `MEMORY.md` is read at session start.

## Maintain

- A durable, non-obvious fact or a correction → write or update its `<slug>.md` in the harness memory store and its `MEMORY.md` pointer in the same turn.
- A user correction also becomes one new one-line rule in CLAUDE.md `# BEHAVIORAL RULES`.
- A stable file location → append it to `.claude/INDEX.md`.
