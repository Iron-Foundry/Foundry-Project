#!/usr/bin/env bash
set -euo pipefail
# Usage: ./scripts/export-secrets.sh [dev|prod]
ENV=${1:-dev}
infisical export \
  --projectId=9047f633-a675-497c-8ca2-1e75ffd95db9 \
  --env="$ENV" \
  --format=dotenv \
  > .env
echo "Exported $ENV secrets to .env"
