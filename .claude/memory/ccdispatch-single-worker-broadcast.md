---
name: ccdispatch-single-worker-broadcast
description: OPEN BUG - ccdispatch broadcasts from an in-process ConnectionManager while gunicorn runs 3 workers, so ~2/3 of connected RuneLite clients miss every clan-chat message
metadata:
  type: project
---

Found 2026-08-02 while measuring the e2e lane. Not yet fixed - the user scoped
the fix out of the test-performance change and will schedule it.

`api-backend/Dockerfile` boots gunicorn with `--workers 3`.
`app/services/connection_manager.py` is a plain in-process singleton, and its
`broadcast()` iterates only that worker's `_connections` dict.
`app/routers/ccdispatch.py` calls it directly; the only Valkey publish on that
path is the presence event, never the message. So a `POST /ccdispatch` reaches
the worker holding a given WebSocket with probability **1/3**.

**Why it stayed hidden:** every test below e2e runs the app in one process, where
there is only one connection manager - `app/tests/integration/test_ccdispatch_integration.py`
passes deterministically. Only `integration/discord_e2e/tests/test_api_to_runelite.py`
can see it, and it is flaky by exactly the same 1/3, so a green run proves
nothing.

**How to apply:** the fix is to fan the dispatch out over Valkey pubsub so every
worker delivers to its own sockets, with an integration test that asserts
delivery across two connection managers. Until then, treat a green
`test_dispatch_reaches_ws` as luck, not evidence. Its `ws.recv()` calls are now
bounded by `asyncio.timeout(10)` so a bad draw fails the lane in seconds rather
than hanging it forever - which it did, for 9.5 minutes, before that guard.
