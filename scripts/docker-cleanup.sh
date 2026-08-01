#!/usr/bin/env bash
set -euo pipefail
# Reclaims Docker build cache and orphaned (dangling) image layers on this host.
# Safe by design: never removes volumes, containers, networks, or tagged images,
# so other stacks on this box and their data are untouched.
# Scheduled by scripts/systemd/docker-cleanup.timer. Preview with --dry-run.

IMAGE_UNTIL=${IMAGE_UNTIL:-72h}
CACHE_UNTIL=${CACHE_UNTIL:-168h}
CACHE_MAX_SPACE=${CACHE_MAX_SPACE:-10GB}
DRY_RUN=${DRY_RUN:-0}

usage() {
  cat <<EOF
Usage: docker-cleanup.sh [--dry-run] [--help]

Removes dangling image layers older than IMAGE_UNTIL, then trims the BuildKit
cache twice: by age (CACHE_UNTIL) and to a hard ceiling (CACHE_MAX_SPACE).

  -n, --dry-run   List what would be removed and exit without removing anything
  -h, --help      Show this message

Environment overrides (current values):
  IMAGE_UNTIL=$IMAGE_UNTIL         minimum age of a dangling image before it is eligible
  CACHE_UNTIL=$CACHE_UNTIL        minimum age of an unused build cache record
  CACHE_MAX_SPACE=$CACHE_MAX_SPACE   maximum build cache kept after the age pass
EOF
}

while [[ $# -gt 0 ]]; do
  case $1 in
    -n | --dry-run) DRY_RUN=1 ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

log() {
  printf '%s  %s\n' "$(date -Is)" "$*"
}

run() {
  if [[ $DRY_RUN == 1 ]]; then
    log "would run: $*"
  else
    "$@"
  fi
}

if ! docker info >/dev/null 2>&1; then
  log "docker daemon unreachable, nothing done"
  exit 1
fi

log "images older than $IMAGE_UNTIL, cache older than $CACHE_UNTIL, cache ceiling $CACHE_MAX_SPACE"
log "usage before"
docker system df

if [[ $DRY_RUN == 1 ]]; then
  log "dangling images eligible for removal"
  docker image ls --filter dangling=true --filter "until=$IMAGE_UNTIL" \
    --format '{{.ID}}  {{.Size}}  {{.CreatedSince}}'
  log "build cache"
  docker buildx du | tail -4
fi

# Without -a this is dangling-only: a tagged image can never be collected, and
# the daemon refuses to delete any image a container still references.
run docker image prune --force --filter "until=$IMAGE_UNTIL"

# Age pass drops cache nobody is iterating on; the ceiling then caps the rest
# (BuildKit evicts least-recently-used first) so recent layers stay warm.
run docker builder prune --force --filter "until=$CACHE_UNTIL"
run docker builder prune --force --max-used-space "$CACHE_MAX_SPACE"

log "usage after"
docker system df
