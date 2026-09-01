"""The builders that dispatch to a script in `scripts/`, picking the twin that suits
the platform.

Jobs whose invocation is trivial enough to express directly - the infisical +
docker compose ones - are built in `stack.py` instead.
"""

from __future__ import annotations

from .actions import ActionError, Options, Step, extra_args
from .context import IS_WINDOWS, ROOT, bash, powershell


def sh(relative: str, *args: str) -> Step:
    interpreter = bash()
    if not interpreter:
        raise ActionError(
            "bash not found. Install Git for Windows, or run this action from WSL."
        )
    return Step([interpreter, relative, *args], cwd=ROOT)


def ps(relative: str, *args: str) -> Step:
    interpreter = powershell()
    if not interpreter:
        raise ActionError("PowerShell not found.")
    return Step(
        [interpreter, "-NoProfile", "-File", str(ROOT / relative), *args], cwd=ROOT
    )


def prefer_powershell() -> bool:
    return IS_WINDOWS and powershell() is not None


def tests(options: Options) -> list[Step]:
    lane = str(options["lane"])
    if prefer_powershell():
        return [ps("scripts/run-tests.ps1", lane)]
    return [sh("run-tests.sh", lane)]


def sync_db(_: Options) -> list[Step]:
    if prefer_powershell():
        return [ps("scripts/sync-db.ps1")]
    return [sh("scripts/sync-db.sh")]


def export_secrets(options: Options) -> list[Step]:
    environment = str(options["env"])
    if prefer_powershell():
        return [ps("scripts/export-secrets.ps1", environment)]
    return [sh("scripts/export-secrets.sh", environment)]


def backfill_events(options: Options) -> list[Step]:
    environment = str(options["env"])
    apply = bool(options["apply"])
    if prefer_powershell():
        args = ["-Env", environment] + (["-Apply"] if apply else [])
        return [ps("scripts/backfill-events.ps1", *args)]
    args = [f"--env={environment}"] + (["--apply"] if apply else [])
    return [sh("scripts/backfill-events.sh", *args)]


def docker_cleanup(options: Options) -> list[Step]:
    args = ["--dry-run"] if options["dry_run"] else []
    return [sh("scripts/docker-cleanup.sh", *args)]


def migrate_clan_rank(options: Options) -> list[Step]:
    return [sh("scripts/migrate-clan-rank-to-lowercase.sh", *extra_args(options))]
