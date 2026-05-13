#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Start infrastructure and backend services detached.
# web-app runs natively below so Bun gets real inotify events for HMR.
infisical run \
  --projectId=9047f633-a675-497c-8ca2-1e75ffd95db9 \
  --env=dev \
  -- docker compose up -d --build \
  mongodb postgres valkey api-backend discord-server discord-utils discord-event "$@"

cd "$SCRIPT_DIR/web-app"
exec infisical run \
  --projectId=9047f633-a675-497c-8ca2-1e75ffd95db9 \
  --env=dev \
  -- bun dev
