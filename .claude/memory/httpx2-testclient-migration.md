---
name: httpx2-testclient-migration
description: Deferred work - starlette 1.3.1 deprecated httpx with starlette.testclient, api-backend tests must move to httpx2
metadata:
  type: project
---

api-backend's test suite must migrate from `httpx` to `httpx2` for its
`starlette.testclient.TestClient` usage. Deferred by the user on 2026-08-01 to
a later dedicated change, not to be bundled into unrelated work.

The warning appeared when starlette went 1.0.1 -> 1.3.1 during the Dependabot
remediation pass on 2026-08-01:

    StarletteDeprecationWarning: Using `httpx` with `starlette.testclient` is
    deprecated; install `httpx2` instead.

First seen at `app/tests/integration/test_ccdispatch_integration.py:15`, but the
import is not unique to that file - the whole suite's TestClient usage is in
scope, so grep for `starlette.testclient` and `httpx` across `app/tests/` before
scoping the change.

**Why:** it is a deprecation, not a break - the suite passes on httpx today. It
becomes urgent only when starlette drops the httpx path, so it is worth doing
deliberately rather than as a drive-by inside a security bump.

**How to apply:** when the user asks for it, treat it as its own change - swap
the dependency, update every TestClient construction site, and run
`./run-tests.sh integration` (needs Docker, see [[integration-testing]]). Do not
silence the warning with a filter as a substitute for migrating. Related:
[[tests-follow-code]].
