---
name: api-docs-scalar
description: Where api-backend's Scalar reference metadata lives, and the auth-scheme change that made 401 replace 422
metadata:
  type: project
---

api-backend serves its API reference with Scalar (`scalar-fastapi`) at `/docs`;
FastAPI's own `/docs` and `/redoc` stay disabled. Everything that shapes that
page lives in **`app/docs/`**, deliberately out of `main.py`:

- `description.py` - the markdown intro (auth model, conventions, realtime).
- `tags.py` - `TAGS_METADATA` (one description per tag, list order = sidebar
  order) and `TAG_GROUPS`, emitted as `x-tagGroups`.
- `schema.py` - `SERVERS` plus `install_openapi_customization`, which wraps
  `app.openapi()` to attach `x-tagGroups`.
- `reference.py` - renderer options: clan palette, favicon, dark default,
  `persist_auth`, preferred security scheme.
- `responses.py` - reusable 401/403/404/502/503 entries. Attach these to an
  `APIRouter(responses=...)`, not per endpoint - one line documents a whole
  feature area.

`SERVERS` is hardcoded, not read from the environment, because it lands in the
committed `openapi.json` that `test_openapi_contract.py` compares byte for byte.

**Behaviour change worth remembering:** `app/dependencies.py` now declares real
security schemes (`HTTPBearer` as `DiscordJWT`, two `APIKeyHeader`s as
`MemberApiKey` / `MetricsApiKey`), all with `auto_error=False`. Before this the
credential was an ordinary required `Header(...)`, so a *missing* credential
produced FastAPI's `422`; it now produces `401`. Invalid or revoked credentials
returned `401` before and still do. Tests that asserted `422` for a missing
header were asserting that artifact, not intended behaviour.

Two gotchas: `app/routers/surveys/__init__.py` must import the shared responses
as `doc_responses`, because importing its sibling `.responses` submodule rebinds
the bare name on the package. And `app/tests/conftest.py` builds its **own**
FastAPI app rather than importing `app.main.app` - a new router or app-level
metadata has to be added there too or the endpoint tests never see it.

Related: [[semver-and-version-endpoints]], [[api-test-app-instance]],
[[integration-testing]].
