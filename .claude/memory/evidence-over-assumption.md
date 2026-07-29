---
name: evidence-over-assumption
description: Back every behavioural claim with a citation; unprovable ones become tracked assumptions, not design foundations
metadata:
  type: feedback
---

Never state how a library, protocol, or external service behaves from recall. Back it with a citation: a
`file:line` in the vendored reference repos under `D:\claude-git-references` (check those before any web
request, per CLAUDE.md `# Research`), or the official docs URL. When a claim cannot be established from either,
do not quietly build on it - record it as an explicit unverified assumption with the test that would settle it,
and gate the dependent work behind that test.

**Why:** the owner corrected this on 2026-07-28 after a plan carried unbacked claims about Lavalink and
discord.py. Two were wrong: Lavalink v4 still ships a built-in YouTube source (the `youtube-source` plugin
README tells you to disable it), and discord.py does not validate `content`/`embeds` against a components-v2
view, it only sets the flag (`discord/http.py:197-205`). Plans built on recalled behaviour produce wrong
config and wrong code.

**How to apply:** in design docs, keep two tables - Established Facts with a citation column, and Unverified
Assumptions with a "how to establish" column - and promote rows between them as evidence arrives. See
`designs/MUSIC_BOTS.md` for the pattern. Extends the CLAUDE.md `verify_before_claim` rule beyond repo files to
third-party behaviour. Related: [[check-refs-before-asking]], [[music-bots-plan]].
