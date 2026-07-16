# Claude Work-Discipline Layer — setup guide

For the user's own Claude Code instance. This describes a **behavior-only** discipline layer that cuts token cost — chiefly by banning subagent/`Task`/skill spawns unless the user explicitly asks. It does not touch the codebase's architecture or vision; those stay in CLAUDE.md's `# PROJECT` section.

This folder is a staging copy. The steps below install the layer into the **real Iron Foundry repo**.

## Why

Token cost was dominated by agent spawns. The fix is a small, committed set of behavior rules that make inline `Grep`/`Glob`/`Read`/`Bash` the default, keep responses short, keep searches targeted, and give Claude a durable memory + index so it stops re-discovering the same things.

## Two separate concerns (keep them separate)

- **Behavior** — how Claude works. Lives in CLAUDE.md `# WORK DISCIPLINE` + `.claude/rules/*` + `.claude/memory/` + `.claude/INDEX.md`. This is the layer this guide installs.
- **Project** — what the code is (stacks, per-service architecture, style). Lives in CLAUDE.md `# PROJECT`. Untouched by this layer.

## What this layer is (file manifest)

- **CLAUDE.md → `# WORK DISCIPLINE`** — the SSOT for behavior: the token-discipline AXIOM (no agent spawns without an explicit trigger; short responses) + one-line `Always`/`Situational` rules. Sits above `# PROJECT`.
- **`.claude/rules/agent-invocation.md`** — the primary control: when an agent/skill/command may spawn (only on explicit user trigger), what counts as activation, the inline-first default.
- **`.claude/rules/memory.md`** — the durable memory approach: format, what to store, auto-update.
- **`.claude/memory/MEMORY.md`** — the memory index (one line per fact), read at session start; `.claude/memory/<slug>.md` holds each fact.
- **`.claude/INDEX.md`** — a search index (concern → location) so Claude searches targeted instead of scanning the tree or spawning a search agent; seeded from CLAUDE.md.
- **`.claude/settings.json`** — already carries the destructive-git / `sed`/`awk` / verify-pipe deny-list; leave it. (Agent spawns are governed by the CLAUDE.md rule, not a permission.)

## Install into the real repo (Claude-actionable steps)

1. Copy the CLAUDE.md `# WORK DISCIPLINE` section into the real repo's CLAUDE.md, directly under the intro line and **above** the architecture, and wrap the existing architecture under `# PROJECT (architecture & codebase — reference, not behavior)`. Do not edit the architecture content.
2. Copy `.claude/rules/agent-invocation.md` and `.claude/rules/memory.md`.
3. Create `.claude/memory/MEMORY.md` (empty index) and `.claude/INDEX.md`.
4. Re-seed `.claude/INDEX.md` from the real repo: list each submodule's entry points and the paths you actually search often (routers, features, migrations, tests). Keep it short; grow it as you work.
5. Confirm `.claude/settings.json` has the destructive-git deny-list (copy from here if missing).
6. Commit the `.claude/` behavior files + the CLAUDE.md change.

## Enforce / verify

- No agent, `Task`, skill, or slash-command is spawned unless the user names it in the current message — otherwise the work is done inline.
- Responses answer first, no preamble/filler/self-recap.
- Searches name a specific path + pattern; `.claude/INDEX.md` is consulted first.
- `.claude/memory/MEMORY.md` is read at session start.

## Maintain (auto-update)

- Learn a durable, non-obvious fact, or get corrected → write/update a `.claude/memory/<slug>.md` file and its `MEMORY.md` pointer in the same turn. Don't store what CLAUDE.md/code already say.
- A user correction also becomes one new one-line rule in CLAUDE.md `# WORK DISCIPLINE`.
- Discover a stable file location → append it to `.claude/INDEX.md`.
