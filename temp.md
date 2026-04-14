Iron Foundry — PostgreSQL Schema Reference

 This document describes every table in the migrated schema, all fields, all relationships,
 and how data flows between tables across all three services.

 ---
 Table of Contents

 1. #overview
 2. #users
 3. #events
 4. #coffer_events
 5. #membership_events
 6. #leaderboards
 7. #metrics
 8. #tickets
 9. #transcripts
 10. #survey_templates
 11. #survey_active
 12. #survey_responses
 13. #config
 14. #relationship-map
 15. #data-flow-chains
 16. #dropped

 ---
 Overview & Architecture {#overview}

 All three services (api-backend, discord-server, discord-utils) share one PostgreSQL database.
 The previous MongoDB schema had 35+ collections. The migrated schema has 13 tables.

 Key architectural decisions:
 - 15 MongoDB event log collections → 1 unified events table with a type discriminator column and data JSONB for type-specific fields
 - 7 per-guild config collections → 1 config table with (guild_id, key) primary key
 - 4 tables removed entirely (counters, service_cursors, loot_totals, collection_log_counts) — their data now lives on users or is derived at
 query time
 - user_keys and temp_vc_users merged into users — one row per user, no join needed
 - clan_name dropped from all event/aggregate tables — single-guild project
 - rank (in-game rank at time of event) dropped from all event rows — noisy, rarely used

 ---
 users {#users}

 Purpose: Central identity record for every registered clan member. This is the most referenced table in the system — nearly every other table
  relates back to it, either via discord_user_id (for Discord-identity data) or via rsn (for in-game activity data).

 Service ownership: Written by api-backend (OAuth login, RSN linking, privacy settings, key generation). Read by all services.

 CREATE TABLE users (
     -- Identity
     discord_user_id      BIGINT PRIMARY KEY,
     discord_username     TEXT    NOT NULL,
     guild_id             BIGINT  NOT NULL DEFAULT 0,

     -- OSRS profile
     rsn                  TEXT    UNIQUE,           -- nullable until user links their account
     clan_rank            TEXT,                     -- e.g. "Onyx", "Moderator" — backfilled from events on RSN link
     discord_roles        TEXT[]  NOT NULL DEFAULT '{}',  -- live Discord role names, updated on every login

     -- Aggregated stats (denormalised for fast reads)
     ticket_ids           INT[]   NOT NULL DEFAULT '{}',  -- sync'd from tickets on login
     total_loot_value     BIGINT  NOT NULL DEFAULT 0,     -- running total, incremented on each loot event
     clan_donated         BIGINT  NOT NULL DEFAULT 0,     -- running total, incremented on each coffer donation
     collection_log_slots     INT NOT NULL DEFAULT 0,     -- max observed, updated on each collection log event
     collection_log_slots_max INT NOT NULL DEFAULT 0,     -- total possible slots (e.g. 1508)
     stats_opt_out        BOOLEAN NOT NULL DEFAULT FALSE, -- if TRUE, events for this player are not stored

     -- API key (merged from user_keys collection)
     api_key              TEXT    UNIQUE,           -- RuneLite plugin authentication key
     key_is_active        BOOLEAN NOT NULL DEFAULT FALSE,
     key_created_at       TIMESTAMPTZ,
     key_expires_at       TIMESTAMPTZ,

     -- Temp voice channel preferences (merged from temp_vc_users collection)
     temp_vc_lock_status  TEXT,                     -- "locked" or "unlocked"
     temp_vc_member_limit INT,                      -- nullable = no limit set
     temp_vc_bitrate      INT,                      -- nullable = default bitrate

     -- Timestamps
     created_at           TIMESTAMPTZ NOT NULL,
     updated_at           TIMESTAMPTZ NOT NULL,

     CONSTRAINT users_rsn_unique UNIQUE NULLS NOT DISTINCT (rsn)
 );

 CREATE INDEX users_rsn_lower ON users (LOWER(rsn)) WHERE rsn IS NOT NULL;
 -- Used for case-insensitive RSN lookups (OSRS names are case-insensitive)

 CREATE INDEX users_guild ON users (guild_id, discord_user_id);
 -- Used when checking guild membership or listing all members

 Field notes:

 - rsn — RuneScape Name. Nullable until the user links their account via /members/settings. Once set, all historical events matching this name
  are backfilled into the denormalised stats fields. The UNIQUE NULLS NOT DISTINCT constraint means only one user may claim each RSN, but
 multiple users may have rsn = NULL.
 - discord_roles — refreshed on every OAuth2 login by calling the Discord bot API. Used for permission checks (hasMinRank(discord_roles,
 "Moderator")). Stored as a TEXT[] PostgreSQL array, queryable with = ANY(discord_roles).
 - total_loot_value — incremented in-place via ON CONFLICT DO UPDATE SET total_loot_value = users.total_loot_value + EXCLUDED.total_loot_value
  every time a loot event arrives. No separate loot_totals table needed.
 - clan_donated — same pattern, incremented on every coffer donation event where is_donation = TRUE.
 - collection_log_slots — updated via GREATEST() (takes the higher value), since the parser always sends the current total.
 - api_key — previously stored in a separate user_keys collection. Merged here since it's 1:1 with user. The RuneLite plugin authenticates
 with this key to submit clan chat events.
 - stats_opt_out — if TRUE, the event ingestion pipeline skips storing any events where this player appears. Checked before every INSERT into
 events, coffer_events, membership_events.

 Relationships:
 - discord_user_id is referenced by tickets.creator_id (the ticket creator)
 - rsn logically maps to events.player_name, coffer_events.player_name, membership_events.player_name, leaderboards.player_name — these are
 text joins, not enforced FK constraints (RSN can change via name changes, and events are immutable)

 ---
 events {#events}

 Purpose: Unified append-only log of all in-game clan broadcast events received from the RuneLite plugin via the POST /ccingest or WebSocket
 endpoints. Previously 15 separate MongoDB collections; consolidated into one table with a type discriminator and data JSONB for type-specific
  payload.

 Service ownership: Written exclusively by api-backend (ccdispatch router). Read by api-backend (member feed, recent achievements, clan
 stats). Never modified after insert.

 CREATE TABLE events (
     id              BIGSERIAL PRIMARY KEY,
     type            TEXT        NOT NULL,
     timestamp       TIMESTAMPTZ NOT NULL,
     player_name     TEXT,          -- NULL for "unknown" type only
     sender          TEXT,          -- player name as sent by the game client
     is_league_world BOOLEAN     NOT NULL DEFAULT FALSE,
     raw_message     TEXT,          -- full original broadcast string (kept for debugging/reprocessing)
     data            JSONB       NOT NULL DEFAULT '{}'
 );

 CREATE INDEX events_player_type ON events (player_name, type);
 -- Primary access pattern: "all loot events for player X"

 CREATE INDEX events_time ON events (timestamp DESC);
 -- Used for recent-achievements and member feed (time-sorted results)

 CREATE INDEX events_type ON events (type);
 -- Used for clan-wide aggregations filtered by type

 type values and corresponding data shape:

 ┌──────────────────┬────────────────────────────────────────────────┬───────────────────────────────────────────────────────────┐
 │       type       │                  data fields                   │                           Notes                           │
 ├──────────────────┼────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
 │ "loot"           │ item_name TEXT, coin_value BIGINT, source TEXT │ source is boss/activity name, nullable                    │
 ├──────────────────┼────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
 │ "level"          │ skill TEXT, new_level INT                      │ skill is e.g. "Hitpoints", "total" (total level)          │
 ├──────────────────┼────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
 │ "xp"             │ skill TEXT, xp BIGINT                          │ XP milestone broadcasts (every 5M XP)                     │
 ├──────────────────┼────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
 │ "achievement"    │ achievement_type TEXT, name TEXT               │ achievement_type: "quest", "diary", "combat_achievement"  │
 ├──────────────────┼────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
 │ "pet"            │ (empty)                                        │ No extra data — player_name is sufficient                 │
 ├──────────────────┼────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
 │ "member_join"    │ invited_by TEXT                                │ Who invited the player                                    │
 ├──────────────────┼────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
 │ "collection_log" │ item_name TEXT                                 │ Item that filled a new slot                               │
 ├──────────────────┼────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
 │ "loot_key"       │ coin_value BIGINT                              │ Value of loot key chest                                   │
 ├──────────────────┼────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
 │ "clue"           │ item_name TEXT, coin_value BIGINT              │ Clue scroll reward                                        │
 ├──────────────────┼────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
 │ "pk"             │ winner TEXT, loser TEXT, gp_exchanged BIGINT   │ PvP kill — player_name is NULL here; both parties in data │
 ├──────────────────┼────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
 │ "personal_best"  │ activity TEXT, time_seconds INT, variant TEXT  │ variant e.g. "solo", "duo", empty string if N/A           │
 ├──────────────────┼────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
 │ "hcim_death"     │ (empty)                                        │ Hardcore Ironman death notification                       │
 ├──────────────────┼────────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
 │ "unknown"        │ (empty)                                        │ Unrecognised broadcast — player_name is NULL              │
 └──────────────────┴────────────────────────────────────────────────┴───────────────────────────────────────────────────────────┘

 Access patterns:

 -- Member feed: all events for a specific player, newest first
 SELECT * FROM events
 WHERE player_name = $1
 ORDER BY timestamp DESC
 LIMIT $2;

 -- Recent achievements (clan home page): notable events across all players
 SELECT * FROM events
 WHERE type = 'loot' AND (data->>'coin_value')::BIGINT >= 2000000
    OR type = 'level' AND (data->>'new_level')::INT = 99
    OR type = 'level' AND data->>'skill' = 'total'
    OR type = 'xp'   AND (data->>'xp')::BIGINT % 5000000 = 0
 ORDER BY timestamp DESC
 LIMIT 20;

 -- RSN cascade (name change): update all events for old name
 UPDATE events SET player_name = $new WHERE player_name = $old;
 -- Also update pk winner/loser inside data JSONB:
 UPDATE events
 SET data = jsonb_set(data, '{winner}', to_jsonb($new::TEXT))
 WHERE type = 'pk' AND data->>'winner' = $old;

 Why JSONB instead of sparse columns?
 Each event type uses different fields. A sparse column approach would leave ~8 columns NULL per row. JSONB stores only the fields that exist,
  is indexed with GIN if needed, and allows schema-free extension when new broadcast types are added.

 ---
 coffer_events {#coffer_events}

 Purpose: Separate table for clan coffer deposits and withdrawals. Kept separate from events because coffer transactions have financial
 significance and may need independent querying, auditing, and aggregation. Also drives the users.clan_donated running total.

 Service ownership: Written by api-backend (ccdispatch). Read by api-backend (member feed, future coffer audit endpoints).

 CREATE TABLE coffer_events (
     id              BIGSERIAL   PRIMARY KEY,
     timestamp       TIMESTAMPTZ NOT NULL,
     player_name     TEXT        NOT NULL,
     sender          TEXT,
     is_league_world BOOLEAN     NOT NULL DEFAULT FALSE,
     raw_message     TEXT,
     amount          BIGINT      NOT NULL,
     is_donation     BOOLEAN     NOT NULL  -- TRUE = deposit, FALSE = withdrawal
 );

 CREATE INDEX coffer_events_player ON coffer_events (player_name);
 CREATE INDEX coffer_events_time   ON coffer_events (timestamp DESC);

 On every insert, if is_donation = TRUE, users.clan_donated is incremented:
 INSERT INTO users (discord_user_id, clan_donated) VALUES (...)
 ON CONFLICT (discord_user_id) DO UPDATE
   SET clan_donated = users.clan_donated + EXCLUDED.clan_donated;
 -- (looked up via rsn → discord_user_id join)

 ---
 membership_events {#membership_events}

 Purpose: Records when players join or leave the clan. Separate table because membership transitions are distinct operational events (useful
 for tracking churn, auditing expulsions) and don't belong in the general activity feed.

 Service ownership: Written by api-backend (ccdispatch). Read by api-backend and potentially discord-server for audit commands.

 CREATE TABLE membership_events (
     id              BIGSERIAL   PRIMARY KEY,
     timestamp       TIMESTAMPTZ NOT NULL,
     player_name     TEXT        NOT NULL,
     sender          TEXT,
     is_league_world BOOLEAN     NOT NULL DEFAULT FALSE,
     raw_message     TEXT,
     expelled_by     TEXT        -- NULL = left voluntarily; populated = expelled by this player
 );

 CREATE INDEX membership_events_player ON membership_events (player_name);
 CREATE INDEX membership_events_time   ON membership_events (timestamp DESC);

 ---
 leaderboards {#leaderboards}

 Purpose: Stores the best (lowest) recorded time per player per activity. Previously personal_bests. Updated via upsert with LEAST() — only
 improves, never worsens. Drives any future leaderboard UI.

 Service ownership: Written by api-backend (on each "personal_best" event). Read by api-backend.

 CREATE TABLE leaderboards (
     player_name  TEXT NOT NULL,
     activity     TEXT NOT NULL,   -- boss/activity name e.g. "Theatre of Blood"
     variant      TEXT NOT NULL DEFAULT '',  -- e.g. "solo", "duo", "" for no variant
     time_seconds INT  NOT NULL,
     PRIMARY KEY (player_name, activity, variant)
 );

 CREATE INDEX leaderboards_activity ON leaderboards (activity, time_seconds);
 -- Used to get top N players for a given activity

 Upsert pattern:
 INSERT INTO leaderboards (player_name, activity, variant, time_seconds)
 VALUES ($1, $2, $3, $4)
 ON CONFLICT (player_name, activity, variant) DO UPDATE
   SET time_seconds = LEAST(leaderboards.time_seconds, EXCLUDED.time_seconds);

 RSN cascade: When a player renames, UPDATE leaderboards SET player_name = $new WHERE player_name = $old.

 ---
 metrics {#metrics}

 Purpose: Flexible key-value store for fun/miscellaneous tracked stats that don't fit elsewhere. Currently tracks: longest spacebar check per
 guild, and could be extended to track any other named metric.

 Service ownership: Written by api-backend (main.py Discord chat subscriber). Read by api-backend.

 CREATE TABLE metrics (
     id           TEXT PRIMARY KEY,   -- namespaced key e.g. "spacebar_check"
     count        INT,
     total_value  BIGINT,
     achieved_at  TIMESTAMPTZ,
     last_updated TIMESTAMPTZ
 );

 guild_name dropped — single guild project, the id key is sufficient to namespace entries.

 ---
 tickets {#tickets}

 Purpose: Support and application tickets created by clan members via Discord. Core table for the ticket system. Written primarily by
 discord-server, read by both discord-server and api-backend (member tickets page, staff tickets page).

 Service ownership: Written by discord-server. Read by both discord-server and api-backend.

 CREATE TABLE tickets (
     ticket_id               SERIAL      PRIMARY KEY,  -- auto-increment (replaces MongoDB counters collection)
     guild_id                BIGINT      NOT NULL,
     ticket_type             TEXT        NOT NULL,
     -- Types: "general", "rankup", "join_cc", "apply_staff", "apply_mentor",
     --        "apply_event_team", "contact_mentor", "sensitive", "survey"

     status                  TEXT        NOT NULL DEFAULT 'open',
     -- Values: "open", "closed", "archived"

     created_at              TIMESTAMPTZ NOT NULL,
     closed_at               TIMESTAMPTZ,
     last_message_at         TIMESTAMPTZ,

     -- Discord channel where the ticket thread lives
     channel_id              BIGINT,

     -- Flattened from MongoDB's nested creator: {id, name}
     creator_id              BIGINT      NOT NULL,   -- Discord user ID of ticket opener
     creator_name            TEXT        NOT NULL,   -- Display name at time of creation

     -- Staff management
     assigned_staff          BIGINT[]    NOT NULL DEFAULT '{}',   -- Discord user IDs
     participants            BIGINT[]    NOT NULL DEFAULT '{}',   -- Everyone who sent a message
     closed_by_id            BIGINT,
     first_staff_response_at TIMESTAMPTZ,
     panel_message_id        BIGINT,                -- Discord message ID of the original panel embed

     -- Content
     staff_note              TEXT,                  -- Internal staff note, never shown to creator
     close_reason            TEXT,
     reopen_history          JSONB NOT NULL DEFAULT '[]'  -- array of {reopened_at: ISO string}
 );

 CREATE INDEX tickets_guild_status ON tickets (guild_id, status);
 CREATE INDEX tickets_creator      ON tickets (guild_id, creator_id);
 CREATE INDEX tickets_channel      ON tickets (channel_id);
 CREATE INDEX tickets_type         ON tickets (ticket_type);

 Relationships:
 - creator_id corresponds to users.discord_user_id — soft link (no enforced FK because Discord users can exist in the ticket system before
 registering on the web app)
 - ticket_id is referenced by transcripts.ticket_id (1:1), survey_responses.ticket_id (1:1), survey_active.ticket_id (optional reference)
 - users.ticket_ids stores an array of ticket_id values — synced on every login

 Permission model (api-backend):
 Each ticket_type has a minimum Discord role required to view it via the staff portal:
 - contact_mentor → Mentor+
 - general, rankup, join_cc → Moderator+
 - apply_staff, apply_mentor, apply_event_team, sensitive, survey → Senior Moderator+

 ---
 transcripts {#transcripts}

 Purpose: Full message-by-message history of a ticket channel, saved when the ticket is closed. Previously duplicated ticket_type, created_at,
  closed_at, close_reason, staff_note from the ticket document — those are now removed and fetched via JOIN.

 Service ownership: Written by discord-server (on ticket close). Read by api-backend (transcript viewer).

 CREATE TABLE transcripts (
     ticket_id INT PRIMARY KEY REFERENCES tickets(ticket_id) ON DELETE CASCADE,
     entries   JSONB NOT NULL DEFAULT '[]'
 );

 entries JSONB array element shape:
 {
   "message_id": 123456789,
   "author_id": 987654321,
   "author_display_name": "SomeName",
   "author_avatar_url": "https://cdn.discordapp.com/...",
   "author_is_bot": false,
   "content": "Hello, I'd like to apply for...",
   "timestamp": "2025-03-01T12:00:00Z",
   "attachments": [
     { "filename": "screenshot.png", "url": "https://...", "size": 12345, "content_type": "image/png" }
   ]
 }

 Why JSONB for entries instead of a normalised transcript_messages table?
 Transcript messages are always read as a complete blob (show all messages in order). They are never queried by individual field (no "find all
  messages by author X across all transcripts"). Normalising into rows would add a join and a potentially large table (100s of messages ×
 1000s of tickets = millions of rows) with no query benefit.

 Fetching a full transcript with ticket metadata:
 SELECT t.ticket_id, t.ticket_type, t.created_at, t.closed_at,
        t.close_reason, t.staff_note, tr.entries
 FROM transcripts tr
 JOIN tickets t ON t.ticket_id = tr.ticket_id
 WHERE tr.ticket_id = $1;

 ---
 survey_templates {#survey_templates}

 Purpose: Reusable survey/application form definitions. Each template contains an ordered list of questions with types (text, multiple choice,
  etc.). Used during ticket creation when ticket_type = "survey".

 Service ownership: Written by discord-server (staff commands). Read by discord-server.

 CREATE TABLE survey_templates (
     template_id TEXT        PRIMARY KEY,
     title       TEXT        NOT NULL,
     questions   JSONB       NOT NULL DEFAULT '[]',
     created_at  TIMESTAMPTZ
 );

 guild_id dropped — single-guild project, template_id is sufficient as primary key.

 questions JSONB array element shape:
 {
   "id": "q1",
   "text": "What is your total level?",
   "type": "text",        // "text" | "multiple_choice"
   "required": true,
   "options": []          // populated for multiple_choice type
 }

 Relationships:
 - Referenced by survey_responses.template_id
 - Referenced by survey_active.template_id

 ---
 survey_active {#survey_active}

 Purpose: Tracks which survey template is currently "active" (being answered by a member in a live ticket). Only one survey can be active at a
  time. Single-row table enforced by a fixed id = 1 primary key.

 Service ownership: Written and read by discord-server.

 CREATE TABLE survey_active (
     id          INT  PRIMARY KEY DEFAULT 1,  -- always 1, enforces single-row
     template_id TEXT NOT NULL REFERENCES survey_templates(template_id),
     ticket_id   INT  REFERENCES tickets(ticket_id),
     started_at  TIMESTAMPTZ
 );

 Pattern: Upsert replaces the single row when a new survey starts; delete clears it when done.

 ---
 survey_responses {#survey_responses}

 Purpose: Stores a member's answers to a survey, keyed by the ticket in which they were collected.

 Service ownership: Written by discord-server (step-by-step as member answers). Read by discord-server (staff review) and potentially
 api-backend (future staff survey results endpoint).

 CREATE TABLE survey_responses (
     ticket_id    INT  PRIMARY KEY REFERENCES tickets(ticket_id) ON DELETE CASCADE,
     template_id  TEXT NOT NULL REFERENCES survey_templates(template_id),
     responses    JSONB NOT NULL DEFAULT '{}',
     submitted_at TIMESTAMPTZ
 );

 CREATE INDEX survey_responses_template ON survey_responses (template_id);
 -- Used to retrieve all responses for a given template

 responses JSONB shape:
 {
   "q1": "2277",
   "q2": "Yes",
   "q3": ["Option A", "Option C"]
 }

 Keys are question id values from the template's questions array.

 Relationship chain:
 survey_responses.ticket_id → tickets.ticket_id
 survey_responses.template_id → survey_templates.template_id

 To get a survey result with full question text:
 SELECT st.title, st.questions, sr.responses, sr.submitted_at
 FROM survey_responses sr
 JOIN survey_templates st ON st.template_id = sr.template_id
 WHERE sr.ticket_id = $1;

 ---
 config {#config}

 Purpose: Single flexible table replacing 7 per-guild configuration collections. Each row is a named configuration blob for a guild. The value
  JSONB column holds the full config object — shape varies by key.

 Service ownership: Written by discord-server and discord-utils (admin commands). Read by all services.

 CREATE TABLE config (
     guild_id BIGINT NOT NULL,
     key      TEXT   NOT NULL,
     value    JSONB  NOT NULL DEFAULT '{}',
     PRIMARY KEY (guild_id, key)
 );

 Known key values and their value shape:

 ┌───────────────┬────────────────────┬────────────────────────────────────────────────────────────────────────────────────────────────────┐
 │      key      │      Replaces      │                                            value shape                                             │
 ├───────────────┼────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ "panel"       │ panel_config       │ {channel_id, message_id}                                                                           │
 ├───────────────┼────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ "ticket"      │ ticket_config      │ {rank_reqs_filename, rank_reqs_data (base64), rank_upgrades_filename, rank_upgrades_data (base64), │
 │               │                    │  join_text}                                                                                        │
 ├───────────────┼────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ "action_log"  │ action_log_config  │ {enabled, channel_id, ...settings}                                                                 │
 ├───────────────┼────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ "broadcast"   │ broadcast_config   │ {enabled, channel_id, ...settings}                                                                 │
 ├───────────────┼────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ "join_roles"  │ join_roles         │ {role_ids: [bigint], enabled}                                                                      │
 ├───────────────┼────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ "chat_events" │ chat_events_config │ {enabled, channel_id, ...settings}                                                                 │
 ├───────────────┼────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ "temp_vc"     │ temp_vc            │ {enabled, category_id, max_channels}                                                               │
 └───────────────┴────────────────────┴────────────────────────────────────────────────────────────────────────────────────────────────────┘

 Access pattern:
 -- Get panel config
 SELECT value FROM config WHERE guild_id = $1 AND key = 'panel';

 -- Upsert any config
 INSERT INTO config (guild_id, key, value) VALUES ($1, $2, $3)
 ON CONFLICT (guild_id, key) DO UPDATE SET value = EXCLUDED.value;

 Note on ticket_config image data: MongoDB stored binary BSON for rank requirement images. In PostgreSQL, image bytes would be stored as
 base64 inside the JSONB value, or alternatively as a BYTEA column in a separate ticket_images table. This can be decided at implementation
 time — base64 in JSONB is simpler but slightly larger.

 ---
 Relationship Map {#relationship-map}

 users (discord_user_id)
   │
   ├── events.player_name            [text match via rsn — not enforced FK]
   ├── coffer_events.player_name     [text match via rsn — not enforced FK]
   ├── membership_events.player_name [text match via rsn — not enforced FK]
   ├── leaderboards.player_name      [text match via rsn — not enforced FK]
   └── tickets.creator_id            [soft match — no enforced FK]

 tickets (ticket_id)
   ├── transcripts.ticket_id         [1:1, enforced FK, CASCADE DELETE]
   ├── survey_responses.ticket_id    [1:1, enforced FK, CASCADE DELETE]
   └── survey_active.ticket_id       [0:1, optional reference]

 survey_templates (template_id)
   ├── survey_responses.template_id  [enforced FK]
   └── survey_active.template_id     [enforced FK]

 config (guild_id, key)             [standalone — no FK relationships]
 metrics (id)                       [standalone — no FK relationships]

 Why are event table → users links not enforced FKs?
 events.player_name corresponds to users.rsn, but RSNs change over time (name changes). Event rows are immutable — a player who renames keeps
 all historical events under their new name via a cascade update (UPDATE events SET player_name = $new WHERE player_name = $old). Enforcing a
 FK would prevent this update pattern and would break if a player deletes their web account.

 ---
 Data Flow Chains {#data-flow-chains}

 1. User login (OAuth2)

 Browser → Discord OAuth2 → POST /auth/callback
   → Fetch Discord roles via Bot API
   → UPSERT users (discord_user_id, discord_username, discord_roles, updated_at)
   → SELECT ticket_id FROM tickets WHERE creator_id = discord_user_id
   → UPDATE users SET ticket_ids = [...] WHERE discord_user_id = ...
   → Issue JWT (sub=discord_user_id, username, avatar)
   → Redirect to /auth/callback?token=...

 2. RSN linking

 PATCH /members/me/rsn {rsn: "PlayerName"}
   → Validate format (1-12 chars, alphanumeric + space/hyphen/underscore)
   → SELECT FROM users WHERE LOWER(rsn) = LOWER($1) — check not claimed
   → UPDATE users SET rsn = $1
   → SELECT clan_rank FROM events WHERE player_name = $1 LIMIT 1
   → SELECT total_value FROM loot_totals ... [now: SUM coin_value from events]
   → SELECT log_slots FROM collection_log_counts ... [now: from users.collection_log_slots]
   → UPDATE users SET clan_rank=..., total_loot_value=..., collection_log_slots=...
   → SELECT ticket_id FROM tickets WHERE creator_id = discord_user_id
   → UPDATE users SET ticket_ids = [...]

 3. Clan chat event ingestion

 RuneLite plugin → POST /ccingest [{clan_name, sender, message, rank, ...}, ...]
   → Dedup check via Valkey (SHA256 hash, 5s TTL)
   → parser.classify(message) → BroadcastType
   → Check users.stats_opt_out for involved player names
   → If not opted out:
       → INSERT INTO events (type, timestamp, player_name, data, ...)
       → If type = "loot":
           → UPDATE users SET total_loot_value = total_loot_value + coin_value
             WHERE rsn = player_name  [ON CONFLICT DO UPDATE]
       → If type = "collection_log":
           → UPDATE users SET collection_log_slots = GREATEST(collection_log_slots, new_slots)
             WHERE rsn = player_name
       → If type = "personal_best":
           → INSERT INTO leaderboards ... ON CONFLICT DO UPDATE SET time_seconds = LEAST(...)
   → If type = "coffer" AND is_donation:
       → INSERT INTO coffer_events
       → UPDATE users SET clan_donated = clan_donated + amount WHERE rsn = player_name
   → If type = "membership":
       → INSERT INTO membership_events
   → Publish to Valkey stream "foundry:clan_events" for real-time WebSocket dispatch

 4. RSN name change (WOM service)

 Background task (every 30 min)
   → Poll Wise Old Man API for approved name changes (since in-memory last_id)
   → For each change:
       → SELECT discord_user_id FROM users WHERE rsn = old_name
       → If found: begin transaction
           → UPDATE users SET rsn = new_name
           → UPDATE events SET player_name = new_name WHERE player_name = old_name
           → UPDATE events SET data = jsonb_set(data, '{winner}', ...) WHERE type='pk' AND data->>'winner' = old_name
           → UPDATE events SET data = jsonb_set(data, '{loser}', ...) WHERE type='pk' AND data->>'loser' = old_name
           → UPDATE coffer_events SET player_name = new_name WHERE player_name = old_name
           → UPDATE membership_events SET player_name = new_name WHERE player_name = old_name
           → UPDATE leaderboards SET player_name = new_name WHERE player_name = old_name
           → COMMIT
   → Update in-memory last_id cursor

 5. Member activity feed

 GET /members/me/feed?limit=50
   → Get rsn from users WHERE discord_user_id = jwt.sub
   → SELECT * FROM events WHERE player_name = rsn ORDER BY timestamp DESC LIMIT 100
   → SELECT * FROM coffer_events WHERE player_name = rsn ORDER BY timestamp DESC LIMIT 50
   → Merge and sort by timestamp DESC
   → Return top $limit items

 6. Staff ticket access

 GET /staff/tickets
   → Get discord_roles from users WHERE discord_user_id = jwt.sub
   → Compute allowed_types = types where hasMinRank(discord_roles, type_min_rank)
   → SELECT * FROM tickets WHERE ticket_type = ANY($allowed_types) ORDER BY ticket_id DESC

 7. Ticket transcript (member view)

 GET /members/me/tickets/{ticket_id}/transcript
   → Verify: SELECT ticket_id FROM tickets WHERE ticket_id = $1 AND creator_id = jwt.sub
   → SELECT t.*, tr.entries FROM transcripts tr JOIN tickets t ON t.ticket_id = tr.ticket_id
     WHERE tr.ticket_id = $1
   → Return transcript (staff_note excluded from response)

 ---
 Dropped Collections & Why {#dropped}

 ┌───────────────────────┬─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
 │      Collection       │                                                 Reason dropped                                                  │
 ├───────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ user_keys             │ 1:1 with users — merged as columns on users                                                                     │
 ├───────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ loot_totals           │ Redundant — users.total_loot_value is the running total                                                         │
 ├───────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ collection_log_counts │ Redundant — users.collection_log_slots/max holds the same data                                                  │
 ├───────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ counters              │ PostgreSQL SERIAL / SEQUENCE is native — no simulation needed                                                   │
 ├───────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ service_cursors       │ WOM name-change cursor held in memory — updates are idempotent so losing cursor on restart just reprocesses a   │
 │                       │ few changes harmlessly                                                                                          │
 ├───────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ temp_vc_users         │ 1:1 with users per-guild — merged as columns on users                                                           │
 ├───────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ panel_config          │ → config table with key = "panel"                                                                               │
 ├───────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ ticket_config         │ → config table with key = "ticket"                                                                              │
 ├───────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ action_log_config     │ → config table with key = "action_log"                                                                          │
 ├───────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ broadcast_config      │ → config table with key = "broadcast"                                                                           │
 ├───────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ join_roles            │ → config table with key = "join_roles"                                                                          │
 ├───────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ chat_events_config    │ → config table with key = "chat_events"                                                                         │
 ├───────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ temp_vc               │ → config table with key = "temp_vc"                                                                             │
 ├───────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ 15 event collections  │ Unified into events table with type discriminator + data JSONB                                                  │
 └───────────────────────┴─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌