"""The run lane: infisical-wrapped docker compose stacks, ported from the old run*.sh pairs."""

from __future__ import annotations

import shlex

from .actions import Options, Step, extra_args
from .context import INFISICAL_PROJECT_ID, ROOT

DEV_SERVICES = (
    "mongodb",
    "postgres",
    "valkey",
    "cache-postgres",
    "lavalink",
    "api-backend",
    "osrs-cache-service",
    "cache-tiles",
    "discord-server",
    "discord-utils",
    "discord-event",
)

DEPLOY_FILES = ("-f", "docker-compose.yml", "-f", "docker-compose.traefik.yml")


def infisical(env: str, *command: str, watch: bool = False) -> Step:
    argv = ["infisical", "run", f"--projectId={INFISICAL_PROJECT_ID}", f"--env={env}"]
    if watch:
        argv.append("--watch")
    argv += ["--", *command]
    return Step(argv, cwd=ROOT)


def dev(options: Options) -> list[Step]:
    services = [*DEV_SERVICES, *extra_args(options)]
    backend = infisical("dev", "docker", "compose", "up", "-d", "--build", *services)
    # web-app runs natively so Bun gets real file-watcher events for HMR.
    web = infisical("dev", "bun", "--cwd", str(ROOT / "web-app"), "dev")
    return [backend, web]


def staging(options: Options) -> list[Step]:
    command = ("docker", "compose", *DEPLOY_FILES, "up", "-d", *extra_args(options))
    return [infisical("staging", *command, watch=True)]


def prod(options: Options) -> list[Step]:
    command = (
        "docker",
        "compose",
        *DEPLOY_FILES,
        "up",
        "-d",
        "--build",
        *extra_args(options),
    )
    return [infisical("prod", *command, watch=True)]


# The sync loop ingests a build only when OpenRS2's latest id differs from the
# current row's, so pointing that column away from any real id reopens the gate.
# Clearing `is_current` instead does not work: `openrs2_cache_id` is unique, so
# re-ingesting the same build collides, and every read 503s while nothing is
# current. This way the old build keeps serving until the new one cuts over.
_SHOW_BUILD = (
    "SELECT id, openrs2_cache_id, game_build_major, status, is_current "
    "FROM cache_builds ORDER BY id;"
)
_REOPEN_GATE = "UPDATE cache_builds SET openrs2_cache_id = -1 WHERE is_current;"


def _cache_psql(env: str, files: tuple[str, ...], sql: str) -> Step:
    script = f'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c {shlex.quote(sql)}'
    command = ("exec", "-T", "cache-postgres", "sh", "-c", script)
    return infisical(env, "docker", "compose", *files, *command)


def reingest_cache(options: Options) -> list[Step]:
    environment = str(options["env"])
    files = () if environment == "dev" else DEPLOY_FILES
    if not options["apply"]:
        return [_cache_psql(environment, files, _SHOW_BUILD)]
    return [
        _cache_psql(environment, files, _REOPEN_GATE),
        infisical(
            environment, "docker", "compose", *files, "restart", "osrs-cache-service"
        ),
    ]
