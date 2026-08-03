"""Every entry the launcher offers, in menu order."""

from __future__ import annotations

from . import stack
from .actions import Action, ActionError, Choice, Flag, Options, Step, extra_args
from .context import IS_WINDOWS, ROOT, bash, powershell

ENVIRONMENTS = ("dev", "staging", "prod")


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


EXTRA_SERVICES = "extra compose services, e.g. cache-tiles"

CATALOG: tuple[Action, ...] = (
    Action(
        slug="dev",
        section="Run",
        label="dev stack",
        summary="Backend services in Docker (detached), then the web-app natively for HMR.",
        build=stack.dev,
        extra_hint=EXTRA_SERVICES,
        requires=("infisical", "docker", "bun"),
    ),
    Action(
        slug="staging",
        section="Run",
        label="staging stack",
        summary="Full stack behind Traefik on the staging Infisical environment. No rebuild.",
        build=stack.staging,
        extra_hint=EXTRA_SERVICES,
        requires=("infisical", "docker"),
    ),
    Action(
        slug="prod",
        section="Run",
        label="prod stack",
        summary="Full stack behind Traefik on the prod Infisical environment, rebuilding images.",
        build=stack.prod,
        extra_hint=EXTRA_SERVICES,
        requires=("infisical", "docker"),
        warning="Deploys to production.",
    ),
    Action(
        slug="test",
        section="Test",
        label="run-tests",
        summary=(
            "lint: ruff + pyright + tsc. fast: no-Docker suites. "
            "integration: shared Postgres/Valkey. e2e: full compose stack. all: everything."
        ),
        build=tests,
        choices=(
            Choice("lane", "Lane", ("lint", "fast", "integration", "e2e", "all")),
        ),
    ),
    Action(
        slug="sync-db",
        section="Maintenance",
        label="sync prod DB to dev",
        summary="Dumps prod Postgres over an SSH tunnel and restores it into the local dev DB.",
        build=sync_db,
        requires=("infisical", "docker", "ssh"),
        warning="Drops and recreates the local dev database.",
    ),
    Action(
        slug="export-secrets",
        section="Maintenance",
        label="export secrets to .env",
        summary="Writes the selected Infisical environment to the repo-root .env file.",
        build=export_secrets,
        choices=(Choice("env", "Environment", ENVIRONMENTS),),
        requires=("infisical",),
        warning="Overwrites .env.",
    ),
    Action(
        slug="backfill-events",
        section="Maintenance",
        label="backfill events",
        summary="Populates user_accounts from users.rsn, then reparses historical events.",
        build=backfill_events,
        choices=(Choice("env", "Environment", ("dev", "prod")),),
        flags=(Flag("apply", "Apply (off = dry run)"),),
        requires=("infisical",),
    ),
    Action(
        slug="docker-cleanup",
        section="Maintenance",
        label="docker cleanup",
        summary="Prunes dangling image layers and trims the BuildKit cache. Never touches volumes.",
        build=docker_cleanup,
        flags=(Flag("dry_run", "Dry run (list only)", default=True),),
        requires=("bash", "docker"),
    ),
    Action(
        slug="migrate-clan-rank",
        section="Maintenance",
        label="migrate clan_rank to lowercase",
        summary="One-off: rewrites users.clan_rank into the lowercase WOM role format.",
        build=migrate_clan_rank,
        requires=("bash", "docker"),
        warning="Writes to the running stack's database.",
    ),
)

BY_SLUG = {action.slug: action for action in CATALOG}
SECTIONS = tuple(dict.fromkeys(action.section for action in CATALOG))
