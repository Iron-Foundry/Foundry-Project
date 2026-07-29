#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Start infrastructure and backend services detached.
# web-app runs natively below so Bun gets real inotify events for HMR.
infisical run \
  --projectId=9047f633-a675-497c-8ca2-1e75ffd95db9 \
  --env=dev \
  -- docker compose up -d --build \
  mongodb postgres valkey cache-postgres lavalink api-backend osrs-cache-service cache-tiles discord-server discord-utils discord-event "$@"

exec infisical run \
  --projectId=9047f633-a675-497c-8ca2-1e75ffd95db9 \
  --env=dev \
  -- bun --cwd "$SCRIPT_DIR/web-app" dev
