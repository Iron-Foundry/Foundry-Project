# Competition Scheduling System - Design Document

## Overview

The competition scheduling system runs **rolling, automated OSRS competitions** for the Iron Foundry clan with no manual staff work per cycle. A schedule fires on a recurrence interval; each cycle posts a Discord poll asking members which metric to compete on, tallies the votes, creates a Wise Old Man (WOM) competition for the winning metric, waits for it to end, then announces the leaderboard back to Discord.

Three services collaborate over Valkey pub/sub:

- **web-app** - staff control surface at `/members/config/competition-schedule`: create/edit schedules, pause/resume, skip, trigger now, override poll options, edit/repair individual runs.
- **api-backend** - owns the persistent state, the REST API, and the `CompetitionScheduleService` background state machine that drives each run through its lifecycle and talks to WOM.
- **discord-server** - `CompScheduleService`: the only service that touches Discord. Posts polls, collects votes, closes overdue polls, and sends result embeds.

The api-backend never touches Discord and the discord-server never touches the database. Everything between them flows as JSON messages on five Valkey channels.

---

## Architecture

```
Staff (web-app)
  /members/config/competition-schedule
    └─ REST → api-backend  (create / patch / pause / skip / trigger / override / patch-run)
                 │
                 ▼
        competition_schedules ─┬─ scheduled_competition_runs   (PostgreSQL)
                 │
   CompetitionScheduleService (api-backend background task, ticks every 60s)
                 │  state machine over runs
                 │
     Valkey pub/sub  foundry:comp_schedule:*
                 │
                 ▼
        CompScheduleService (discord-server)
                 │  Discord native polls + embeds
                 ▼
             Discord guild  (poll channel, results channel)
                 │
   winning metric ──► WOM competition (created by api-backend via WiseOldManHandler)
                 │
   competition ends ──► results fetched from WOM ──► announced to results channel
```

### Message flow for one cycle

```
tick: next_poll_at due
  api  → create run (pending_poll)
  api  → CREATE_POLL ─────────────► discord
                                     posts Discord poll
  discord → POLL_POSTED ──────────► api   (stores message id; run = poll_active)
  api     advances next_poll_at by recurrence_days

tick: poll_ends_at passed
  api  → CLOSE_POLL ──────────────► discord
                                     tallies votes
  discord → POLL_RESULT ──────────► api   (winning_metric or skipped)

run = competition_pending
  api  → create WOM competition (WiseOldManHandler)
         run = competition_active, competition_ends_at set

tick: competition_ends_at passed
  api  → fetch top 10 from WOM
  api  → ANNOUNCE_RESULTS ────────► discord
                                     sends results embed
  run = results_announced (terminal)
```

---

## Data Model (PostgreSQL, api-backend)

`app/db/models/competition_schedule.py`

### `competition_schedules` - the recurring template

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `name` | text | Poll title source |
| `description` | text? | |
| `is_active` | bool | Paused schedules are skipped by the tick |
| `poll_channel_id` | bigint | Discord channel for the poll |
| `results_channel_id` | bigint | Discord channel for the announcement |
| `poll_duration_hours` | float | 0-72, how long the poll stays open |
| `competition_duration_hours` | float | 0-336, WOM competition length |
| `recurrence_days` | float | Interval between cycles |
| `poll_options` | jsonb | `[{label, metric}]`, 2-10 entries |
| `title_template` | text | `"{metric} Competition"`, `{metric}` substituted |
| `next_poll_at` | timestamptz? | When the next cycle fires; the scheduling clock |
| `created_by` | bigint? | |
| `created_at` / `updated_at` | timestamptz | |

### `scheduled_competition_runs` - one execution of a schedule

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `schedule_id` | bigint FK → schedules, `ON DELETE CASCADE` | |
| `status` | text | State machine value (see below) |
| `poll_options_override` | jsonb? | One-off option set for this run only |
| `discord_poll_message_id` | bigint? | Set once the bot posts the poll |
| `discord_poll_channel_id` | bigint? | |
| `winning_metric` | text? | Resolved from the poll |
| `wom_competition_id` | int? | WOM competition created for this run |
| `competition_title` | text? | |
| `poll_starts_at` / `poll_ends_at` | timestamptz? | |
| `competition_starts_at` / `competition_ends_at` | timestamptz? | |
| `error_detail` | text? | Populated on the `error` status |
| `created_at` / `updated_at` | timestamptz | |

Index `ix_scheduled_competition_runs_schedule_status` on `(schedule_id, status)` - the tick queries runs by status constantly.

---

## Run State Machine

`app/services/competition_schedule/service.py` (`CompetitionScheduleService`) advances runs. `app/services/competition_schedule/repository.py` holds the DB helpers.

```
pending_poll ──► poll_active ──► competition_pending ──► competition_active ──► results_announced
     │                │                                                              (terminal)
     │                └─(no votes)──► skipped (terminal)
     └─(no votes)────────────────► skipped (terminal)
                         any WOM failure ──► error (terminal)
```

Active statuses (a schedule may have at most one active run): `pending_poll`, `poll_active`, `competition_pending`, `competition_active`.
Terminal statuses: `results_announced`, `skipped`, `error`.

### The tick (`_tick`, every 60s)

1. **Fire due polls** - for each active schedule with `next_poll_at <= now` and no active run, create a run and publish `CREATE_POLL`; set the run `poll_active` and advance `next_poll_at` by `recurrence_days`.
2. **Recover stuck polls** - a `pending_poll` run with no `poll_starts_at` means `_fire_poll` crashed before publishing; re-publish.
3. **Republish unacknowledged polls** - a `poll_active` run with no `discord_poll_message_id` after a 120s grace (`_POLL_ACK_GRACE`) gets `CREATE_POLL` re-sent (the bot's `POLL_POSTED` was lost).
4. **Close overdue polls** - a `poll_active` run past `poll_ends_at` with a known message id gets `CLOSE_POLL`.
5. **Create WOM competitions** - `competition_pending` runs call `create_competition`; on success the run becomes `competition_active` and is **committed immediately** so an unrelated tick failure cannot roll back and orphan the WOM link.
6. **Announce ended competitions** - `competition_active` runs past `competition_ends_at` fetch the top 10 participants from WOM, publish `ANNOUNCE_RESULTS`, and become `results_announced`.

### The subscriber loop (`_subscriber_loop`)

Listens on `POLL_POSTED` and `POLL_RESULT`:
- `POLL_POSTED` → store `discord_poll_message_id` / `discord_poll_channel_id`.
- `POLL_RESULT` → `skipped` if no votes, else `competition_pending` with the `winning_metric`. Ignored unless the run is still `poll_active`/`pending_poll` (idempotent against duplicate closes).

---

## Valkey Channels

Both sides hardcode the same constants (`_CH_*`). Payloads are JSON.

| Channel | Direction | Payload |
|---|---|---|
| `foundry:comp_schedule:create_poll` | api → discord | `run_id, channel_id, options, poll_duration_hours, title` |
| `foundry:comp_schedule:poll_posted` | discord → api | `run_id, discord_poll_message_id, discord_poll_channel_id` |
| `foundry:comp_schedule:close_poll` | api → discord | `run_id, channel_id, message_id, options` |
| `foundry:comp_schedule:poll_result` | discord → api | `run_id, winning_metric` \| `run_id, skipped:true` |
| `foundry:comp_schedule:announce_results` | api → discord | `run_id, results_channel_id, competition_title, metric, wom_competition_id, top_results[]` |

---

## Discord Side (discord-server)

`features/competition_schedule/`

- **`service.py`** (`CompScheduleService`) - three independent subscriber tasks (`create_poll`, `close_poll`, `announce_results`), each a self-reconnecting Valkey pubsub loop that spawns a per-message handler task. Never reads the DB; correlates purely by `run_id`.
- **`poll_provider.py`** - `PollProvider` Protocol with `post_poll` / `collect_result`. Default `DiscordNativePollProvider` uses Discord's built-in poll (discord.py 2.4+). Options map back to metrics **by index** (answer order is preserved). Winner = highest `vote_count`; zero total votes → `winning_metric=None` → run skipped.
- **`views.py`** - `build_results_embed`: medal emoji for the top 3, xp/kc formatting per metric type, and a "View on Iron Foundry" link to `{FRONTEND_URL}/competitions/{wom_id}`.

Channel resolution (`_resolve_text_channel`) falls back guild cache → client cache → `fetch_channel`, and logs+skips on `NotFound`/`Forbidden`/non-text.

---

## REST API (api-backend)

`app/routers/clan/competition_schedule.py`, mounted under `/clan`. Guarded by page permission `staff.comp-schedule` (`read` for GET, `create` for writes).

| Method | Path | Purpose |
|---|---|---|
| GET | `/competition-schedules` | List, each with its `active_run` |
| POST | `/competition-schedules` | Create |
| GET | `/competition-schedules/{id}` | Detail |
| PATCH | `/competition-schedules/{id}` | Edit fields / `is_active` |
| DELETE | `/competition-schedules/{id}` | Delete (cascades runs) |
| POST | `/competition-schedules/{id}/pause` | `is_active=false` |
| POST | `/competition-schedules/{id}/resume` | `is_active=true` |
| POST | `/competition-schedules/{id}/skip-next` | Mark active run `skipped`, push `next_poll_at` forward one interval |
| POST | `/competition-schedules/{id}/trigger-now` | Set `next_poll_at` 5s in the past so the next tick fires it; 409 if a poll is already live |
| PATCH | `/competition-schedules/{id}/next-poll-at` | Set the next fire time explicitly |
| POST | `/competition-schedules/{id}/override-options` | Override options for the next/pending run (creates + triggers one if none pending) |
| PATCH | `/competition-schedules/{id}/runs/{run_id}` | Manually repair a run; rejects setting `competition_active` with a past `competition_ends_at` (would announce instantly) |
| GET | `/competition-schedules/{id}/runs` | Run history (optional `status`, `limit`) |

Channel IDs are transported as **strings** in JSON (JS number precision) and cast to `int` at the boundary.

---

## Web Control Surface (web-app)

`src/routes/members/config/competition-schedule.tsx` (registered page id `staff.comp-schedule`).

- **`api/competitionSchedule.ts`** - thin fetch wrapper over the endpoints above.
- **`hooks/useCompetitionSchedule.ts`** - TanStack Query hooks; lists/detail/runs **poll every 15s** so run status tracks the backend tick without websockets.
- **`types/competitionSchedule.ts`** - mirror of the API shapes.

UI pieces: schedule cards with live status badges and Pause/Resume/Skip/Trigger/Override/Delete controls; a create/edit dialog; a poll-options editor sourced from `competition-metrics.toml`; an override dialog (next run only); a run-history table with a per-run repair dialog. Datetimes are edited in **UTC** to match the backend clock.

---

## Configuration

- **api-backend** - the `CompetitionScheduleService` starts in the lifespan only when `WOM_GROUP_KEY` is set; it also needs `WOM_GROUP_ID` and optional `WOM_API_KEY` / `WOM_DISCORD_CONTACT`. Registered in `app.state.service_registry` under `competition_schedule` (toggleable). `VALKEY_URI` for pub/sub.
- **discord-server** - `CompScheduleService` loaded via `core/service_loader.py`; needs `VALKEY_URI` and `FRONTEND_URL` (for the leaderboard link). Requires the bot to have poll + send-message permissions in both channels.

---

## Failure Handling and Idempotency

- **Crash before publish** - `pending_poll` with no `poll_starts_at` is retried by the tick.
- **Lost `POLL_POSTED`** - `poll_active` with no message id is re-published after a 120s grace.
- **Duplicate `POLL_RESULT`** - ignored unless the run is still awaiting a result.
- **WOM link durability** - the run is committed the instant the WOM competition is created, isolated from the rest of the tick transaction.
- **WOM failure** - run moves to `error` with `error_detail`; staff can inspect and repair via the run PATCH endpoint.
- **Reconnects** - every Valkey subscriber loop (both services) self-heals with a 5s backoff.
