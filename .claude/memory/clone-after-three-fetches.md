---
name: clone-after-three-fetches
description: More than 3 fetches against one project's docs means clone it as a reference repo and read locally
metadata:
  type: feedback
---

When answering questions about a single external project needs more than 3 web fetches, stop fetching. Clone
it with `git clone --depth 1` into `D:\claude-git-references` as `<project>-repo`, read the files directly, and
add a row to BOTH `.claude/INDEX.md` and `D:\claude-git-references\INDEX.md` naming the specific paths that
answered the question. No confirmation needed in that situation - the repeated fetching is itself the signal.

**Why:** the owner called this out on 2026-07-28 after roughly seven fetches against `lavalink.dev` while
building the music service. The entire docs site turned out to be inside the Lavalink repo under `docs/`, so
every one of those fetches was avoidable, and each returned a lossy summary rather than the exact text.

**How to apply:** prefer a clone the moment a topic looks like it needs sustained reading of one project.
Docs sites are usually generated from a `docs/` directory in the source repo, so cloning gets the source AND
the docs in one shot, exact rather than summarized. Extends CLAUDE.md `# Research` (check
`D:\claude-git-references` before any web request) with a stop condition for when to add to it.
Related: [[check-refs-before-asking]], [[evidence-over-assumption]].
