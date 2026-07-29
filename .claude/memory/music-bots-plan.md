---
name: music-bots-plan
description: Music bots design doc lives at designs/MUSIC_BOTS.md and carries its own stage tracker
metadata:
  type: project
---

The multi-bot music feature (planned 2026-07-28, not yet implemented) is fully specified in
`designs/MUSIC_BOTS.md`. That document is the single source of truth and contains its own progress tracker:
a Delivery Stages table (stages 0 through 8) whose Status column must be updated in the same change that
completes the work, plus an Established Facts table and an Unverified Assumptions table (U1-U6).

**Why:** the owner asked for staged work with tracked progress and no assumptions, so the plan carries its own
evidence ledger and stage gates rather than living in memory or in a session.

**How to apply:** read `designs/MUSIC_BOTS.md` before touching anything music related. Stage 0 gates all other
stages. Never build on a U-row assumption until it is promoted into Established Facts with a citation.
Related: [[evidence-over-assumption]].
