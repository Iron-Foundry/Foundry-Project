#!/usr/bin/env bash
set -euo pipefail
# Runs the event backfill/reparse script using Infisical credentials.
# Requires: infisical login with access to the target environment.
# For prod: also requires ~/.ssh/id_rsa with access to prod server.
#
# Usage:
#   ./scripts/backfill-events.sh               # dry-run against dev
#   ./scripts/backfill-events.sh --apply        # apply against dev
#   ./scripts/backfill-events.sh --env=prod     # dry-run against prod
#   ./scripts/backfill-events.sh --env=prod --apply

PROJECT_ID=9047f633-a675-497c-8ca2-1e75ffd95db9
SSH_HOST=193.181.23.235
SSH_USER=salt
TUNNEL_PORT=15432

ENV=dev
DRY_RUN="--dry-run"
for arg in "$@"; do
  case "$arg" in
    --env=*) ENV="${arg#--env=}" ;;
    --apply) DRY_RUN="" ;;
  esac
done

get_secret() {
  infisical secrets get "$1" --env="$2" --projectId="$PROJECT_ID" --plain
}

urlencode() {
  python3 -c "import sys, urllib.parse; print(urllib.parse.quote(sys.stdin.read().strip(), safe=''))"
}

echo "Fetching $ENV credentials from Infisical..."
DB_USER=$(get_secret POSTGRES_USER "$ENV")
DB_PASS_RAW=$(get_secret POSTGRES_PASSWORD "$ENV" | python3 -c "import sys,urllib.parse; print(urllib.parse.unquote(sys.stdin.read().strip()))")
DB_PASS=$(echo "$DB_PASS_RAW" | urlencode)
DB_NAME=$(get_secret POSTGRES_DB "$ENV")

if [[ "$ENV" == "prod" ]]; then
  SSH_CTRL=$(mktemp -u)
  cleanup() {
    ssh -S "$SSH_CTRL" -O exit "$SSH_USER@$SSH_HOST" 2>/dev/null || true
  }
  trap cleanup EXIT

  echo "Opening SSH tunnel to prod (passphrase required)..."
  ssh -i ~/.ssh/id_rsa \
    -MS "$SSH_CTRL" \
    -fNL "${TUNNEL_PORT}:127.0.0.1:5432" \
    "$SSH_USER@$SSH_HOST"

  DB_HOST=127.0.0.1
  DB_PORT=$TUNNEL_PORT
else
  DB_HOST=127.0.0.1
  DB_PORT=5432
fi

DATABASE_URL="postgresql+asyncpg://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

cd "$(dirname "$0")/.."
DATABASE_URL="$DATABASE_URL" uv run python scripts/reparse_events.py $DRY_RUN
