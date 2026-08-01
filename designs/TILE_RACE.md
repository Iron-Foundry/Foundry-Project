# Tile Race Module

Web-app implementation of the Tile Race event type. Teams progress across a custom tile path on a grid board by rolling dice. Staff build events using tiles from the shared Tile Repository. Tiles can carry nested item requirements, board cells can carry gameplay modifiers, rolls can be gated behind staff-verified tile completion, and the board supports zoom/pan plus configurable start/finish pads that end the game.

## Routes

| Path | File | Access |
|---|---|---|
| `/activities/tilerace` | `src/routes/activities/tilerace.tsx` | Public (read open) |
| `/members/config/tilerace` | `src/routes/members/config/tilerace.tsx` | Staff - `tilerace.admin` |
| `/members/config/tile-repository` | `src/routes/members/config/tile-repository.tsx` | Staff - `staff.tile-repository` |

## Permission IDs

| ID | Route | Default roles |
|---|---|---|
| `tilerace` | /activities/tilerace | read: open; edit/create/delete: Foundry Mentors |
| `tilerace.admin` | /members/config/tilerace | read/create/edit: Foundry Mentors; delete: Senior Moderator |
| `staff.tile-repository` | /members/config/tile-repository | read/create/edit/delete: Foundry Mentors |

## Type Reference

Core types live in `src/types/tilerace.ts`. The recursive requirement and modifier unions live in `src/types/tilerace-requirements.ts` and are re-exported from `tilerace.ts`.

**`RepositoryTile`** - A tile in the shared repository.
- `id, title, description: string`
- `icon_url: string | null` - manual icon override; null = derive from first item
- `icon_source: "wiki" | "asset" | "external"`
- `items: TileItem[]` - flat list kept for icon derivation and back-compat; each has `item_id, name, quantity, icon_url`
- `requirement: RequirementNode | null` - nested boolean requirement tree (see below); when null the API synthesizes one from `items`
- `tags: TileTag[]`

**`TileTag`** - `"precheck" | "pvm" | "skilling" | "minigames" | "misc" | "endgame" | "midgame" | "earlygame"`

**`RequirementNode`** (recursive union) - the "what a team must do" tree.
- `{ kind: "item"; item_id, quantity, name, icon_url }` - leaf, "X of an item"
- `{ kind: "and"; children: RequirementNode[] }` - all of
- `{ kind: "or"; children: RequirementNode[] }` - any of
- `{ kind: "not"; child: RequirementNode }` - negation

**`CellModifier`** (discriminated union on `type`) - per-cell gameplay modifier, also usable as a pad trigger.
- `{ type: "snakes_ladders"; target_position }` - move the team to another path step on landing
- `{ type: "fog"; radius }` - render-only fog hint
- `{ type: "bonus_penalty"; effect: "extra_roll" | "skip_turn" | "reroll" }`
- `{ type: "sabotage"; action: "steal_progress" | "block"; amount }` - applied via the sabotage endpoint / staff action
- `{ type: "trap"; dice_count; dice_sides }` - landing rolls the trap's own dice and moves the team back that many steps; sprung once per team per cell

**`BoardCell`** - A cell in the event grid.
- `cell_x, cell_y: number` - 0-indexed column / row
- `path_position: number | null` - step number on path (1-indexed); null = not on path
- `tile_id: string | null` - assigned tile from repository
- `modifiers?: CellModifier[]` - modifiers that fire when a team lands here
- `tile?: RepositoryTile` - embedded by API in public responses

**`BoardPad`** - A rectangular start/finish region measured in grid cells.
- `cell_x, cell_y: number` - top-left cell
- `width, height: number` - size in cells (1-50)
- `trigger?: CellModifier | null` - optional modifier fired when a team lands inside the pad

**`TileRaceEventSummary`** (board settings)
- `grid_cols, grid_rows: number` - up to 50 x 30
- `dice_count, dice_sides: number` - roll = sum of `dice_count` dice each `1..dice_sides` (sides 1-20, count 1-5)
- `fog_of_war: boolean`
- `is_finished: boolean` - set when a team reaches the finish pad; blocks all rolls
- `signups_open: boolean` - admin gate; when false, new signups are blocked. Existing signups can still be changed or rescinded at any time
- `winner_team_id: string | null` - team that reached the finish
- `start_pad, end_pad: BoardPad | null`
- `background_url?: string` - `background_asset_id` is vestigial (no backend field); clearing nulls the url

**`TileRaceEvent`** extends the summary with `cells[]`, `teams[]`, `signups[]`.

**`TileRaceSignup`**
- `discord_user_id: string`
- `account_id: number | null` - chosen linked account (`user_accounts.id`); the signup competes as this account
- `rsn: string; ranking_score: number` - snapshotted from the chosen account at signup / change time
- `wants_captain: boolean` - opt-in; `scramble` prefers an opted-in player as each team's captain, else the top score
- `signed_up_at: string`

Signup is a modal form (`components/events/SignupPanel.tsx`, event-agnostic and reusable): a member picks which linked account to compete with, optionally volunteers to captain, and can change the account or rescind at any time. New signups require `signups_open`.

**`TileRaceTeam`**
- `id, name, slug, icon_url, color: string`
- `icon_type: "npc" | "item"`
- `position: number` - current path step (0 = start)
- `members: TileRaceParticipant[]`
- `pending_effects?: { skip_next?: boolean; extra_rolls?: number }` - accumulated modifier state

**`TileCompletion`** - one staff-verified tile completion.
- `team_id: string; path_position: number; completed_by: string | null; completed_at: string`

**`DiceRollResult`** - roll response (all optional except `new_position`): `roll, dice[], new_position, skipped, moved_to, allow_extra_roll, reroll, skip_next, game_over`.

## API Endpoints (`src/api/tilerace.ts`)

Base prefix: `/tilerace/`

| Group | Endpoint | Method |
|---|---|---|
| Public | `/tilerace/active` | GET |
| Public | `/tilerace/events/:id` | GET |
| Signup | `/tilerace/events/:id/signup` | POST `{ account_id?, wants_captain? }` (gated by `signups_open`) / PATCH `{ account_id?, wants_captain? }` (change, any time) / DELETE (rescind, any time) |
| Repository | `/tilerace/repository` | GET / POST |
| Repository | `/tilerace/repository/:id` | GET / PATCH / DELETE |
| Events | `/tilerace/events` | GET / POST |
| Events | `/tilerace/events/:id` | PATCH / DELETE |
| Events | `/tilerace/events/:id/activate` \| `/deactivate` | POST |
| Teams | `/tilerace/events/:id/teams` | POST |
| Teams | `/tilerace/events/:id/teams/:teamId` | PATCH / DELETE |
| Teams | `/tilerace/events/:id/teams/scramble` | POST |
| Controls | `/tilerace/events/:id/teams/:teamId/roll` | POST (no body; server rolls) |
| Controls | `/tilerace/events/:id/fog-of-war` | PATCH `{ enabled }` |
| Completions | `/tilerace/events/:id/completions` | GET (any authed user) |
| Completions | `/tilerace/events/:id/teams/:teamId/completions/:pathPosition` | PUT `{ completed }` (staff) |
| Sabotage | `/tilerace/events/:id/teams/:teamId/sabotage` | POST `{ action, target_team_id, amount }` (staff) |
| OSRS ref | `/frenzy/osrs/items?q=` \| `/tilerace/osrs/npcs?q=` | GET |

`PATCH /tilerace/events/:id` accepts `grid_cols, grid_rows, dice_count, dice_sides, background_url, fog_of_war, is_finished, cells[], start_pad, end_pad, name, dates`. It uses `model_fields_set` server-side so an explicit `null` on `background_url` / `start_pad` / `end_pad` clears the field.

## Component Tree

```
TileRacePage (/activities/tilerace)
  Game Over banner (when event.is_finished)
  TileBoard
    BoardViewport (zoom/pan wrapper, useZoomPan)
      BoardPads (start/finish overlays)
      BoardCell (per cell)
        ModifierBadge (per modifier, hover-card)
        RequirementSummary (in tooltip)
        TeamMarker (per team at cell)
  TeamCard (per team)
    DiceRoller (captain only; disabled when gated or finished)

StaffTileracePage (/members/config/tilerace)
  [Events tab]  EventsTab
  [Builder tab] GridConfig + PathEditor
                  BoardViewport (leftButtonPans=false; left draws, mid/right pans)
                    BoardPads
                  TilePicker + CellModifiers (selected cell)
                  PadConfig (place/size pads + optional trigger editor)
  [Teams tab]   TeamManager
  [Controls tab] ControlsTab
                  fog toggle, dice config, Reset Game (when finished)
                  CompletionsPanel (per-team tile completion toggles)
                  team position overrides

TileRepositoryPage (/members/config/tile-repository)
  RepositoryList
    TileEditor
      RequirementEditor (recursive AND/OR/NOT/item builder)
        ItemSearch
    TileDetail (dialog; RequirementSummary)
```

## Key Patterns

### Requirement Trees
Tiles hold a recursive `RequirementNode`. `RequirementEditor` builds it (add item leaves via `ItemSearch`, nest AND/OR/NOT groups); `RequirementSummary` renders it read-only in tooltips and `TileDetail`. On save, `TileEditor` also derives a flat `items[]` from the tree leaves (`collectRequirementItems`) for icon/back-compat. Requirements are display + authoring only - the authoritative "done" gate is staff completion (below).

### Cell Modifiers
Each path cell may carry `modifiers: CellModifier[]`, edited per cell in `CellModifiers` (builder side panel; trap dice live in `TrapModifierFields`). On the board, `ModifierBadge` shows a corner badge with a hover-card describing the effect and its params (`describeModifier` in `src/lib/tilerace-modifiers.ts`).

A trap is the exception: `getCellPresentation` (`src/lib/tilerace-presentation.ts`) gives a trap-only cell the tile treatment instead - the bear trap icon from `/osrs-cache/item-icons/8144` in the cell body, "Trap" as its caption, and the dice in its tooltip - and both the public board and the builder grid draw from it. A cell with an assigned tile keeps the tile in the body and the trap falls back to its badge. A trap cell has no `tile_id`, so it never gates a roll: the team rolls straight on whether the trap just fired or was already spent.

Server applies landing modifiers in the roll handler (`snakes_ladders` relocates, `bonus_penalty` sets `pending_effects` / returns flags, `trap` rolls its own dice and walks the team back; `sabotage` is applied by the sabotage endpoint). A trap counts back from the cell's own `path_position`, and the positions a team has already sprung are kept in `pending_effects.traps_sprung`, so one trap bites a given team once while every other trap on the board still bites.

### Roll Gating & Completion
Rolls are gated behind staff-verified tile completion. A completion is a persisted row per `(team, path_position)`. Staff toggle it in `CompletionsPanel`; the roll endpoint returns `409` while a team's current tile has a `tile_id` and no completion row. The public `DiceRoller` disables the button (tooltip "Complete the current tile first") using `useCompletions`.

### Dice Roll Flow
1. Captain sees `DiceRoller` on their `TeamCard`; button reads `Roll {dice_count}d{dice_sides}`.
2. Click: client animates faces, then calls `POST .../roll` (no body).
3. Server checks `is_finished`, `skip_next`, and the completion gate; rolls `dice_count` dice each `1..dice_sides`; advances position; applies landing modifiers and pad effects.
4. Response: `{ roll, dice[], new_position, ...effects }` (may include `skipped`, `moved_to`, `allow_extra_roll`, `reroll`, `game_over`).
5. TanStack Query invalidates `tilerace.active` / `event(id)` - board re-renders.

### Start / Finish Pads & Game End
`start_pad` / `end_pad` are rectangular regions placed in `PadConfig` (size inputs + "Place" mode; click a tile to set the top-left). `BoardPads` renders them as grid-spanning overlays (green START / red FINISH) inside the transformed grid, so they scale with zoom and are `pointer-events-none`. Each pad has an optional `trigger` modifier. When a team lands on a cell inside the `end_pad`, the server sets `is_finished` + `winner_team_id`, and all further rolls return `409 "Game over"`. Staff reset via ControlsTab (`is_finished: false`). The pad must overlap the drawn path for the end-game to fire.

### Zoom / Pan
`useZoomPan` (`src/hooks/useZoomPan.ts`) drives `BoardViewport`. Wheel zoom is proportional to delta (`exp(-deltaY * 0.0007)`), clamped to scale `[1, 4]` - min scale 1 locks the image to the frame. Pan is clamped so the transformed world always covers the viewport (no empty gaps); at scale 1 it is fully locked. On the public board left-drag pans; in the builder `leftButtonPans={false}` reserves left for drawing and pans on middle/right drag (context menu suppressed). A Fit-to-screen button resets the transform.

### Fog of War
When `event.fog_of_war`, `buildFogMask(teams)` = `max(team.position)`; path cells beyond it are hidden. `BoardCell` renders hidden tiles as a white `?` in `font-rs-bold` with the `.text-shadow-fog` utility (`styles/globals.css`) over a darkened background. Non-path cells stay visible.

### Consistent Tile Sizing
Grid tracks use `minmax(0, 1fr)` (not bare `1fr`, which is `minmax(auto, 1fr)`) and cells get `min-w-0 min-h-0 overflow-hidden`, so content never stretches a track and all tiles render the same size.

### Background Image
`background_url` is set via the AssetPickerDialog in `GridConfig`; `background_asset_id` is vestigial. Clearing sends `background_url: null` and the backend honors the explicit null.

## Hooks (`src/hooks/useTilerace.ts`)

Stale times: `STALE_5M` for live event data, `STALE_24H` for repository tiles.

Queries/mutations include the originals plus: `useCompletions(eventId)`, `useToggleCompletion()`, `useSabotage()`. `useRollDice()` takes `{ eventId, teamId }` only. Completion mutations invalidate `completions(id)`, `active()`, and `event(id)`.

Query keys (`src/lib/queryKeys.ts`): `tilerace.active()`, `events()`, `event(id)`, `tiles(paramsKey)`, `tile(id)`, `completions(eventId)`.

## Lib Utilities

`src/lib/tilerace.ts`:
- `TILE_TAGS`, `TEAM_COLORS`
- `getPathCells`, `getTileAtPosition`, `buildCellMap`, `buildPathPositionMap`, `buildTeamsByCell`
- `buildFogMask`, `isCellVisible`
- `getEffectiveTileIcon` - icon override, else first `items` icon, else first requirement leaf icon
- `collectRequirementItems(node)` - flatten a requirement tree to leaf items
- `formatTileRaceDate`, `slugify`

`src/lib/tilerace-modifiers.ts`:
- `describeModifier(mod)` -> `{ label, symbol, summary, params[] }` for `ModifierBadge` hover-cards

## Backend

Postgres tables/columns via Alembic migrations (`api-backend/alembic/versions/`):
- `0045` - `tile_repository_tiles.requirement`, `tilerace_events.dice_count/dice_sides`, `tilerace_teams.pending_effects`, new `tilerace_tile_completions` table
- `0046` - `tilerace_events.start_pad / end_pad`
- `0047` - `tilerace_events.is_finished / winner_team_id`

Routers live in `api-backend/app/routers/tilerace/` (`events`, `repository`, `teams`, `controls`, `completions`, `sabotage`, `osrs_ref`), with recursive/discriminated schemas in `requirement_schema.py` and `modifier_schema.py`, and roll effect helpers in `_roll_effects.py`.
