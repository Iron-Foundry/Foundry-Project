---
name: tilerace-signups-are-the-roster
description: tilerace_signups is the persistent roster (team_id FK); team rosters are derived, never stored, so team ops are always reversible
metadata:
  type: project
---

`tilerace_signups` is the **single source of truth** for who is in a tile race
event and which team they are on. `TileRaceSignup.team_id` (FK ->
`tilerace_teams.id`, `ON DELETE SET NULL`) carries the assignment; `is_captain`
and `added_by_staff` live on the same row. `tilerace_teams.members` (JSONB) was
dropped in migration `0060` — team rosters are derived at serialize time by
`group_by_team()` + `_serialize_team(team, members, kc_map)` in
`app/routers/tilerace/_helpers.py`.

**Why:** the old `POST .../teams/scramble` wrote rosters into
`teams.members` and then **deleted every signup row**, so scrambling was a
one-way door — there was no way back to bare signups and no way to inspect or
adjust the pool afterwards. Deriving the roster makes every team operation
reversible by construction: `POST .../teams/reset` is one `UPDATE ... SET
team_id = NULL`, and deleting a team returns its members to the pool via the FK
instead of destroying them.

**How to apply:**
- Never reintroduce a stored roster column or dual-write team membership; add
  fields to `TileRaceSignup` instead.
- Any new team operation must be expressible as a change to `signup.team_id` —
  if it needs to delete signup rows to work, the design is wrong.
- Team generation (`POST .../teams/generate`, `generate.py` + `_draft.py`)
  replaced scramble: `team_size` is a **hard maximum** (`ceil(n / size)` teams,
  last one takes the remainder), teams are reconciled in place so existing
  name/colour/icon survive, and raids-KC balancing swaps members between teams
  rather than redrafting.
- Deleting teams cascades `tilerace_rolls` and `tilerace_tile_completions`, so
  `generate` refuses to shrink the team count once an event has either.
- One captain per team is a **partial unique index**
  (`uq_tilerace_team_captain ON tilerace_signups (team_id) WHERE is_captain AND
  team_id IS NOT NULL`), declared on both the model and migration `0060`.
  Postgres checks it per statement, so any code path that reshuffles captains
  must clear the old ones in their **own flushed statement** before the new
  assignment - see `_clear_assignments()` in `generate.py` and `clear_captain()`
  in `_roster_helpers.py`. An ORM-only in-Python swap emits UPDATEs in PK order
  and can trip the index mid-flush.

Related: [[mirror-add-remove-features]], [[integration-testing]].
