---
name: valkey-blocking-reads-own-connection
description: a blocking Valkey read (XREADGROUP/BLPOP/pubsub listen) needs its own client built with socket_timeout=None, never the shared request client
metadata:
  type: project
---

Any background consumer that issues a **blocking** Valkey command - `XREADGROUP ... BLOCK`,
`BLPOP`, a pubsub `listen()` - must open its own client with `Valkey.from_url(uri,
socket_timeout=None)` and close it on `stop()`. Never `app.state.valkey`.

**Why:** the shared request client carries a short `socket_timeout`. A blocking command
holds its socket for the whole block, so the timeout fires first and the command *never*
succeeds. In api-backend's `MusicStatsService` this made every poll raise
`Timeout reading from valkey:6379`, leaving the consumer in a permanent 5s retry loop that
counted nothing. `MusicStateService` already avoided this for its pubsub connection
(`app/services/music_live.py`).

**How to apply:** when adding a stream/pubsub/blocking-list consumer, give the service a
`valkey_uri` plus an optional injected client for tests, and build the real one lazily with
`socket_timeout=None`. Assert it in a unit test -
`service.valkey.connection_pool.connection_kwargs["socket_timeout"] is None` - because
**tests will not catch this otherwise**: unit and integration tests read with `block=None`,
so they pass while the deployed service is dead. The only symptom is a repeating warning in
the container log. See [[integration-testing]] and [[evidence-over-assumption]].
