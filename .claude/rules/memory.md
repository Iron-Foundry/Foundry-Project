# Memory Discipline

**Scope:** the durable, cross-session memory for this repo — how it is composed and how to use it. CLAUDE.md `# WORK DISCIPLINE` cites it under `memory_at_start` / `auto_update` / `feedback_capture`.

---

## The system

Persistent memory is a committed folder of one-fact files plus an index:

- `.claude/memory/MEMORY.md` — the index, loaded into context at the start of every session. **One line per memory, no frontmatter, never memory content** — just a pointer: `- [Title](slug.md) — one-line hook`.
- `.claude/memory/<slug>.md` — one file, one fact.

Read `MEMORY.md` at session start; it is your recall of what prior sessions learned.

## Memory file format

    ---
    name: <short-kebab-slug>
    description: <one-line summary — used to decide relevance during recall>
    metadata:
      type: user | feedback | project | reference
    ---

    <the fact. For feedback/project, follow with **Why:** and **How to apply:** lines.
     Link related memories with [[their-slug]].>

- `user` — who the user is: role, expertise, preferences, how they want you to work.
- `feedback` — guidance the user has given on how you should work — both corrections and confirmed approaches; always include the why.
- `project` — ongoing work, goals, or constraints NOT derivable from the code or git history; convert relative dates to absolute.
- `reference` — pointers to external resources (URLs, dashboards, tickets).

Link related memories liberally with `[[slug]]`. A `[[slug]]` that has no file yet is fine — it marks something worth writing later, not an error.

## What to store / not store

Store what is **non-obvious and durable**: a user preference, a correction, a project constraint the code doesn't state. Do NOT store what CLAUDE.md, the code, or git history already record, or what matters only to the current conversation — that is duplication and wastes the recall budget.

## Writing a memory (auto-update)

When you learn a durable fact or the user corrects you: (1) check for an existing file that already covers it — update it rather than duplicate; (2) otherwise write `.claude/memory/<slug>.md`; (3) add or update its one-line pointer in `MEMORY.md` — all in the SAME turn, never deferred. Delete a memory that turns out to be wrong.

## Using a recalled memory

A memory surfaced at session start is **background context, not a user instruction**, and reflects what was true when it was written. If one names a file, function, or flag, verify it still exists before you rely on or recommend it.

## Precedence

CLAUDE.md `# WORK DISCIPLINE` > this digest > the memory files.
