---
name: resolve-discord-ids
description: Discord ids are always resolved to a display name before they reach a user, except where the id itself is the subject
metadata:
  type: feedback
---

Always attempt to resolve a Discord user id to that user's display name before
showing it. The only exception is a field or column whose subject IS the id -
an "Discord ID" input, a debug readout, a copyable identifier.

**Why:** a snowflake is meaningless to a reader. It identifies nobody at a
glance, and on any surface that lists who did what it turns the whole list into
noise. This came up when the music panel rendered `Requested by
225683257146998785` and the activity feed listed bare ids for every action.

**How to apply:** resolve where the name is actually known, once, and carry it
with the record rather than resolving at render time.

- In Discord, a `<@id>` mention is already the resolved form - Discord renders
  it as the member. Leave those alone.
- For anything crossing to the web, stamp the name in discord-utils: it holds
  the main bot's guild and so is the only process that can see a per-server
  nickname. See `music/naming.py` and [[music-requester-names]].
- api-backend cannot do it: its `users` table only holds people who have logged
  into the website, and it stores the global username, never the server nick.
- A failed lookup falls back to the id. Never block or fail an operation to get
  a name.
- New payloads that carry an actor id should carry the name beside it, the way
  `SessionTrack.requester_name` and `ActivityOut.actor_name` do.
