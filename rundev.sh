#!/usr/bin/env bash
set -euo pipefail

exec infisical run \
  --projectId=9047f633-a675-497c-8ca2-1e75ffd95db9 \
  --env=dev \
  --watch \
  -- docker compose up -d "$@"
