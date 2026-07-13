# Ballot Token Poll System - Design Document

## Overview

The Ballot Token system adds a lightweight token economy on top of the competition scheduling system (see [COMPETITION_SCHEDULING.md](COMPETITION_SCHEDULING.md)). It introduces a second, opt-in poll type - the **Ballot Booth** - rendered with Discord Components V2, where each vote costs a **Ballot Token**. Competition performance pays tokens back out: finishing 1st-5th and gaining at least 10% of the winner's total both award configurable amounts.

Which poll type a schedule uses is chosen per schedule via a **`poll_version`** field:

- `poll_version = 1` - the existing free native Discord poll (`DiscordNativePollProvider`). No tokens.
- `poll_version = 2` - the new Ballot Booth (`BallotBoothPollProvider`). Charges tokens, uses V2 buttons.

### Key architectural fact

A native Discord poll stores votes on Discord and is tallied only at close. A button poll cannot: each click is a live event, so the Ballot Booth **writes each vote to the DB on click** to charge the token, enforce one-vote-per-poll, and survive bot restarts. Vote persistence lives in PostgreSQL; the Discord side is otherwise stateless and correlates purely by `run_id`.

---

## Rules

- Each vote costs `vote_cost` Ballot Tokens (default 1).
- A member is **charged once per poll** (`uq_ballot_vote_once` on `(run_id, discord_user_id)`). Switching to a different option afterwards updates the existing vote row and is **free**.
- Voting with insufficient balance is rejected; no vote is recorded.
- Placement awards: 1st-5th receive `placement_tokens[i]`.
- Bonus: anyone gaining `>= bonus_threshold_pct%` of rank 1's gained value receives `bonus_tokens`. **Stacks** with placement awards.
- A member holds at most `max_hold` tokens; awards clamp with `LEAST(balance + delta, max_hold)`.
- If a poll is skipped or cancelled, every voter is **refunded** their vote cost, exactly once.

---

## Architecture

```
Staff (web-app)
  /members/config/ballot-tokens        -> global token config (Config table)
  /members/config/competition-schedule -> per-schedule poll_version + override

api-backend
  competition_schedules.poll_version        selects the poll type
  CompetitionScheduleService (tick)
    - create_poll payload gains poll_version, vote_cost, per-option icon_url
    - _announce_results  -> process_run_awards  (placements + bonus, capped)
    - skipped / skip-next / delete -> refund_run  (refund voters once)

  Valkey foundry:comp_schedule:*   (create_poll / close_poll carry poll_version)

discord-server
  CompScheduleService routes by poll_version:
    v1 -> DiscordNativePollProvider
    v2 -> BallotBoothPollProvider (features/ballot_booth/)
            post_poll   -> BallotBoothView (V2, booth icon + per-option icons + buttons)
            vote click  -> BallotVoteButton (DynamicItem) -> PgBallotRepository.cast_vote
            collect      -> DB tally -> winning metric -> poll_result
  BallotVoteButton registered once via add_dynamic_items in post_ready (restart-safe)

Shared PostgreSQL
  ballot_token_accounts       authoritative balance
  ballot_token_transactions   append-only audit ledger
  ballot_poll_votes           one vote/user/run, tally source, refund record
```

---

## Data Model (PostgreSQL, api-backend owns migration `0048`)

**`ballot_token_accounts`** - `discord_user_id` PK (FK users, cascade), `balance` int, `updated_at`.

**`ballot_token_transactions`** - append-only ledger: `id`, `discord_user_id` (indexed), `delta` (negative spend, positive award/refund), `reason` (`vote_spend` | `placement_award` | `bonus_award` | `refund`), `run_id?` (FK runs, `SET NULL`), `created_at`. `sum(delta) == balance` by construction (awards record their effective, post-clamp delta).

**`ballot_poll_votes`** - `id`, `run_id` (FK runs, cascade, indexed), `discord_user_id`, `metric`, `created_at`. `UniqueConstraint(run_id, discord_user_id)`.

**`competition_schedules`** gains `poll_version` (int, default 1) and `token_config_override` (jsonb, nullable).

**`scheduled_competition_runs`** gains `tokens_awarded_at` and `votes_refunded_at` (both timestamptz, nullable) - idempotency guards so awards and refunds run exactly once per run.

The three ballot tables are mirrored in `discord-server/core/db/models.py` (hand-synced, per that module's convention).

---

## Configuration

Global defaults live in the `Config` table (`guild_id=0`, key `ballot_token_config`):

```json
{ "placement_tokens": [10,7,5,3,2], "bonus_threshold_pct": 10,
  "bonus_tokens": 1, "vote_cost": 1, "max_hold": 100 }
```

`resolve_token_config(session, schedule)` (`app/services/competition_schedule/ballot_tokens.py`) merges hard defaults <- global config <- per-schedule `token_config_override`. Staff edit the global blob at `/config/ballot-tokens` (page permission `staff.ballot-tokens`).

---

## Vote Flow (discord-server)

`features/ballot_booth/`:

- **`views.py`** `BallotBoothView` - a gold `Container`. The header is a `Section` holding the title/instructions `TextDisplay` (including the poll close time as Discord timestamps, `Poll closes <t:unix:R> (<t:unix:f>)`) with the right-aligned OSRS Poll Booth image as its `Thumbnail` accessory. Each option is then a `Section(label + live vote count, accessory=Thumbnail(boss/skill icon))` followed by the option's Vote button in its own `ActionRow` (stacked layout: icon inline-right, button below). The header shows the running total and each option shows its own count. Options are capped at **5** (a `Section` allows only one accessory, so the icon and button occupy separate components; at 5 options this stays well under Discord's 40-component budget). `BallotBoothClosedView` is the terminal state shown after close.

  Live counts: on each accepted vote (`ok`/`changed`) the button schedules a **debounced** message refresh (`features/ballot_booth/refresh.py`, one edit per run per ~3s, trailing edge) that reloads the poll context via `PgBallotRepository.get_poll_context(run_id)`, re-tallies, and edits the poll message with a freshly built view carrying a `-# Last updated: <t:unix:R>` footer. Debouncing coalesces vote bursts into a single edit so a busy poll cannot hit Discord's per-message edit rate limit. Context (title, options, close time) is read from read-only mirrors of `competition_schedules` / `scheduled_competition_runs` in `core/db/models.py`, and option icon URLs are recomputed from `features/ballot_booth/icons.py` (a port of the wiki icon map). This is stateless and survives restarts (no in-memory cache).
- **`vote_button.py`** - `BallotVoteButton`, a `DynamicItem[Button]` with custom_id template `ballot_vote:{run_id}:{metric}:{cost}`. The message carries plain buttons with that structured custom_id; a single `add_dynamic_items(BallotVoteButton)` in `post_ready` routes every click after any restart, with no message-id tracking. Callback is transactional (see repository) and replies ephemerally with the new balance.
- **`pg_repository.py`** `PgBallotRepository.cast_vote`:
  1. `INSERT ... ON CONFLICT (uq_ballot_vote_once) DO NOTHING RETURNING id`; no row means the member already voted -> update the metric on the existing row (free) and return `changed` or `unchanged`, no charge.
  2. New vote: guarded debit `UPDATE ... SET balance = balance - cost WHERE balance >= cost RETURNING balance`; no row -> rollback -> `insufficient` (the vote insert is discarded).
  3. Ledger `vote_spend`; commit; `ok` with the new balance.
- **`provider.py`** `BallotBoothPollProvider` - `post_poll` builds and sends the view; `collect_result` reads `tally(run_id)` (GROUP BY metric), picks the max-count metric (tie-break by option order), edits the message to the closed view, and returns the winning metric so the backend advances the run to `competition_pending`.

The backend `create_poll` payload carries `poll_ends_at_unix` (rendered as the close time), and `close_poll`/`create_poll` carry `poll_version` (and `title`) so `CompScheduleService` selects the right provider on each side.

### Extend / shorten an active poll

`POST /clan/competition-schedules/{id}/adjust-poll` with `{ delta_hours }` shifts the active run's `poll_ends_at` (floored at now + 1 min). For v2 polls it also publishes `foundry:comp_schedule:update_poll`, which the Discord side consumes (`_handle_update_poll` -> `BallotBoothPollProvider.update_poll`) to re-render the message with the new close time. The tick sends `close_poll` when the adjusted `poll_ends_at` passes. Staff drive this from the schedule card (Extend/Shorten buttons shown while a poll is active). Native (v1) polls use Discord's own fixed timer and are not adjustable.

---

## Award Flow (api-backend)

`_announce_results` (`app/services/competition_schedule/service.py`) is the hook - it already fetches WOM `participations`. When `run.tokens_awarded_at` is unset and participations exist:

1. `resolve_token_config` -> effective config.
2. `process_run_awards` (`awards.py`) sorts participations, resolves each `player.displayName` (lowercased) to `discord_user_id` via `user_accounts` then `users.rsn` (`resolve_rsns`, mirroring `_enrich_with_ranks`), and builds the award plan (`compute_award_plan`, pure and unit-tested): placement tokens for ranks 1-5, plus bonus for anyone at or above `bonus_threshold_pct%` of rank 1's gained.
3. `award_tokens` applies each award with a capped upsert (`LEAST(balance + delta, max_hold)`) and records the effective delta in the ledger.
4. `run.tokens_awarded_at` is set in the same commit.

A WOM fetch failure yields empty participations and awards nothing (no crash). The `announce_results` Valkey payload gains a `token_awards` summary.

## Refund Flow

`refund_run(session, run, schedule)` (`ballot_tokens.py`) refunds `vote_cost` to every voter of a run once, guarded by `votes_refunded_at`. Wired into the `_handle_poll_result` skipped branch (service) and the `skip-next` and `delete` schedule endpoints (router, before cascade delete). Native (v1) runs have no ballot votes, so the call is a harmless no-op.

---

## Web Surfaces (web-app)

- **Profile** `BallotTokensCard` (`/members/profile`) - current balance and recent ledger entries, via `GET /clan/ballot-tokens/me` (`useBallotTokens`).
- **Poll itself** - the ephemeral vote confirmation shows the voter's remaining balance.
- **Schedule dialog** (`/members/config/competition-schedule`) - a Poll Type select (Native / Ballot Booth) writing `poll_version`. The schedule card shows the active poll's close time and Extend/Shorten (+/-6h) controls.
- **Config page** (`/members/config/ballot-tokens`) - edits the global `ballot_token_config` blob (`staff.ballot-tokens`).

---

## Testing

- api-backend `app/tests/test_ballot_tokens.py`: balance endpoint auth, config CRUD auth gating, and the pure award math (`compute_award_plan`) - placement + bonus stacking, threshold exclusion, unresolved-RSN skip, zero-gain no-op.
- End-to-end (local compose): create a `poll_version=2` schedule, `trigger-now`, confirm the booth renders, vote/charge/reject paths, restart persistence (DynamicItem), close -> winner from DB tally, awards on a finished WOM comp, and refund-once on skip/delete.
