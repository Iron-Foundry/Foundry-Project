# Music Bots - Design Document

Multi-bot music playback for the Iron Foundry Discord, orchestrated by `discord-utils`, with deep web control
and clan-level listening stats. Up to 5 player bots serve up to 5 voice channels at once. Users interact with a
single command set and a Components V2 panel that lives in each voice channel's own integrated text chat.

Reference implementation studied: `D:\claude-git-references\vocard-repo` (ChocoMeow/Vocard). We deliberately
diverge from it on three axes: multi-bot support, deep web control, and history/stats. Vocard has none of the
three.

---

## Delivery Stages

Progress tracker. Update the Status column in the same change that completes the work.

| # | Stage | Scope | Status |
|---|---|---|---|
| 0 | [Facts and spike](#stage-0---facts-and-spike) | Resolve every unverified assumption before product code | Done - U1, U2, U3, U5 promoted from server/library source and official docs; U4 amended away |
| 1 | [Infrastructure and config](#stage-1---infrastructure-and-config) | Lavalink container, plugins, secrets, env propagation | Done - node healthy, both plugins loaded, U1r spike 10/10 |
| 2 | [Bot pool](#stage-2---bot-pool) | Lazy client start/stop, Valkey lease, name roll, orphan sweep | Done - 12 fast + 13 integration tests green |
| 3 | [Playback core](#stage-3---playback-core) | Lavalink player, queue, transport controls, idle teardown | Done - 22 fast + 54 integration tests green |
| 4 | [Components V2 panel](#stage-4---components-v2-panel) | VC text-chat panel, buttons, selects, modals, activity feed | Built - 46 fast + 59 integration green; live round-trip pending |
| 5 | [Slash commands](#stage-5---slash-commands) | Command surface, help registry, service wiring | Built - 68 fast + 59 integration green; live sync pending |
| 6 | [Playlists](#stage-6---playlists) | api-backend tables, CRUD router, public/private, `/playlist` + panel button, contract regen | Built - 20 fast (api) + 21 integration + 18 fast (utils) green; live round-trip pending |
| 7 | [Web control](#stage-7---web-control) | Command bridge, live state WS, track search, web session + playlist UI at parity with Discord | Built - 37 fast + 10 integration (api), 43 fast (utils), 15 discord_e2e + 3 Playwright green; live round-trip pending |
| 8 | [Clan stats](#stage-8---clan-stats) | Anonymous counters, rollups, stats page, session history | Built - 23 fast + 10 integration (api), 10 fast + 8 integration (utils), 8 web, 4 discord_e2e written. Full lint/fast/integration/e2e last ran green **before** the consumer's connection fix and the `music_stream`/`music_identity` split; only api-backend lint, pyright and its 573 fast tests have run since. Re-run `./run-tests.sh` before trusting the stage. |

No stage may start while an earlier stage has unresolved exit criteria. Stage 0 gates everything.

---

## Established Facts

Every architectural claim below is backed by a citation. Nothing in this document is inferred from recall.

| Fact | Evidence |
|---|---|
| A bot holds at most one voice connection per guild, so 5 bots is the hard concurrency cap | `Guild.voice_client -> Optional[VoiceProtocol]`, `discord.py/discord/guild.py:743` |
| A voice channel is directly messageable, so the panel can live in its integrated text chat | `class VocalGuildChannel(discord.abc.Messageable, discord.abc.Connectable, discord.abc.GuildChannel, Hashable)`, `discord.py/discord/channel.py:1074` |
| Components V2 views cap at 40 children and 4000 display characters | `discord.py/discord/ui/view.py:844`, `:892` |
| discord.py sets the `components_v2` message flag automatically from the view, and performs no validation against `content`/`embeds` | `discord.py/discord/http.py:197-205`; `content` and `embeds` are added to the same payload unconditionally at `:180-195` |
| A Lavalink websocket connection carries a `User-Id` header, "The user id of the bot", and the server returns a per-connection `sessionId` in the ready op | <https://lavalink.dev/api/websocket.html>; Vocard sends it at `voicelink/pool.py:110` and stores `sessionId` at `:236` |
| **One Lavalink node serves several distinct bot identities with fully independent players.** The server holds one `SocketContext` per websocket connection, keyed by a freshly generated `sessionId`, never by `User-Id`. Each context takes its own `userId` and owns its own player map, so the same guild id in two contexts is two unrelated players | `Lavalink/LavalinkServer/.../io/SocketServer.kt`: `override val sessions = ConcurrentHashMap<String, SocketContext>()` and `sessionId = generateUniqueSessionId(); sessions[sessionId] = socketContext`. `SocketContext.kt`: constructor takes `override val userId: Long`, and `override val players = ConcurrentHashMap<Long, LavalinkPlayer>()` is an instance field, not in a companion object |
| wavelink is instance-scoped where it matters: each `Node` holds its own `_client`, its own `_players: dict[int, Player]` keyed by guild id, and sends `"User-Id": str(self.client.user.id)`. `Pool.__nodes` is a class-level `ClassVar[dict[str, Node]]` but is only an identifier registry, and rejects a duplicate identifier | wavelink 3.5.2 `wavelink/node.py`: `Node.__init__(..., identifier=None, uri, password, client=None, ...)`, `self._players: dict[int, Player] = {}`, `get_player`, the `headers` property, and the `if node.identifier in cls.__nodes` guard in `Pool.connect` |
| **wavelink node selection is client-blind.** `Pool.get_node()` with no identifier returns the CONNECTED node with the fewest players, filtering on status only, never on client. `Player.__init__(self, client, channel, *, nodes=None)` falls back to `Pool.get_node()` when `nodes` is omitted. Therefore every player must be built with an explicit `nodes=[that bot's node]` or it can be handed another bot's node | wavelink `node.py` `Pool.get_node`, `player.py` `Player.__init__` |
| `Connectable.connect` types `cls` as `Callable[[Client, Connectable], T]`, calls it as `cls(client, self)`, and only then asserts `isinstance(voice, VoiceProtocol)`. A `functools.partial(Player, nodes=[node])` is therefore a legal `cls` | `discord.py/discord/abc.py:2091`, `:2144`, `:2146` |
| `connect` derives the client from the channel's own connection state, so a player bot can only be connected through a channel object taken from THAT bot's cache, not the orchestrator's | `client = state._get_client()`, `discord.py/discord/abc.py:2143`, with `state = self._state` at `:2138` |
| `IS_COMPONENTS_V2` is `1 << 15`. With it set, "The `content` and `embeds` fields will no longer work", `poll` and `stickers` are disabled, and attachments must be exposed through components. "Once a message has been sent with this flag, it can't be removed from that message" | <https://docs.discord.com/developers/components/reference> |
| The 40-component and 4000-character caps are API-level, not just discord.py: "Messages allow up to 40 total components"; Text Display `content` maxes at 4000 characters | same |
| Posting in a voice channel's integrated text chat needs only `VIEW_CHANNEL` and `SEND_MESSAGES`; both list channel type `V` in the permissions table, alongside `READ_MESSAGE_HISTORY` and `USE_APPLICATION_COMMANDS`. There is no separate text-in-voice permission | <https://docs.discord.com/developers/topics/permissions> |
| Lavalink resolves plugins declaratively from Maven, so no jar is ever handled by hand: `plugins: [- dependency: "group:artifact:version", repository: "...", snapshot: false]`, with `pluginsDir` defaulting to `./plugins` | <https://lavalink.dev/configuration/config/file.html> |
| youtube-source is `dev.lavalink.youtube:youtube-plugin` from `https://maven.lavalink.dev/releases`, and its setup states "You must make sure to disable the built-in YouTube source like so: `sources: youtube: false`" | <https://github.com/lavalink-devs/youtube-source> README |
| LavaSrc is `com.github.topi314.lavasrc:lavasrc-plugin` from the same repository, and every source under `plugins.lavasrc.sources` defaults to `false` | <https://github.com/topi314/LavaSrc> README |
| Pinned versions as of 2026-07-28: Lavalink `4.2.2`, youtube-plugin `1.18.2`, lavasrc-plugin `4.8.3`, wavelink `3.5.2` (requires `discord.py>=2.7.0`, Python `>=3.10`, both satisfied) | GitHub latest-release API for the three repos; <https://pypi.org/pypi/wavelink/json> |
| Official image is `ghcr.io/lavalink-devs/lavalink:4-alpine`, runs as uid/gid `322`, and expects `application.yml` and `plugins/` mounted into `/opt/Lavalink/` on port `2333` | <https://lavalink.dev/getting-started/docker.html> |
| **U1r confirmed at runtime.** Two websockets to one node with `User-Id` `111...` and `222...` each got a ready op with a distinct `sessionId` (`hpoods82iogme3mv` vs `ruptqno8zgyzxogd`) | Spike run against the live 4.2.2 node, 2026-07-28 |
| **Player isolation confirmed at runtime.** A player created under session A for a guild id was visible only to A: `GET /v4/sessions/{A}/players` returned 1 with its own `volume: 42`, `GET /v4/sessions/{B}/players` returned 0 for the same guild | same spike |
| All three sources resolve through the configured plugin chain: `ytsearch:` and `scsearch:` and `spsearch:` each returned `loadType=search` with correct metadata, which also proves the Spotify client credentials authenticate | same spike |
| The node loads both plugins cleanly and reports `YouTube source initialised with clients: WEB_REMIX, ANDROID_VR, WEB, WEB_EMBEDDED_PLAYER` plus `Registering Spotify audio source manager...` | `docker compose logs lavalink`, 2026-07-28 |
| LavaSrc cannot play Spotify audio. It mirrors: "the process of taking the metadata resolved from one source and using it to retrieve a playable `AudioTrack` from another" | <https://github.com/topi314/LavaSrc> README |
| LavaSrc's default provider chain is ISRC-first: `ytsearch:"%ISRC%"` then `ytsearch:%QUERY%` | LavaSrc README, `providers` config |
| **Server-side mirroring is opaque to the client.** LavaSrc resolves the mirror inside `MirroringAudioTrack.process()` at playback time and calls `processDelegate(internalTrack, executor)` on the result. The delegate is never surfaced through the REST or websocket API - the only trace is a `log.debug("Loaded track mirror from {} ...")` line on the server. The track Lavalink reports playing stays the Spotify one, so `played_source` cannot be read back from Lavalink and must be resolved client-side | `LavaSrc/main/src/main/java/com/github/topi314/lavasrc/mirror/MirroringAudioTrack.java:43-58` |
| `Playable.search(query, *, source, node)` accepts an explicit node and forwards it to `Pool.fetch_tracks(term, node=node)`, so a search can be pinned to one bot's node rather than the Pool's client-blind pick | wavelink 3.5.2 `tracks.py:327-329`, `:419`, `:428` |
| With `AutoPlayMode.disabled` - which is `Player.__init__`'s default - `_auto_play_event` starts the inactivity timer and returns before touching either queue. wavelink's own queue therefore never competes with an external one | wavelink `player.py:157`, `:266-268` |
| wavelink fires `wavelink_inactive_player` on the node's client after `inactive_player_timeout` seconds without playback, and separately when `inactive_channel_tokens` reaches zero at a track end with no non-bot members in the channel | wavelink `player.py:196-224`, `:251-264`; events dispatched via `self.node.client.dispatch(f"wavelink_{event}", ...)` at `websocket.py:289-292` |
| **Nothing starts the idle timer on connect.** `_inactivity_start` is only reached from a track end, from `_do_partial`, from the autoplay paths, and from the `inactive_timeout` setter, which starts it when the player is connected and not playing. A player that connects and never plays therefore has no idle timer at all, and `player.connected` is already `True` when `connect()` returns, so assigning the setter after connecting is what arms it | wavelink `player.py:243-247` (call sites at `:267`, `:275`, `:294`, `:310`, `:334`, `:416`, `:447`, `:622`), setter at `:608-622`, `_connected = True` before `_connection_event.set()` at `:809-810` |
| wavelink discards Lavalink's load type: `loadType == "track"` and `loadType == "search"` both return `list[Playable]`. Since a link resolves to exactly one track, a list longer than one is exactly a search with alternatives | wavelink `node.py:960-974` |
| Spotify resolution needs `clientId` + `clientSecret` (plus optional `spDc` for lyrics, `countryCode`) | LavaSrc README config table |
| Lavalink v4 still contains a built-in YouTube source; the `youtube-source` plugin replaces it and its setup instructs you to disable the built-in one | <https://github.com/lavalink-devs/youtube-source> README |
| YouTube oauth and `poToken` are both explicitly "NOT a silver bullet"; oauth setup advises burner accounts, never a primary account | youtube-source README |
| Lavalink loads every `.jar` placed in its `plugins` directory | <https://lavalink.dev/plugins.html> |
| Design docs live in `designs/` with a row in `designs/README.md` | `designs/README.md:5-14` |
| Feature data files are TOML under `<feature>/data/` | `discord-utils/chat_events/data/bosses.toml`, `skills.toml` |
| Valkey stream + consumer group + `SET nx` dedup is the established cross-service event pattern | `discord-utils/chat_events/service.py` (`xgroup_create`, `xreadgroup`, `xack`, `DEDUP_TTL_SECONDS`) |
| Components V2 helper pattern to port | `discord-server/features/tickets/views/_layout_helpers.py` |
| Every service subclasses `Service` with `initialize()` and optional `post_ready()` | `discord-utils/core/service_base.py:10-39` |

## Unverified Assumptions

These are NOT facts. Each is a Stage 0 task with a defined test. No product code depends on any of them until
its row is resolved and moved into Established Facts.

U1, U2, U3 and U5 were promoted into Established Facts above from Lavalink server source, wavelink source,
discord.py source, and the official Discord component/permission references. U4 was dissolved by removing the
design's dependency on it. What is left:

| # | Assumption | How to establish |
|---|---|---|
| U6 | Home-network hosting avoids YouTube IP blocking | Per owner decision, treated as fine until observed otherwise. No oauth or `poToken` configured initially. Revisit only on real failures. |

U1r was confirmed against the live node on 2026-07-28 and promoted - see the last four rows of Established
Facts. U6 is the only assumption left, and it is a deferral the owner chose, not an open question.

U4 resolution: Discord publishes no per-route limit for nickname edits, so the design no longer relies on one.
A name is rolled exactly once per session, never re-rolled, and discord.py's HTTP layer already handles `429`
with backoff. Avatars stay deferred and default.

---

## Architecture

```
user  --/play-->  discord-utils orchestrator (existing bot)
                    |- resolve caller's voice channel
                    |- session exists?  route to its bot
                    |- else lease a free bot  (Valkey SET nx)
                    |     |- roll nickname, start client lazily
                    |     |- connect to VC, open Lavalink session
                    |- panel posted in that VC's integrated text chat
                    |- state -> Valkey; counters -> api-backend

web  --REST/WS-->  api-backend  --Valkey pubsub-->  discord-utils bridge
```

The orchestrator is the existing `discord-utils` bot and the only one with a command tree. The 5 player bots are
separate Discord applications that need only Connect and Speak. They are `discord.Client` instances started
lazily in the same process via `asyncio.create_task(client.start(token))`, which is what makes "start as called
upon" cheap. Separate containers would require Docker API calls to achieve the same thing.

### State ownership

Session-shaped state is ephemeral by design. It exists only while a bot is active and dies with the session.

```
Valkey (ephemeral, TTL, dies with session)
  music:session:{vc_id}     hash  bot_index, nickname, track, position, volume, loop, filters
  music:queue:{vc_id}       list  upcoming tracks
  music:activity:{vc_id}    list  capped ring buffer of interactions, rendered live
  music:lease:{bot_index}   str   SET nx bot lease
  music:names               set   nicknames currently in play
  music:voice:{vc_id}       set   live member ids, the authz source
  music:state               pubsub  live state fanout to api-backend

Postgres via api-backend (durable)
  playlists            id, owner_id, name, is_public, created_at, updated_at
  playlist_tracks      playlist_id, position, isrc, source, identifier, title, author, duration_ms
  music_counters       guild_id, day, ms_listened, tracks_played, skips, sessions, sources jsonb
  music_track_plays    isrc_or_hash, title, author, play_count, skip_count, last_played_at
```

No user id is ever persisted. That closes the privacy question and removes any retention policy: Valkey TTL is
the retention. It is also a one-way door. Per-user leaderboards and any "Wrapped" view are impossible later,
including retroactively. A `music_user_minutes(user_id, day, ms)` table would be additive if that changes.

`music_track_plays` keys on ISRC where available, falling back to a normalized `title|author|duration_bucket`
hash. This matters because LavaSrc resolves Spotify requests to YouTube audio, so the same song arrives under
different source identifiers depending on how each person queued it. Without ISRC keying, "top tracks" splits.
Store `requested_source` and `played_source` separately in the live session for the same reason.

### Control authority

Anyone connected to the voice channel controls it, enforced identically on both surfaces from one source:

- Discord callback: `interaction.user.id in vc.voice_states`
- Web write: JWT -> discord id -> `SISMEMBER music:voice:{vc_id}`

`music:voice:{vc_id}` is maintained from `on_voice_state_update`, which also drives idle teardown.

### Permissions

The guild has role-gated voice channels, so an invite bitmask alone is not enough. Channel overwrites are
evaluated on top of guild-level role permissions and win: `permissions_for` applies the `@everyone` overwrite,
then role overwrites, then member overwrites over the guild base (`discord.py/discord/abc.py:844-870`). The only
bypass is guild-level Administrator, which short-circuits to `Permissions.all()` before any overwrite is read
(`:841-842`), and 5 bot tokens with Administrator is not a trade we are making.

All 5 player bots therefore share one **Music Bot** role, and that role is added to the overwrites of every
gated voice channel and to the temp VC category. Invite bitmask `19923968`:

| Permission | Bit | Why |
|---|---|---|
| View Channel | `1 << 10` | Required to join a voice channel at all, not just to read text. `VIEW_CHANNEL` lists channel type `V`. |
| Connect | `1 << 20` | Join the voice channel. |
| Speak | `1 << 21` | Transmit audio. |
| Move Members | `1 << 24` | Bypass a full channel. `temp_vc/events.py:49` lets a user set a limit as low as 1, which would otherwise refuse the bot. The music code never moves or disconnects anyone. |

Nothing text-related: the panel is posted by the orchestrator, which already has its own permissions.

Two consequences of the overwrite algebra worth keeping in mind:

- **Category inheritance carries the role.** `temp_vc/service.py:181-186` creates channels with a `category` and
  no explicit `overwrites`, so a new temp VC syncs to its category. Allowing Music Bot once on the temp VC
  category covers every channel created afterwards.
- **Private temp VCs still work.** `apply_channel_privacy` denies `connect` to `@everyone`
  (`temp_vc/service.py:278`), but that is the `@everyone` tier, applied before role overwrites, and
  `handle_overwrite` is `base & ~denied | allowed` (`permissions.py:490-502`), so an explicit Music Bot allow
  beats it. A bot only ever joins when someone already inside the channel asks it to.

### Bot identity

Nickname is rolled randomly per session from the two word lists in `music/data/names.toml`, which has landed:
139 OSRS words (bosses, gods, slayer monsters, characters, places, creatures) and 76 music words, giving 10,564
combinations. Draw without replacement against `music:names` so two live bots never share a name. Longest
possible pair is `Pollnivneach Distortion` at 23 of Discord's 32 characters, and `names.py` asserts the whole
cross product at load so nothing silently truncates. Never persist a rolled name; per-bot stats, if ever
wanted, key on `bot_index`. Avatars are deferred and stay default for now.

### Module layout

`discord-utils/music/`, 150 LOC cap per file per project convention.

| File | Holds |
|---|---|
| `models.py` | `Track`, `LoopMode`, `LeasedBot`, `PoolSlot` pydantic models |
| `keys.py` | every Valkey key template and the session TTL, in one place |
| `names.py` | list loading, random draw without replacement, 32-char assertion |
| `pool.py` | `BotPool`: lease, lazy start/stop, nickname roll, orphan sweep |
| `client.py` | `PlayerClient`: the thin player bot and its wavelink event hooks |
| `nodes.py` | one node per bot, and the node-bound `Player` factory |
| `resolve.py` | query to tracks, and track to playable audio (mirror chain) |
| `queue.py` | the Valkey list queue for one channel |
| `state.py` | current track, volume and loop, in the session hash |
| `activity.py` | capped per-session interaction feed |
| `voice.py` | the listener roster, which is also the authz source |
| `stats.py` | counter events onto the Valkey stream |
| `session.py` | `MusicSession`: playback and transport for one channel |
| `manager.py` | `SessionManager`: opens, routes and tears down sessions |
| `events.py` | orchestrator voice-state and channel-delete listeners |
| `service.py` | `MusicService(Service)`: `initialize`/`post_ready`, wiring |
| `commands.py` | slash commands on the orchestrator tree |
| `views.py` | Components V2 panel and secondary views |
| `bridge.py` | `CommandBridge`: web commands in off `music:commands` |
| `notify.py` | state notices out onto `music:state` |
| `dispatch.py` | one command to the transport call it names |
| `connect.py` | resolving the player bot's own channel, and its nickname |
| `node_cache.py` | the node held per leased bot |
| `data/names.toml` | the two word lists |

---

## Stage 0 - Facts and spike

**Done.** Resolved by reading source and official references rather than by running a spike, which is stronger
evidence and cost nothing.

- U1: read Lavalink's own `SocketServer.kt` and `SocketContext.kt`. Sessions are keyed by a generated
  `sessionId`, and the player map is a per-`SocketContext` instance field. One node, many bot identities.
- U2: read wavelink 3.5.2 `node.py` and `player.py`. Instance-scoped per `Node`, and it exposes the exact seam
  needed. It also revealed a trap that a runtime spike would probably have missed until it misfired in
  production - see the client-layer rules below.
- U3: the Discord component reference states plainly that `content` and `embeds` stop working under the flag,
  and that the flag cannot be removed from a message once sent.
- U5: the permissions table lists channel type `V` for `VIEW_CHANNEL` and `SEND_MESSAGES`. Nothing special is
  needed.
- U4: dissolved. The design no longer depends on nickname rate limits.

Two runtime checks moved into Stage 1 exit criteria, where a live stack exists anyway: U1r, and one panel post
into a voice channel's text chat by a non-administrator bot.

### Client-layer rules these facts impose

Non-negotiable, because each one is a silent-misroute bug rather than an error:

1. One `wavelink.Node` per player bot, distinct `identifier`, all pointing at the same node URI, each
   constructed with `client=<that bot>`.
2. Never let a player pick its own node. Connect with
   `functools.partial(wavelink.Player, nodes=[own_node])` as the `cls`, because bare `Pool.get_node()` sorts by
   player count and ignores which client a node belongs to.
3. Resolve the voice channel object from the player bot's own cache before connecting. `Connectable.connect`
   reads the client out of the channel's connection state, so an orchestrator-owned channel object would
   connect the orchestrator.
4. A panel message is components-v2 only. No `content`, no `embed`, ever, on send or edit - the flag is
   permanent on that message.

## Stage 1 - Infrastructure and config

- `lavalink` service in `docker-compose.yml` on the `foundry` network, internal only, no Traefik route.
  `lavalink/application.yml` mounted read-only; plugins resolved from Maven by the server, so no jars in the
  repo. Versions pinned to Lavalink `4.2.2`, youtube-plugin `1.18.2`, lavasrc-plugin `4.8.3`.
- Secrets into Infisical: 5 player bot tokens, `LAVALINK_PASSWORD`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`.
- New `ConfigVars` entries in `discord-utils/core/config.py`, propagated to `.env.example`, `README.md` env
  table, and every compose file per project rule.
- `uv add wavelink` in discord-utils, pinned to `3.5.2`.
- Version bump via `uv version --bump minor` and a CHANGELOG entry.

**Exit criteria: met.** Stack starts clean from `rundev.sh`, node reports healthy, `./run-tests.sh lint` green,
and the U1r spike passed 10/10 against the live node. The second inherited check, a components-v2 post into a
voice channel's text chat, moved to Stage 4 where the panel actually exists; U5 itself is already an
established fact from the permissions table.

### What landed

| File | Change |
|---|---|
| `lavalink/application.yml` | Node config. Built-in YouTube off, SoundCloud on, everything else off. Both plugins declared by Maven coordinate so no jar is vendored. Secrets excluded - see below. |
| `docker-compose.yml` | `lavalink` service on `foundry`, image pinned to `ghcr.io/lavalink-devs/lavalink:4.2.2-alpine` (tag confirmed present on GHCR), authenticated `/version` healthcheck with a 60s `start_period`. No Traefik route, and deliberately no plugins volume - see below. |
| `docker-compose.override.yml` | Local-dev only: binds `127.0.0.1:2333` so discord-utils can run on the host against the containerised node. |
| `discord-utils/core/config.py` | `MUSIC_BOT_TOKENS`, `LAVALINK_URI`, `LAVALINK_PASSWORD`. |
| `.env.example`, `discord-utils/.env.example`, `discord-utils/README.md` | Env propagated per project rule. |
| `discord-utils/pyproject.toml` | `wavelink>=3.5.2`, version `0.1.0` -> `0.2.0`, CHANGELOG entry. |

Deliberate choices worth remembering:

- **`MUSIC_BOT_TOKENS` is one comma-separated variable, not five.** The token count IS the pool size, so blank
  disables music entirely and the 5-bot cap needs no second setting to contradict it.
- **Secrets are not in `application.yml`.** Lavalink documents that env vars override the file, named as the
  uppercased key path with `.` replaced by `_`, so compose supplies `LAVALINK_SERVER_PASSWORD`,
  `PLUGINS_LAVASRC_SPOTIFY_CLIENTID` and `PLUGINS_LAVASRC_SPOTIFY_CLIENTSECRET`. The file keeps empty values
  only to document the shape.
- **discord-utils does NOT `depends_on` lavalink.** The node spends about a minute resolving plugins on first
  boot, and music connects lazily, so gating the whole bot on it would delay `temp_vc` and `chat_events` for
  nothing.
- **No `scsearch:%ISRC%` provider.** Only sources with a real ISRC lookup take an ISRC provider; SoundCloud
  would text-search the ISRC string and mismatch. The chain is `ytsearch:"%ISRC%"`, `ytsearch:%QUERY%`,
  `scsearch:%QUERY%`.
- `resolveArtistsInSearch: false`, because LavaSrc's own README flags it as slow.
- **No named volume on `/opt/Lavalink/plugins`.** The first boot attempt died with
  `java.io.FileNotFoundException: ./plugins/youtube-plugin-1.18.2.jar (Permission denied)` and Spring aborted
  the context. Cause: the image ships no `plugins` directory (`LavalinkServer/docker/Dockerfile` only
  `chown`s `/opt/Lavalink` then copies the jar), so Docker had no ownership to inherit and created the volume
  `root:root drwxr-xr-x`, while the container runs as uid 322. Verified by inspecting the volume and image
  paths directly. Dropping the mount lets Lavalink create the directory inside its own 322-owned WORKDIR. The
  two jars re-download in about a second per boot, which is cheaper than any chown workaround and behaves the
  same on Windows dev and Linux prod.

## Stage 2 - Bot pool

- `pool.py`: lease via `SET nx` with TTL, lazy `client.start()`, nickname roll, idle stop, lease release.
- Startup sweep clears every stale lease, session and name, since sessions never survive a restart. The
  orphaned *panel* sweep moves to Stage 4, where panels first exist.
- Cap exhaustion path: all 5 leased returns a clear ephemeral "all music bots are busy" with which channels hold
  them.
- No audio yet. Connect and disconnect only.

**Exit criteria: met.** `./run-tests.sh fast` and `./run-tests.sh integration` both green, 12 fast and 13
integration tests for this module.

### What landed

| File | Holds |
|---|---|
| `music/models.py` | `LeasedBot`, `PoolSlot`, `PoolExhaustedError` (carries the occupied slots) |
| `music/names.py` | list load, the 32-char assertion, `roll_nickname`, `release_nickname` |
| `music/client.py` | `PlayerClient` with `Intents.none()` plus guilds and voice states, `launch`, `shutdown` |
| `music/pool.py` | `BotPool`: claim, acquire, release, slots, reset, heartbeat |
| `music/service.py` | `MusicService(Service)`, `parse_tokens`, `join`, `leave` |
| `music/valkey_io.py` | `resolve`, narrowing valkey-py's `Awaitable[T] \| T` return annotations |
| `tests/`, `tests/integration/` | first pytest suite in this module, Valkey via testcontainers |

Decisions and findings from building it:

- **The lease IS the Valkey key.** `SET NX` either wins a slot or does not, so concurrent `/play` calls cannot
  be handed the same bot without a separate mutex. A test leases all 5 slots concurrently and asserts the
  indices are exactly `[0,1,2,3,4]`.
- **Nickname uniqueness is `SADD`, not check-then-set.** `SADD` returns 1 only for a name nobody holds, which
  makes the claim atomic. Bounded retry, then `NameRollError`.
- **Release is compare-and-delete in Lua**, so a stale releaser cannot free a slot that has since been
  re-leased. Covered by its own test.
- **A failed login unwinds the nickname too.** First cut released the slot but leaked the name, which would
  have burned a nickname per failed login for the process lifetime.
- **`BotPool` takes a `client_factory`.** Lease semantics are Valkey behaviour and deserve real-Valkey tests;
  injecting the client keeps Discord out of them without mocking Valkey itself.
- **valkey-py types concrete-returning commands as `Awaitable[T] | T`**, since the sync and async clients share
  one signature. `hgetall`, `sadd`, `hset`, `scard`, `sismember` all need narrowing; the `Awaitable[Any] | Any`
  ones the rest of the repo uses do not, which is why nothing hit this before.
- **discord-utils had no pytest suite.** Added one and registered the module in `run_fast` and
  `run_integration` in the root runner, replacing the comment that said it had none.

## Stage 3 - Playback core

**Exit criteria: met.** 22 fast and 54 integration tests green, `./run-tests.sh fast` and `integration` green
across the monorepo, ruff and pyright clean.

### What landed

| File | Holds |
|---|---|
| `music/keys.py` | Every Valkey key template plus `session_keys()` and `STALE_PATTERNS`, so the sweep, the heartbeat and the release path cannot drift apart. |
| `music/queue.py` | The `music:queue:{vc_id}` list. Append and pop are single round trips; remove, move and shuffle rewrite the list inside a transaction. Capped at 500 tracks. |
| `music/state.py` | Current track, volume and loop mode in the session hash the pool already writes to, so one read gets the whole session. |
| `music/resolve.py` | Query to tracks, and track to playable audio. Owns the search prefixes and the mirror provider chain. |
| `music/nodes.py` | One `wavelink.Node` per bot against the shared server, and `player_class()` returning the node-bound partial. |
| `music/session.py` | `MusicSession`: play, advance, skip, pause, stop, seek, volume, loop, shuffle. |
| `music/manager.py` | `SessionManager`: leases a bot, connects it through its own channel object and node, wires its wavelink events, tears the session down. |
| `music/voice.py` | `music:voice:{vc_id}` roster and `may_control`, the single authz source for both surfaces. |
| `music/activity.py` | Capped ring buffer of interactions, rendered with Discord relative timestamps. |
| `music/stats.py` | `music:events` stream. Failures are logged, never raised - stats are not worth failing playback over. |
| `music/events.py` | Orchestrator listeners: roster refresh, empty-channel teardown, temp VC deletion. |

### Decisions worth remembering

- **`played_source` is resolved by us, not by Lavalink.** LavaSrc mirrors Spotify inside its own `process()`
  call and reports nothing back (see Established Facts), so the design's promise of surfacing the played source
  was not achievable through the plugin. The mirror lookup therefore runs client-side with LavaSrc's own
  ISRC-first provider order, and the track handed to `play()` is a real YouTube or SoundCloud track with a
  visible URI. It runs at play time, not at queue time, so a 100 track playlist costs 100 extra lookups only if
  all 100 are actually played.
- **A bare query defaults to `spsearch:`.** Spotify results carry an ISRC, which is the only stable identity a
  song has across sources; without it the same song queued from two places splits into two entries in
  `music_track_plays`. A bare query that Spotify cannot match falls back to `ytsearch:`.
- **Playback is driven by the Valkey queue, never wavelink's.** wavelink's autoplay defaults to
  `AutoPlayMode.disabled` and its `_auto_play_event` returns before touching its own queue in that mode, so the
  queue the web reads and the queue Discord plays from stay the same object.
- **Only `finished` and `loadFailed` advance the queue.** `replaced` and `stopped` are our own doing - skip and
  stop have already decided what happens next - so acting on them would double-advance and silently eat a
  track.
- **Idle teardown is wavelink's, empty-channel teardown is ours.** `wavelink_inactive_player` covers the
  nobody-queued-anything case. An empty channel is handled from `on_voice_state_update` instead, because
  wavelink only decrements its channel token at a track end, which can be minutes away.
- **Every session key expires together.** The heartbeat refreshes the lease, session hash, queue, activity feed
  and roster as one set, and release deletes them as one set. Before this, a killed process left a queue and an
  activity feed behind with no bot attached and nothing to expire them.
- **Reorderings rewrite the list.** A Valkey list has no delete-by-index; the usual LSET-sentinel plus LREM
  trick also deletes a genuine duplicate of the sentinel, which a music queue has by nature. There is a test
  for exactly that case.
- **The mirror and the fake player are what make this testable.** Loop and transport semantics run against a
  real Valkey queue and state hash with Lavalink replaced by a recording fake, because what is under test is
  which track gets chosen next, not whether Lavalink can decode audio.

## Stage 4 - Components V2 panel

Panel posted in the voice channel's own integrated text chat, so no other channel is touched and the panel dies
with the channel.

```
Container (accent = source color)
  Section    [ TextDisplay: title / author / requested by / ends <t:...:R> ]
             [ Thumbnail: artwork ]
  Separator
  TextDisplay  next 3 up, "12 tracks, 47:20 remaining"
  ActionRow    pause-resume  skip  stop  loop  shuffle
  ActionRow    vol down  vol up  save  queue  activity
  Select       jump to track in queue (25 max)
  Select       load playlist (mine + public)
```

Secondary ephemeral LayoutViews: paginated full queue with remove and move, playlist manager, live activity
feed. Modals: seek `mm:ss`, add by URL, pick from search results.

Rules:

- Port the `_layout_helpers.py` shape from discord-server tickets. discord-utils has no LayoutView yet.
- Stay inside 40 children and 4000 display characters.
- Edit the panel only on state change. Never on a timer. Remaining time renders as a Discord relative
  timestamp so the client counts down itself, which removes any need to poll and avoids burning channel edit
  rate limit. If polling ever becomes necessary, recursive `setTimeout` semantics, never a fixed interval.
- Every callback runs the in-VC authz predicate first.

**Exit criteria: partially met.** The component budget is asserted in a test and everything that can be checked
without Discord is green. The live round-trip - panel renders in a voice channel's text chat and every control
works - needs the stack running and a person pressing buttons, so it is the one open item. That same check also
settles the inherited U5 runtime confirmation: a components-v2 post into a voice channel's text chat by a
non-administrator bot.

### What landed

| File | Holds |
|---|---|
| `music/views/snapshot.py` | `PanelSnapshot` and `take_snapshot`: the whole session read once per render, so a render issues no second round of Valkey reads and a view can be built in a test with no player attached. |
| `music/views/format.py` | All wording and colour. Separate from the components so text can be asserted without building a view, and so the character budget has one place to be reasoned about. |
| `music/views/panel_view.py` | `MusicPanel`, the components-v2 message itself. |
| `music/views/controls.py` | The two button rows, plus `CallbackButton` and `GuardedButton`. |
| `music/views/selects.py` | The jump-to-track select, capped at Discord's 25 options. |
| `music/views/queue_view.py` | Ephemeral paginated queue with remove and move. |
| `music/views/activity_view.py` | Ephemeral activity feed. |
| `music/views/modals.py` | Seek and move modals, and the timestamp parser. |
| `music/views/context.py` | `PanelContext`: the session a control acts on and the guard every control runs first. |
| `music/views/layout_helpers.py` | `status_layout` and the ephemeral reply helpers, ported from the tickets pattern. |
| `music/panel.py` | `PanelController`: posts, refreshes, sweeps and deletes the one panel message per session. |
| `music/transport.py` | Transport controls, split out of `MusicSession` so all of them pass through one state-change hook. |

### Decisions worth remembering

- **The state-change hook is the whole redraw strategy.** Transport lives in its own class purely so that every
  control passes through `changed()` exactly once. A control that forgot to call it would leave a stale panel
  on screen, and that is now a single-point invariant with a test that counts the notifications.
- **A failed redraw never touches playback.** `changed()` swallows and logs, because Discord being briefly
  unavailable is not a reason to stop the music.
- **Remaining time is an absolute instant, rendered relative.** The snapshot stores when the track ends, and
  the panel emits `<t:...:R>`. The viewer's own client counts down, so the panel needs no timer and spends no
  channel edit budget on ticking.
- **Buttons are built imperatively, not with the decorator form.** Each control needs its session bound to it
  and the rows are rebuilt on every render anyway, so `CallbackButton` takes its behaviour by injection.
- **The panel is swept from channel history, not from a stored id.** Message ids are never persisted - a
  session cannot survive a restart, so a stored id would always be stale. Any components-v2 message this bot
  left in the channel is orphaned by definition, and its buttons point at a session that no longer exists.
- **The playlist control is deferred to Stage 6.** Playlists do not exist yet; adding it now would put a
  control on the panel with nothing behind it. The jump select occupies that row in the meantime.
- **Add-by-URL and the search picker are deferred to Stage 5**, where `/play` gives them somewhere to be
  reached from. The seek modal shipped because it has a button.
- **The budget is nowhere near the cap.** The largest panel the design can produce - 200 character titles, a
  full 25 option select - is asserted against both the 40 component and 4000 character limits.

## Stage 5 - Slash commands

`/play /pause /resume /skip /stop /queue /remove /shuffle /loop /seek /volume /nowplaying /playlist`. Registered
through `command_infra/help_registry.py` and loaded via `core/service_loader.py` alongside the existing
services.

**Exit criteria: partially met.** Help entries are present and asserted, and `./run-tests.sh fast` is green. The
commands register onto a real `CommandTree` in a test, which catches duplicate names and malformed option
schemas, but the actual sync against Discord needs the bot running.

### What landed

| File | Holds |
|---|---|
| `music/commands/resolver.py` | Interaction to session, and the error replies for the three ways that fails. |
| `music/commands/playback.py` | `/play`, `/pause`, `/resume`, `/skip`, `/stop`, `/seek`. |
| `music/commands/queueing.py` | `/queue`, `/nowplaying`, `/remove`, `/shuffle`, `/loop`, `/volume`. |
| `music/commands/registry.py` | Builds all twelve, adds them to the tree, and registers the help group. |

### Decisions worth remembering

- **The channel comes from the caller's voice state, never from an argument.** That collapses authorisation
  into resolution: if a command found a channel at all, the caller is standing in it, and standing in it is
  exactly what control authority means. No command takes a channel parameter, so there is nothing to spoof.
- **Commands are flat, not a `/music` group.** They are typed constantly and by everyone; an extra word in
  front of each is friction with nothing to show for it. The design named them flat and that holds up.
- **Everything defers first.** Search and connect both routinely exceed the three seconds Discord allows before
  an interaction expires, and `/play` can do both.
- **`/queue` opens the same view the panel's Queue button opens.** One implementation, so the two surfaces
  cannot drift.
- **Help is asserted against the command set.** A test fails if a command is added without a help entry or an
  entry outlives its command, because that drift is otherwise completely silent.
- **`/playlist` is deferred to Stage 6** with the panel's playlist control, since playlists do not exist until
  then. Add-by-URL needs no command of its own: `/play` already accepts a link.
- **A search prompts, a link does not.** wavelink collapses Lavalink's `track` and `search` load types into the
  same `list[Playable]` and drops the distinction (`node.py:960-974`), but a link resolves to exactly one
  track, so a list longer than one is precisely a search with alternatives. `/play` queues a link or a playlist
  directly and shows a picker otherwise. The picker allows several results at once, because picking three
  covers in one go beats running the same search three times.
- **Searching and queueing are separate session methods.** They were one, and that is exactly why every result
  of a search ended up in the queue. `search` resolves and returns; `enqueue` takes the tracks the user
  actually chose.

## Stage 6 - Playlists

api-backend owns persistence because it is the web CRUD surface.

- Alembic migration for `playlists`, `playlist_tracks`, `music_counters`, `music_track_plays`.
- `app/routers/music.py` playlist CRUD with `is_public` toggle. Private is owner-only; public is browsable and
  loadable by anyone but editable only by its owner.
- `playlist_tracks` stores ISRC alongside the source identifier so a dead YouTube id re-resolves by ISRC rather
  than vanishing. Vocard stores encoded track blobs and cannot do this.
- discord-utils reads playlists over HTTP, through `/playlist` and a Playlists button on the panel.

**Exit criteria: met.** Every route has a test, `openapi.json` and `web-app/src/api/schema.d.ts` are
regenerated, both sides of the seam pin `fixtures/music_playlist.json`, and lint, fast and integration are all
green. The one thing not exercised is the live round trip, which needs the stack running.

### What landed

| File | Change |
|---|---|
| `app/db/models/music.py` | `Playlist`, `PlaylistTrack`, `MusicCounter`, `MusicTrackPlay`. |
| `alembic/versions/0057_add_music_tables.py` | All four tables. The counter tables are written by Stage 8; they land now so the schema is settled in one migration. |
| `app/routers/music/playlists.py` | List, read, create, rename/publish, delete, replace tracks, append tracks. |
| `app/routers/music/bot.py` | Read-only service-key surface for discord-utils. |
| `app/routers/music/_helpers.py` | Visibility, ownership, and the post-write reload. |
| `app/docs/tags.py` | `music` tag, grouped under Members and Community. |
| `music/playlists.py` | The HTTP client, its models, and saved rows to queueable tracks. |
| `music/views/playlist_view.py` | The per-viewer playlist list and the control that queues one. |
| `music/commands/playlists.py` | `/playlist`. |
| `music/views/controls.py` | `library_row`, the panel's Playlists button. |
| `fixtures/music_playlist.json` | The payload both sides pin, asserted in each. |

### Decisions worth remembering

- **Two different visibility rules, deliberately.** `require_visible` governs reads and lets anyone see a public
  playlist; `require_owned` governs every write. Public means loadable, never writable, and every write path is
  asserted against a public playlist owned by someone else.
- **A private playlist 404s rather than 403s.** A 403 would confirm it exists to someone who cannot see it.
- **The bot authenticates with the shared service key and names the user it acts for.** discord-utils has no
  user JWT - nobody completes an OAuth flow to press a panel button. The surface is read-only, so the service
  key can never write on someone's behalf, and visibility for the named user is evaluated exactly as it is on
  the web.
- **Track lists are replaced wholesale.** Saving a queue or reordering one is a whole-list operation, and it
  keeps positions contiguous without a renumbering pass.
- **Writes reload before serialising.** Three SQLAlchemy behaviours forced this and each one silently produced
  a wrong response rather than an error: a just-committed playlist has never loaded its `tracks` collection, so
  serialising it lazy-loads and raises `MissingGreenlet` under asyncio; a playlist already in the identity map
  keeps its old collection unless the reload passes `populate_existing`; and a SQL-expression `onupdate` on
  `updated_at` expires that attribute after every flush, so the timestamps are set in Python instead.
- **Clearing a track list needs its own flush.** A single flush emits the inserts before the deletes, so
  replacing a list collided on `uq_playlist_track_position` at position 0.
- **The playlist control is a button, not the select this document sketched.** The panel is one shared message,
  so a select baked into it can only ever hold one option list - and since a playlist is visible to its owner
  plus anyone if public, that list could only have been the public ones. Everybody's own playlists would have
  been unreachable from the panel. The button opens a per-viewer ephemeral list instead, which is also how
  Queue and Activity already work, and it costs a render nothing.
- **A saved track is queued unresolved.** api-backend stores metadata, not a Lavalink payload, so `Track` now
  admits rows with no `encoded` and no `payload` and `resolve_playback` looks the audio up at play time. A
  playlist of any size therefore loads in one request rather than one search per track, and a track nobody ever
  hears costs nothing. This is the same path Spotify already took, for the same reason.
- **A restored track is tried at its own URL first.** Only then the ISRC, then the text. That is what makes the
  stored ISRC worth having: a dead source id re-resolves instead of the track vanishing from the playlist.
- **The ISRC was being searched with its hyphens in.** LavaSrc strips them before running the same query
  (`DefaultMirroringAudioTrackResolver.java:41`) and a hyphenated ISRC matches nothing on YouTube, so every
  mirrored track was quietly falling through to the text search. Found while writing the restore chain.
- **Missing config means no control, not a broken one.** `API_BACKEND_URL` and `METRICS_API_KEY` are both
  required for playlists; with either absent the button and the command's list are simply not there, and
  playback is unaffected.
- **Both sides pin one fixture.** discord-utils parses the payload with models of its own, so a renamed field
  would break a consumer that nothing in api-backend's suite watches. `fixtures/music_playlist.json` is
  asserted against `PlaylistDetailOut` on one side and `PlaylistDetail` on the other, plus an e2e journey that
  reads a seeded playlist through the service key and checks it cannot reach a private one.

## Stage 7 - Web control

- api-backend: `GET /music/sessions`, `GET /music/sessions/{vc_id}/queue`, and write routes that publish onto
  Valkey `music:commands`. WebSocket live state fed by a `music:state` subscriber, mirroring the existing
  `_discord_chat_subscriber` background task.
- discord-utils `bridge.py` subscribes to `music:commands`, executes against the right bot, publishes state.
- web-app: live session view with transport controls, drag-reorder queue, playlist manager. Layout and styling
  need explicit approval before any web-app design code is written, per project rule.

**Exit criteria:** `./run-tests.sh e2e` green, covering the web-to-api and discord-to-api seams. **Met** -
12 discord_e2e journeys and 3 Playwright, plus 19 mocked and 10 real-infra tests on the api side and 33 on
the bot side.

### What landed

| Piece | Where |
|---|---|
| Live read surface: sessions, queue, activity, per-viewer control | `api-backend/app/routers/music/sessions.py` |
| Track search over Lavalink's REST API, no session needed | `api-backend/app/services/lavalink.py`, `routers/music/search.py` |
| The search control both the queue and the playlist editor use | `web-app/src/components/music/TrackSearch.tsx` |
| Command publisher, twice-checked authority | `api-backend/app/routers/music/control.py` |
| Session reader over the Valkey keys discord-utils writes | `api-backend/app/routers/music/_live.py` |
| `GET /music/live` socket, authenticated by its first frame | `api-backend/app/routers/music/live.py` |
| `music:state` subscriber and the watcher fan-out | `api-backend/app/services/music_live.py` |
| Command subscriber and its authority check | `discord-utils/music/bridge.py` |
| One command to one transport call | `discord-utils/music/dispatch.py` |
| State notices, chained onto the panel refresh | `discord-utils/music/notify.py` |
| Music panel, mini player, and the shared socket | `web-app/src/components/music/`, `src/context/MusicContext.tsx` |
| The seam both sides pin | `fixtures/music_bridge.json` |

### Decisions

- **The notice carries no state.** discord-utils publishes only the channel that moved; api-backend reads the
  session out of Valkey itself. One place shapes the web payload, so a field added for the website is never
  added to the bot as well, and the socket and the REST route cannot describe a session differently.
- **The socket authenticates in its first frame.** A browser cannot set an Authorization header on a WebSocket,
  and a token in the query string is written into every access log that records the path.
- **Authority is checked on both sides.** api-backend checks so the caller gets a real 403; discord-utils checks
  again before running, because trusting the publisher would make the rule only as strong as whoever published.
  Both read the same `music:voice:{id}` set the Discord panel checks.
- **Position is published with a timestamp, not kept current.** The browser extrapolates between state changes,
  so a progress bar costs no polling and no server-side timer - the same reasoning as the panel's relative
  timestamps.
- **The encoded audio never leaves the server.** The stored track carries the Lavalink payload; the web schema
  names neither it nor `encoded`, so pydantic drops them rather than putting a playable handle into a page.
- **The panel and the mini player share one socket.** A second subscription would double the server's fan-out
  for no extra information.
- **One command body, not a route per action.** Which fields an action needs is declared once in
  `REQUIRED_FIELDS`; the envelope travels as published JSON either way. `resume` is `pause` with a flag,
  because the transport call is `player.pause(bool)`.
- **A command nobody is subscribed to answers 503.** The session hash outlives a crashed bot by its TTL, so a
  live-looking session with no listener is a real state; saying so beats a silent success.
- **Valkey is exposed to the host in the e2e stack.** The suite seeds a session and watches the command channel,
  which is exactly what discord-utils would otherwise be doing.
- **Every Discord id reaching the web is a string.** A snowflake is 64 bits and a JSON number is an IEEE double
  in a browser, so anything above 2^53 is rounded on the way in: `1479967329084375071` became
  `...375000`. That id addressed a channel nobody was in, so `may_control` answered false and every control was
  disabled; the same rounding on `owner_discord_id` made every playlist read as someone else's. The web e2e
  now uses a real snowflake, because any smaller id passes while the bug is still there.
- **A roster change publishes a state notice.** Control authority is per viewer so it cannot ride the broadcast
  payload, but the listener count can, and it changes exactly when the answer might have. The page re-asks on
  that rather than polling. Without it, joining the channel after opening the page left the controls dead.
- **Editing a playlist needs no session.** Create, rename, share, reorder, remove and delete are library work
  and stay available with no bot playing; only queueing one is gated on the voice channel.
- **api-backend searches Lavalink directly.** `/v4/loadtracks` is plain HTTP with a password header
  (`lavalink-repo/docs/api/rest.md:87-101`), so search needs no player, no voice connection and no bot. Routing
  it through the command bridge instead would have made searching require a live session, which would have made
  the playlist library unusable exactly when it is most useful. api-backend gains `LAVALINK_URI` and
  `LAVALINK_PASSWORD` for this and nothing else - it never holds a player.
- **A picked result travels with the `add` command.** The bot does not re-run the query: search results are not
  stable, so re-searching could queue a different track than the one the caller chose. The metadata arrives
  unresolved and the audio is looked up at play time, the same path a saved playlist row takes.
- **The scrub readout is driven by pointer events, not by the slider's callbacks.** Radix calls
  `onValueCommit` from inside its state updater and `onValueChange` after it
  (`@radix-ui/react-use-controllable-state/dist/index.mjs:34-41`), so on the keyboard path the commit lands
  *before* the change. A flag cleared in the commit and set in the change would therefore be left on forever
  by one arrow key. `pointerdown`/`pointerup` on a wrapper answers "is a drag in hand" directly, and only
  bubbles, so it cannot interfere with the slider's own handlers.
- **The progress bars glide with CSS, not with a faster clock.** The position still ticks once a second; a
  one-second linear transition on the fill and the thumb turns each step into continuous motion. Driving it
  from `requestAnimationFrame` instead would have re-rendered the whole panel sixty times a second to move a
  bar a fraction of a pixel. It is off while dragging - the thumb would otherwise trail the pointer by the
  transition duration - and the element is keyed by track id, so the reset to zero at a track change is a
  remount rather than a second-long slide backwards.
- **A controlled Radix slider must be fed its own drag.** `Slider` with a `value` prop is fully controlled:
  `useControllableState` returns the prop and its setter only calls `onValueChange`
  (`@radix-ui/react-slider/dist/index.mjs:54-62`). With no `onValueChange` the internal value never moves, so
  the thumb stays put, and `handleSlideEnd` compares that unchanged value against the one from before the
  slide and skips `onValueCommit` entirely (`:71-76`). Keyboard still worked, because the keyboard path
  commits from inside `updateValues` (`:86`) - which is why the volume slider looked wired up while pointer
  drags did nothing at all and left it pinned to the session's opening volume.
- **The seek bar commits on release, in whole milliseconds.** Three things had to hold at once for it to work
  at all. The position it shows is extrapolated from `updated_at`, which is a float epoch, so the value handed
  back was fractional and `position_ms: int` refused every seek with a 422. The slider is controlled and the
  position ticks once a second, so a drag was pulled out from under the pointer unless the dragged value takes
  over the displayed one. And clearing that value at commit made the bar snap back to the old position for the
  length of the round trip, so it is held until the session's `updated_at` moves - the bot confirming the
  seek - or the command errors.
- **The socket carries the session, not its queue.** Those are read over REST, so the page re-reads them
  whenever `updated_at` moves. Invalidating only on commands the page itself sent was the bug behind a queue
  that showed a rising track count above an empty list: tracks added from Discord changed the session, never
  the list.
- **Silence is how a dead session is detected.** A clean end publishes a closed notice, but a killed process
  publishes nothing and its keys merely expire. The bot therefore re-announces every live session once a
  minute and a watcher drops anything it has not heard from in two and a half minutes - well inside the
  300-second Valkey TTL, and long enough that one missed round cannot make the panel flap.
- **The panel is grouped by what a control does.** Row one moves the playhead (pause, skip, stop, seek), row
  two changes how it plays (volume, loop, shuffle), row three opens the per-viewer views (Queue, Activity,
  Playlists). Playlists is a plain label, since the row already reads as views.
- **Shuffle is a mode, not a reorder.** `play_next` draws at random from the queue while it is on, rather than
  the queue being scrambled up front. The queue a listener reads therefore still shows the order tracks were
  added in, and turning shuffle off resumes that order instead of leaving the scramble behind. The one-shot
  `TrackQueue.shuffle` and `Transport.shuffle` were removed rather than left as a second, divergent path.
- **The web sets shuffle explicitly rather than toggling.** Two people pressing at once would otherwise invert
  each other; the panel sends `not snapshot.shuffle`, exactly as pause and resume already work.
- **Importing is the same load path as search, uncapped.** A playlist link already came back as all of its
  tracks; import just keeps the playlist name and raises the cap from the 25 a search shows to the 500 a
  playlist holds.
- **Spotify playlist, album and artist links cannot be imported at all.** Verified against the running node:
  `/v1/playlists/{id}/items` answers 401 "Valid user authentication required" and `/v1/albums`, `/v1/artists`
  answer 403, while a single `/v1/tracks/{id}` still resolves - so the credentials are valid and Spotify is
  refusing these endpoints to app-only auth. Generated playlists (`37i9dQZ`) are refused a step earlier by
  LavaSrc itself (`SpotifySourceManager.java:543-544`). Neither is fixable from this side; both now say so, and
  point at the YouTube or YouTube Music link for the same playlist. LavaSrc's `preferPartnerApi` would reach
  them through Spotify's private web-player API, and is deliberately left off as undocumented and outside
  Spotify's developer terms.
- **The deepest `Caused by` is the one worth showing.** Lavalink's top-level message is always lavaplayer's
  generic "Something went wrong while looking up the track", and even the first cause is often only "Server
  responded with an error"; the status and the real explanation are further down.
- **Search returns no `encoded` handle.** Consistent with the session payload: a browser has no use for playable
  audio, and the track is re-resolved at play time regardless.

## Stage 8 - Clan stats

- api-backend consumer group on the Valkey events stream, `SET nx` dedup, incrementing `music_counters` and
  `music_track_plays`. Stream rather than pubsub so playback never blocks on a DB write and an api restart
  loses nothing.
- Read endpoints for clan totals: minutes listened, tracks played, skip counts, source split, top tracks.
- Web stats surface, anonymous and clan-level only.
- Session history: what has already played, with re-queue on both surfaces and save-to-playlist on the web.

**Exit criteria:** integration test asserting real counter rows after a synthetic event batch. **Met** -
`api-backend/app/tests/integration/test_music_stats_integration.py` drives the real consumer over a real
stream against real Postgres, plus an e2e journey that watches the deployed consumer turn one event into a
total.

### What landed

| Piece | Where |
|---|---|
| Consumer loop, its own connection, the transaction | `api-backend/app/services/music_stats.py` |
| Stream mechanics and the at-least-once claim | `api-backend/app/services/music_stream.py` |
| What counts as the same recording | `api-backend/app/services/music_identity.py` |
| The two upserts and the track identity rule | `api-backend/app/services/music_counters.py` |
| Clan totals and top tracks | `api-backend/app/routers/music/stats.py` |
| Session history list and the counter emit | `discord-utils/music/history.py` |
| Panel history view with its numbered re-queue buttons | `discord-utils/music/views/history_view.py` |
| History read surface | `api-backend/app/routers/music/_live.py`, `sessions.py` |
| History page, re-queue and save-to-playlist dialog | `web-app/src/components/music/HistoryPage.tsx`, `AddToPlaylistDialog.tsx` |
| Clan stats page | `web-app/src/components/music/StatsPage.tsx` |
| The history key and entry both sides pin | `fixtures/music_bridge.json` |

### Decisions

- **History is session state, not a record.** It is a capped Valkey list under `SESSION_KEYS`, so the pool's
  heartbeat refreshes it and its orphan sweep deletes it without either learning a new key. Persisting it
  would have been a per-guild play log, which is a different thing from the durable counters and would have
  reopened the retention question the counters exist to close.
- **The panel shows ten, the website shows all of it.** Ten is what fits in two rows of buttons next to a
  numbered list; paging the panel would cost an edit per page for something nobody is watching. The website
  has the room and "everything played tonight" is what a listener actually goes looking for.
- **Re-queue needs no new command.** A history entry carries the same metadata a search result does, so it
  travels back down the existing `add` path. A `requeue` action would have made the bot re-read its own list
  and given the same intent two implementations.
- **A stored entry drops the Lavalink payload.** It is the largest thing a track carries, the audio is
  re-resolved at play time regardless, and dropping it at write time is what lets api-backend hand the whole
  entry to a browser without a second schema to strip it.
- **The counter is emitted from the history writer.** Both records are written for the same reason at the
  same moment; splitting them across two call sites is how a track ends up counted but not listed.
- **Delivery is at least once, so counting is claimed.** `SET NX` on the message id before the transaction,
  released if it fails, acknowledged after. A consumer group alone guarantees redelivery after a crash, not
  exactly-once, and an inflated total is worse than a missing one because nothing can audit it back down.
- **The consumer holds its own Valkey connection.** A blocking `XREADGROUP` occupies its socket for the whole
  block, and the shared request client is built with a socket timeout far shorter than that. Reusing it made
  every poll time out and left the consumer in a permanent retry loop that counted nothing - green in every
  test, because the tests read non-blocking, and visible only in the deployed stack's logs. Same reasoning as
  the pubsub connection `MusicStateService` already opens for itself.
- **One consumer name across workers.** Pending entries left by a worker that died are then visible to
  whichever worker polls next, which is what makes the claim the only thing standing between a redelivery and
  a double count. Distinct names per process would have needed `XAUTOCLAIM` to achieve the same thing.
- **Postgres does the arithmetic.** Both tables are written with `ON CONFLICT DO UPDATE` adding to the stored
  value, including the JSONB source split. Read-add-write in the consumer would lose increments between two
  workers, and the whole point of a stream is that more than one may consume it.
- **Top tracks are keyed on the recording, not the link.** ISRC where the source gives one, a digest of the
  normalised title, author and duration where it does not. Keying on the source identifier would list one
  song once per source and make the list meaningless.
- **The source split counts `played_source`.** A Spotify request mirrored to YouTube counts as YouTube, which
  is the only reason the two are tracked separately at all.
- **Stats have no per-user shape to leak.** The tables carry a guild and a track, so there is no filter to
  forget on the way out - asserted against the response schema rather than against a query.

---

## Stage 9 - Identity of a track: cover art and requester

Two fields survived only on the path they were born on. A `/play` search built the track from the Lavalink
result, so it had both; every other way into the queue - the website, a saved playlist, an import, a requeue -
built the track from metadata and had neither. On the web that showed as a placeholder on every track anyone
had queued from the site, and a raw snowflake under it.

### What landed

- `artwork` on `TrackIn`, on `playlist_tracks` (migration `0058`), on discord-utils' `SavedTrack`, and on the
  `add` command payload, so it survives every hop between the two services.
- `MusicSession._play` takes a cover from the audio it just resolved when the track has none.
- `Track.requester_name`, stamped in `MusicSession.enqueue` from the guild the main bot holds.
- `TrackArt` on the web, used by Now Playing, the queue and Up next; Now Playing names the requester.

### Decisions

- **A carried cover beats a re-resolved one.** Playback resolution finds a *mirror* of the recording on another
  source, and the mirror's own art is not what the user picked from. So the cover travels with the track
  through every write, and the resolved one is only ever a fallback for a track that has none. The same
  reasoning applies to a playlist reorder: the web writes the whole list back, so a field the browser drops on
  the way out is deleted from the table.
- **The cover is recovered at play time, not at queue time.** Resolving art when a track is queued would mean
  a search per track for a two hundred track playlist, most of which nobody will hear. `_play` already
  resolves the audio, so the art is free exactly there.
- **The name is attached where it is known, once.** api-backend cannot produce it: its `users` table only
  holds people who have logged into the website, and a per-server nickname is not in it at all. The browser
  certainly cannot. discord-utils holds the guild, so the name is stamped on the way into the queue and
  travels with the track from then on.
- **`enqueue` is the single stamping point.** Every surface - `/play`, the picker, the panel's playlist
  button, a web `add`, a web `load_playlist`, a history requeue - ends at `enqueue`, so one call site covers
  all of them. Threading a name parameter through `search_tracks`, `to_track` and `to_tracks` instead would
  have touched every caller and their tests to reach the same place.
- **The lookup is the main bot's guild, and cache-only.** Player bots run `Intents.none()` plus guilds and
  voice states (`music/client.py:22`), so their own guild has no member cache to read. A miss leaves the name
  empty and the website falls back to the id: naming a requester is not worth a Discord round trip per track,
  let alone blocking a queue on one.
- **A requeue clears the name with the id.** The two are one fact. Copying a history entry and changing only
  the id would credit the new request to whoever asked for it the first time.
- **The web sends the name nowhere.** It is display only, read from the session, and never accepted back on a
  write - so nothing can spoof a requester by editing a queue payload.
- **Activity entries are named the same way.** `ActivityFeed` takes the same lookup and stamps `actor_name` on
  push. The panel's own line stays a `<@id>` mention, because in Discord that *is* the resolved form and it
  links to the member; the stamped name exists for the surface that cannot resolve anything. Standing rule:
  a bare snowflake never reaches a reader unless the field's subject is the id itself.

---

## Risks

| Risk | Handling |
|---|---|
| U1r fails at runtime despite the server source | Run one Lavalink node per bot. Costs memory, changes nothing above the client layer. |
| A player silently gets another bot's node | Structural: `nodes=[own_node]` is always passed explicitly, asserted in a Stage 2 test that stands up 2 nodes and checks `player.node.identifier` matches the leasing bot. |
| YouTube blocking despite home hosting (U6) | Owner decision to defer. If it appears, add `poToken` or oauth, noting the README's burner-account warning. |
| Spotify mirroring resolves the wrong track | The mirror is resolved client-side in `resolve.py` with LavaSrc's own ISRC-first order, so the panel can show the real `played_source` and URI and the user can skip a bad match. Resolving it server-side would have made that invisible. |
| Panel edit rate limit | Structural: edit on state change only, relative timestamps instead of animation. |
| Interaction volume from panel buttons | Live activity is a capped Valkey ring buffer, never persisted rows. |

## Open Decisions

- Per-bot fixed avatars: deferred, default avatars for now.
- Whether to add `music_user_minutes` before the no-user-id door closes.
