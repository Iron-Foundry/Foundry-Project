---
name: secrets-and-startup
description: How secrets are managed (Infisical) and how the project is started (the ./run launcher, compose injection)
metadata:
  type: project
---

Secrets are managed via Infisical (3rd-party). The project is started through the
root launcher (`./run dev` / `staging` / `prod`, or `.\run.ps1` on Windows), which
wraps `docker compose` in `infisical run`. Secrets are injected at container-creation
time through the docker-compose files - not baked into images and not read from a
checked-in `.env`. See [[root-launcher]].

**Why:** knowing the injection point matters when adding or changing an env var -
the change must reach the compose files (and `.env.example`), because that is where
containers receive it at creation.

**How to apply:** when adding/renaming an env var, propagate it to the compose files
(`docker-compose.yml` + overrides) and `.env.example`, and configure the value in
Infisical; do not expect a local `.env` alone to reach a container.

A bare `docker compose ...` (no `infisical run` wrapper) substitutes blank for every
Infisical secret and will **recreate** containers like `cache-postgres` with a broken
env (healthcheck then fails). Always wrap one-off compose commands:
`infisical run --projectId=9047f633-a675-497c-8ca2-1e75ffd95db9 --env=dev -- docker compose ...`.
Both `api-backend` and `osrs-cache-service` now run `alembic upgrade head` on
container start (baked into the Dockerfile `CMD` as
`sh -c "uv run alembic upgrade head && exec uv run gunicorn ..."`), so a normal
deploy needs no manual migration step; a manual one-off still needs the infisical
wrapper plus `--entrypoint "" ... uv run alembic upgrade head`.
