---
name: npc-rendering-roadmap
description: NPC model rendering in osrs-cache-service is deliberately deferred, not missing by oversight
metadata:
  type: project
---

On 2026-09-01 the user chose to land NPC decode + proxy coverage and hold NPC model
rendering as roadmap work. Do not start a renderer without being asked for it.

**Why:** the blocker is not machinery, it is a design decision. Every dependency is
already built - `npcs.model_ids` / `chathead_model_ids`, archive 7 bytes in
`raw_groups`, and the item-icon pipeline (`app/models/loader.py`, `rasterizer.py`,
`triangle_fill.py`). What an NPC lacks is a camera: an item carries `xan2d`/`yan2d`/
`zan2d` and an NPC carries nothing, so a full-body render is an angle we invent
rather than one Jagex authored. The chathead is the honest first target because the
client draws it with a fixed camera.

**How to apply:** the full brief lives under "NPC rendering (roadmap, not built)" in
`osrs-cache-service/CLAUDE.md`. Building it also retires the
`permitted_exception_npc_art` clause in `.claude/rules/osrs-item-sources.md`, which
currently justifies the wiki NPC art in
`api-backend/app/routers/tilerace/osrs_ref.py`. Related: [[cache-icon-coverage]],
[[icon-render-debugging]].
