"""Every entry the launcher offers, in menu order.

Declarations only: an entry names its options, what it needs on the machine, and
what it will change. The commands themselves are built in `jobs.py` (dispatch to a
script in `scripts/`) or `stack.py` (infisical + docker compose).
"""

from __future__ import annotations

from . import jobs, stack
from .actions import Action, Choice, Flag

ENVIRONMENTS = ("dev", "staging", "prod")

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
        build=jobs.tests,
        choices=(
            Choice("lane", "Lane", ("lint", "fast", "integration", "e2e", "all")),
        ),
    ),
    Action(
        slug="sync-db",
        section="Maintenance",
        label="sync prod DB to dev",
        summary="Dumps prod Postgres over an SSH tunnel and restores it into the local dev DB.",
        build=jobs.sync_db,
        requires=("infisical", "docker", "ssh"),
        warning="Drops and recreates the local dev database.",
    ),
    Action(
        slug="export-secrets",
        section="Maintenance",
        label="export secrets to .env",
        summary="Writes the selected Infisical environment to the repo-root .env file.",
        build=jobs.export_secrets,
        choices=(Choice("env", "Environment", ENVIRONMENTS),),
        requires=("infisical",),
        warning="Overwrites .env.",
    ),
    Action(
        slug="backfill-events",
        section="Maintenance",
        label="backfill events",
        summary="Populates user_accounts from users.rsn, then reparses historical events.",
        build=jobs.backfill_events,
        choices=(Choice("env", "Environment", ("dev", "prod")),),
        flags=(Flag("apply", "Apply (off = dry run)"),),
        requires=("infisical",),
    ),
    Action(
        slug="docker-cleanup",
        section="Maintenance",
        label="docker cleanup",
        summary="Prunes dangling image layers and trims the BuildKit cache. Never touches volumes.",
        build=jobs.docker_cleanup,
        flags=(Flag("dry_run", "Dry run (list only)", default=True),),
        requires=("bash", "docker"),
    ),
    Action(
        slug="reingest-cache",
        section="Maintenance",
        label="force cache re-ingest",
        summary=(
            "Makes osrs-cache-service re-download and re-decode the current OSRS build, "
            "so new decoder fields are backfilled without waiting for Jagex to ship one."
        ),
        build=stack.reingest_cache,
        choices=(Choice("env", "Environment", ENVIRONMENTS),),
        flags=(Flag("apply", "Apply (off = show the ingested build)"),),
        requires=("infisical", "docker"),
        warning=(
            "Restarts osrs-cache-service and re-runs the whole ingest "
            "(download, icons, map tiles - minutes, and double the volume use "
            "until it finishes)."
        ),
    ),
    Action(
        slug="migrate-clan-rank",
        section="Maintenance",
        label="migrate clan_rank to lowercase",
        summary="One-off: rewrites users.clan_rank into the lowercase WOM role format.",
        build=jobs.migrate_clan_rank,
        requires=("bash", "docker"),
        warning="Writes to the running stack's database.",
    ),
)

BY_SLUG = {action.slug: action for action in CATALOG}
SECTIONS = tuple(dict.fromkeys(action.section for action in CATALOG))
