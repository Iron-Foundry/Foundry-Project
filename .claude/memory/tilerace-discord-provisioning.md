---
name: tilerace-discord-provisioning
description: Tile race Discord channels/roles are provisioned by discord-server from full-shape Valkey commands; the bot stores no tile race state
metadata:
  type: project
---

Added 2026-07-31. The website's tile race Controls tab is the only way to build
or remove the event's Discord shape. api-backend publishes a command on
`foundry:tilerace_discord`; discord-server's `TileRaceService` applies it and
POSTs the resulting ids back to `POST /tilerace/events/{id}/discord/result`,
authenticated with `METRICS_API_KEY` in a `verification-code` header. One
category per event holds a captains channel plus a text and voice channel per
team. Team icons are web-only - the user chose name-only sync to Discord, so
role icons (which need boost tier 2) were deliberately not built.

**Why:** the bot deliberately holds no tile race state. Every command carries
the full desired shape rather than a diff, which makes `setup` and `sync` the
same idempotent pass and makes an extra sync free. That is what lets a team
added after the first build appear on the next sync, and it is why the ids are
the only thing that ever travels back.

**How to apply:** any mutation that changes a roster or a team name must call
`sync_if_provisioned` - rename, roster add/move/captain/remove, generate and
reset all do. Role membership is reconciled in BOTH directions, so a removal on
the site actually takes channel access away. A deleted team needs the targeted
`teardown_team` action, because `apply` only ever creates and renames and would
leave its role and channels orphaned. `provisioning.apply` writes ids into a
sink as it goes and the service reports that sink even on failure, so a run that
dies part-way is recoverable rather than invisible. Untested against a live
guild so far: the integration scope was skipped on the change that added it.
Related: [[tilerace-signups-are-the-roster]], [[integration-testing]],
[[resolve-discord-ids]].
