---
name: per-worker-state-under-gunicorn
description: api-backend runs 3 gunicorn workers, so any module-level in-memory singleton is per-worker; only a test with two managers can see the resulting bugs
metadata:
  type: project
---

`api-backend/Dockerfile` boots gunicorn with `--workers 3`. Every module-level
singleton is therefore three separate objects, one per process, and anything
that reads or writes one from an HTTP request only sees a third of the truth.

This bit `ccdispatch` (found and fixed 2026-08-02): `connection_manager` is an
in-process dict, so `POST /ccdispatch` broadcasting into it reached a given
RuneLite client about one time in three. Fixed by publishing on
`foundry:ccdispatch` and letting `CcDispatchService` in **every** worker deliver
- the pattern `foundry:discord_chat` had always used. The connection census
moved to Valkey (`app/services/ws_registry.py`), and `WebSocketMetricsService`
now takes a `SET NX` lease so one worker writes one row per interval.

**Why it hid for so long:** every suite below e2e runs the app in a single
process, where there is only one manager, so the single-process test passed
with the bug fully present. The e2e test that could see it was flaky by the same
1/3 - it passed twice and hung once in three runs, and a green run proved
nothing.

**How to apply:** when touching anything that keeps state in a module-level
object - `connection_manager`, a collector, a cache dict - assume three copies.
A test proving cross-worker behaviour must construct **two** instances and give
the socket or state to the one the request cannot reach; see
`app/tests/integration/test_cc_dispatch_workers.py`. Collapse it onto one
instance and it silently stops testing anything. Still unfixed in this family:
`PUT /config/services/toggles/{key}` starts or stops a service in one worker
only. Related: [[integration-testing]].
