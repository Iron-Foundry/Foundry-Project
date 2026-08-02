---
name: per-worker-state-under-gunicorn
description: api-backend runs 3 gunicorn workers, so any module-level in-memory singleton is per-worker; only a test with two managers can see the resulting bugs
metadata:
  type: project
---

`api-backend/Dockerfile` boots gunicorn with `--workers 3`. Every module-level
singleton is therefore three separate objects, one per process, and anything
that reads or writes one from an HTTP request only sees a third of the truth.

Three instances found and fixed 2026-08-02, all the same shape - publish on a
Valkey channel, let a subscriber in **every** worker act, which is what
`foundry:discord_chat` had always done:

- `POST /ccdispatch` broadcast into the in-process `connection_manager`, so it
  reached a given RuneLite client about one time in three -> `foundry:ccdispatch`
  + `CcDispatchService`. The connection census moved to Valkey
  (`app/services/ws_registry.py`).
- `WebSocketMetricsService` ran in all three workers and each wrote its own row
  -> a `SET NX` lease, one worker writes one row per interval.
- `PUT /config/services/toggles/{key}` started or stopped a service in the
  serving worker only -> `foundry:service_toggles` + `ToggleDispatchService`.
  That dispatcher sits **outside** the toggle registry on purpose: a switch that
  can switch itself off is a switch you cannot switch back on.

**Why it hid for so long:** every suite below e2e runs the app in a single
process, where there is only one manager, so the single-process test passed
with the bug fully present. The e2e test that could see it was flaky by the same
1/3 - it passed twice and hung once in three runs, and a green run proved
nothing.

**How to apply:** when touching anything that keeps state in a module-level
object - `connection_manager`, a collector, a cache dict - assume three copies.
A test proving cross-worker behaviour must construct **two** instances and give
the socket or state to the one the request cannot reach; see
`app/tests/integration/test_cc_dispatch_workers.py` and
`test_service_toggles_integration.py`. Collapse it onto one instance and it
silently stops testing anything - both were checked by restoring the old
behaviour and confirming they fail. Related: [[integration-testing]].
