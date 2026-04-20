# Privacy Policy - The Iron Foundry Project

**Last updated:** 2026-04-20

---

## 1. Overview

The Iron Foundry Project is a community platform for the Iron Foundry OSRS clan. It consists of a Discord bot, a REST API backend, a web frontend, and supporting utilities. This document describes what personal data these services collect, why, where it is stored, and what controls members have over their data.

---

## 2. What Data We Collect

### 2.1 Discord Account Data

| Field | Description |
|---|---|
| `discord_user_id` | Your Discord user snowflake ID |
| `discord_username` | Your Discord display name |
| `discord_avatar_url` | URL to your Discord avatar |
| `discord_roles` | Your roles in the Iron Foundry Discord server |

**Source:** Discord OAuth2 login flow
**Storage:** `users` table (PostgreSQL)
**Why:** User identity, authentication, and permission management across services

---

### 2.2 RuneScape / In-Game Identity

| Field | Description |
|---|---|
| `rsn` | Your RuneScape Name |
| `clan_rank` | Your current rank in the clan |
| `join_date` | Date you joined the clan |

**Source:** Linked manually by staff or via RuneLite plugin ingestion
**Storage:** `users` table
**Why:** Clan membership management and roster tracking

---

### 2.3 Gameplay Statistics

| Field | Description |
|---|---|
| `total_loot_value` | Cumulative loot value tracked by the plugin |
| `clan_donated` | Total value donated to the clan coffer |
| `collection_log_slots` | Number of collection log slots obtained |
| `collection_log_slots_max` | Total possible collection log slots |

**Source:** TrackScape RuneLite plugin via the `/ccingest` API endpoint
**Storage:** `users` table and `events` table
**Why:** Clan leaderboards and activity feeds
**User control:** A `stats_opt_out` flag disables all loot, donation, and collection log tracking. Set it via `/privacy` in Discord or the web account page.

---

### 2.4 Clan Chat Messages

| Field | Description |
|---|---|
| `player_name` | In-game name of the acting player |
| `sender` | In-game name of the message sender |
| `raw_message` | Raw clan chat message text |
| `timestamp` | When the event occurred |
| `is_league_world` | Whether the event originated in a League world |
| Parsed event data | Structured JSONB payload (drops, donations, joins, etc.) |

**Source:** In-game clan chat, captured and pushed by the RuneLite plugin
**Storage:**
- `events` table - general clan events (indefinite)
- `coffer_events` table - coffer deposit/withdrawal events (indefinite)
- `membership_events` table - join/leave events (indefinite)
- Transiently relayed via Valkey pub/sub on `foundry:clan_events` and `foundry:discord_chat` channels; events are deduplicated with a 30-second TTL and are not persisted in Valkey

**Why:** Activity feed display, stats ingestion, and Discord relay

---

### 2.5 Support Ticket Data

**Ticket metadata:**

| Field | Description |
|---|---|
| `type` | Category of the ticket |
| `creator_id` / `creator_name` | Discord ID and name of the ticket opener |
| `assigned_staff` | Staff member handling the ticket |
| `status` | Current ticket state |
| `timestamps` | Open, update, and close times |
| `staff_notes` | Internal notes added by staff |
| `close_reason` | Reason recorded when ticket is closed |

**Ticket transcripts:**

| Field | Description |
|---|---|
| `author_id` / `author_name` | Discord ID and name of each message author |
| `message content` | Full text of each message |
| `attachments` | Attached files |
| `embeds` | Embed data (JSONB) |

**Application/survey responses:**

| Field | Description |
|---|---|
| `answers` | Responses to application or survey questions (JSONB) |

**Storage:** `tickets`, `transcripts`, and `survey_responses` tables (indefinite)
**Why:** Staff workflow, audit trail, dispute resolution
**Access control:** Sensitive ticket types (e.g. ban appeals, staff applications) are restricted to Senior Staff and Owners. Staff notes are never shown to ticket creators.

---

### 2.6 Web Survey Submissions

| Field | Description |
|---|---|
| `discord_user_id` | Submitter's Discord ID |
| `answers` | Survey responses (JSONB) |
| `submitted_at` | Submission timestamp |

**Storage:** `web_survey_submissions` table (indefinite)
**Why:** Community feedback collection

---

### 2.7 Content Authorship and Edit History

**Guides and plugin entries:**

| Field | Description |
|---|---|
| Author `discord_user_id` | Creator of a content entry |
| Collaborator `discord_user_id` | Co-authors on a content entry |

**Version history (per revision):**

| Field | Description |
|---|---|
| `title` | Title snapshot at time of edit |
| `body` | Full content snapshot at time of edit |
| `edited_by` | Discord user ID of the editor |
| `timestamp` | When the edit was made |

**Uploaded assets:**

| Field | Description |
|---|---|
| `filename` | Asset filename |
| `size_bytes` | File size |
| `content_type` | MIME type |
| `uploaded_by` | Discord user ID of uploader |

**Storage:** `content_entries`, `content_collaborators`, `content_entry_versions`, and `assets` tables (indefinite)
**Why:** Content attribution, moderation, and revision history

---

### 2.8 Server Audit Log

The Discord bot logs the following server events to a dedicated Discord forum channel. These logs are embeds stored in Discord and are subject to Discord's own data retention policies.

- Message edits (before and after content) and deletions
- Member joins and leaves (including account creation date and roles held at departure)
- Nickname and role changes
- Moderation actions: bans, timeouts, AutoMod triggers (including matched content and triggering keyword)
- Channel, role, and invite creation, modification, and deletion

**Storage:** Discord forum threads (embeds) - retained per Discord's policies
**Why:** Server moderation and accountability

---

### 2.9 Voice Channel Preferences

| Field | Description |
|---|---|
| `temp_vc_lock_status` | Whether the user's temporary VC is locked |
| `temp_vc_member_limit` | Member limit set for the temporary VC |
| `temp_vc_bitrate` | Bitrate set for the temporary VC |
| VC whitelist | List of member IDs allowed into a private temporary VC |

**Storage:** `users` table and `temp_vc_user_settings` table
**Why:** Persistent preferences for user-managed temporary voice channels

---

### 2.10 Authentication Tokens and API Keys

| Item | Details |
|---|---|
| JWT (web session) | Stored in browser `localStorage`. Contains `discord_user_id`, username, and avatar URL. Expires after 30 days. |
| API key | Stored (hashed) in `users` table. Used by external integrations such as the RuneLite plugin. |

**Why:** Secure authentication for the web app and external API access
**User control:** Generate or revoke your API key via `/userkey` in Discord or the web account page.

---

### 2.11 Badges

| Field | Description |
|---|---|
| `badge_id` | Identifier of the awarded badge |
| `discord_user_id` | Recipient |
| `assigned_at` | Date and time of award |
| `assigned_by` | Discord user ID of the staff member who assigned the badge |

**Storage:** `badges` and `user_badges` tables (indefinite)
**Why:** Community recognition and profile display

---

## 3. Third-Party Services

| Service | Purpose | Data Shared |
|---|---|---|
| Discord OAuth2 | Login and authentication | Redirect only. Discord returns your user ID, username, avatar, and guild membership. |
| WiseOldMan API | Clan leaderboard statistics | Clan group ID only - no personal data is sent. |
| TrackScape / RuneLite plugin | In-game event ingestion | Clan chat events are pushed to our `/ccingest` endpoint by the plugin running on your client. |

No third-party analytics, advertising networks, or data brokers are used.

---

## 4. User Controls

| Control | How to use |
|---|---|
| **Stats opt-out** | Disables loot, donation, and collection log tracking. Use `/privacy` in Discord or the web account page. |
| **Presence notifications** | Hide your voice channel connect/disconnect notices from the activity feed. Toggle in web account settings. |
| **API key** | Generate or revoke your personal API key via `/userkey` in Discord or the web account page. |
| **Account deletion** | No self-service deletion UI is currently available. Contact a staff member to request removal of your data. |

---

## 5. Data Retention

| Data Category | Retention Period |
|---|---|
| User profiles | Indefinite (until a deletion request is fulfilled) |
| Game events and clan chat | Indefinite |
| Ticket transcripts and notes | Indefinite |
| Survey and application responses | Indefinite |
| Content version history | Indefinite |
| Server audit log | Subject to Discord's retention policy |
| JWT tokens | 30 days (browser `localStorage` only) |
| Event dedup cache (Valkey) | 30 seconds |

---

## 6. Infrastructure and Security

- **Primary data store:** Self-hosted PostgreSQL
- **Transient cache:** Self-hosted Valkey (in-memory, not persisted to disk)
- **File assets:** Stored on server disk
- **No third-party analytics** or advertising of any kind
- **No data sold or shared** with third parties.

---

## 7. Contact

For data requests, deletion requests, or questions about this policy, contact staff via a support ticket in the Iron Foundry Discord server.
