---
name: memory-location
description: Project memory is the repo's .claude/memory/, never the harness auto-memory path
metadata:
  type: feedback
---

Durable memory for this repo lives ONLY in the committed `.claude/memory/` folder
(index `MEMORY.md`, one fact per `<slug>.md`), per `.claude/rules/memory.md` and
CLAUDE.md STARTUP. Do not write project memory to the harness auto-memory path
(`~/.claude/projects/.../memory/`) even though the harness surfaces its own
`MEMORY.md` at session start.

**Why:** on 2026-07-15 I wrote several session memories to the harness path instead
of the repo store; the user flagged it as ignoring the memory rules. The repo store
is the single source of truth the project's discipline layer governs.

**How to apply:** when learning a durable fact or being corrected, write/update
`.claude/memory/<slug>.md` in the repo and its `MEMORY.md` pointer in the same turn;
follow `.claude/rules/memory.md` format. Treat the harness auto-memory as read-only
background, not a write target.
