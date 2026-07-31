---
name: semver-and-version-endpoints
description: Per-maturity semver across the six modules, single-sourced from the package manifest and gated in CI
metadata:
  type: project
---

Adopted 2026-07-28. Versions are per-module and chosen by maturity, not kept in
lockstep: `api-backend`, `discord-server` and `web-app` are at **1.0.0** (in
production); `discord-utils`, `discord-event` and `osrs-cache-service` stay
**0.1.0** until their feature sets settle.

The manifest is the only place a version lives - `pyproject.toml` for the Python
modules, `package.json` for web-app. `app/version.py` in api-backend and
osrs-cache-service reads it with `tomllib` at import time (both are virtual uv
projects with no `[build-system]`, so `importlib.metadata` would not find them).
The file is present in both container images because `WORKDIR` is `/app` and the
Dockerfile copies it. Nothing else hardcodes the version - api-backend feeds it
into `FastAPI(version=...)`, so the OpenAPI `info` block cannot drift.

Both FastAPI services expose `GET /version` returning `service`, `version`,
`git_sha`, `build_time`. The last two come from `GIT_SHA` / `BUILD_TIME`
container build args (declared after the dependency layers so a new commit does
not bust the uv cache) and are `null` outside Docker. Build a stamped image with
`GIT_SHA=$(git rev-parse HEAD) BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ) docker compose build`.

Each module has a Keep-a-Changelog `CHANGELOG.md`, updated in the same change as
the code. A `version` job in the three 1.0.0 modules' `.github/workflows/test.yml`
fails a pull request that changes shipped code without bumping the manifest;
docs- and CI-only diffs are exempt. Bump with `uv version --bump <level>` or
`npm version --no-git-tag-version <level>`.

Related: [[integration-testing]], [[tests-follow-code]], [[api-docs-scalar]].
