---
name: api-test-app-instance
description: api-backend tests - importing conftest._app in a test gives a different app than the fixture, so dependency_overrides silently no-op
metadata:
  type: feedback
---

In api-backend tests, `from app.tests.conftest import _app` inside a test body yields a DIFFERENT FastAPI instance than the one the `auth_client`/`anon_client` fixtures use (default pytest prepend import-mode loads conftest as top-level `conftest`, so a second `_app = _build_app()` executes). Mutating that `_app.dependency_overrides` is a silent no-op - the request still hits the real dependency (e.g. `verify_clan` still demands its `verification-code` header -> 422). `test_ccingest_missing_key_header` "works" only because its manipulation is a no-op and it asserts 401/422 anyway.

**Why:** wasted a debugging cycle chasing a 422 that looked like a body-validation error but was the override never registering.

**How to apply:** to override a dependency for one test, either request the same fixture the client depends on (e.g. add `mock_session` param and shape its return so the real dependency passes) or drive the real dependency with a header - do NOT import `_app` from conftest to patch overrides. Shared fixtures are cached per-test, so `mock_session` in the test IS the one the client fixture used. Related: [[integration-testing]].
