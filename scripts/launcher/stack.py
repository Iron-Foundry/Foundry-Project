"""The run lane: infisical-wrapped docker compose stacks, ported from the old run*.sh pairs."""

from __future__ import annotations

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
