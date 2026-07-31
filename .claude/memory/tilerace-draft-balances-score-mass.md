---
name: tilerace-draft-balances-score-mass
description: Tile race team generation balances score mass with a greedy lowest-average draft, not a snake order, because ranking_score is heavily right-skewed
metadata:
  type: project
---

Tile race team generation drafts with `greedy_draft` in `api-backend/app/routers/tilerace/_draft.py`:
strongest-first, each pick landing on whichever open team has the lowest `total / capacity`.
`target_sizes` spreads the remainder one member at a time across the leading teams, so no
runt team is created.

**Why:** `ranking_score` is clan ranking points (`_roster_helpers.py: ranking_score()`), a
heavily right-skewed distribution. A snake order balances *draft positions*, not score mass -
the team holding the #1 player is compensated only with the worst pick of round two, which is
nowhere near enough when the top player carries several times the median points. In production
(2026-07-31) that produced averages decaying monotonically from team 1 (302,440) to team 17
(156,039), a 1.94x spread. The old `target_sizes` made it worse by leaving a final team of one,
whose average was a single player's score.

Measured over 50 seeded pools of 81 signups at team size 5, worst/best team average:

| skew (lognormal sigma) | old snake | greedy + even sizes |
|---|---|---|
| 0.4 | 1.42x | 1.08x |
| 0.6 | 1.69x | 1.15x |
| 0.8 | 2.12x | 1.39x |
| 1.0 | 2.83x | 1.90x |

**How to apply:** never reintroduce a snake/round-robin draft here. Any test pool for this
algorithm must be skewed - a linear pool (`1000 - i`) hides the whole failure mode, which is
exactly why the original `test_draft_spreads_strength` passed while production was 2x apart.
A hard floor remains: one player whose points exceed a team's fair share cannot be balanced by
any assignment; only capping or rank-normalising `ranking_score` would fix that.
`balance_raiders` still runs after the draft with no score-neutrality constraint, so it can
widen the spread again - open issue.

Related: [[tilerace-signups-are-the-roster]], [[tests-follow-code]].
