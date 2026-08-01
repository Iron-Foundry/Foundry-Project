---
name: tilerace-claim-not-approval
description: A tile race roll is unlocked by a claim (all leaves submitted), never by staff approval; a rejection rolls the team back and furthest_position restores it
metadata:
  type: project
---

The tile race roll gate keys on a **claim**, not on staff approval. A tile counts
as claimed the moment every requirement leaf carries a submission that has not
been rejected; the next roll unlocks immediately. Staff approval only upgrades
the `tilerace_tile_completions` row from `claimed` to `approved`. A rejection (or
a deleted submission) sets it to `rejected`, sends the team back to the tile it
was proving, and stores where it had reached in `tilerace_teams.furthest_position`
- claiming that tile again hands the position straight back.

**Why:** the rules handed to teams on 2026-08-01 promise exactly this - "You do
not need to wait for the submission to be accepted to roll your next dice... if
we find something is wrong you will be rolled back to the tile you were on...
after which you will be returned to your active point." Gating on approval would
stall a fast-paced 10-day event behind staff timezones.

**How to apply:** never add a second gate that waits for `approved`. All of the
transitions live in one function, `apply_claim_state()` in
`app/routers/tilerace/_submission_helpers.py` - change the rules there, not in
the routers, and never let a caller write a completion row directly except the
staff manual override in `completions.py`. Restoring is guarded on
`path_position == team.position` so clearing some *other* tile while rolled back
cannot skip the tile still owed.

Related: [[tilerace-discord-provisioning]], [[tilerace-signups-are-the-roster]],
[[integration-testing]].
