#!/usr/bin/env bash
set -euo pipefail
# Syncs prod Postgres DB to local dev DB via SSH tunnel.
# Requires: infisical login with access to both dev and prod environments.
# Requires: ~/.ssh/id_rsa with access to prod server.

PROJECT_ID=9047f633-a675-497c-8ca2-1e75ffd95db9
SSH_HOST=193.181.23.235
SSH_USER=salt
TUNNEL_PORT=15432

get_secret() {
  infisical secrets get "$1" --env="$2" --projectId="$PROJECT_ID" --plain
}

echo "Fetching connection details from Infisical..."
PROD_USER=$(get_secret POSTGRES_USER prod)
PROD_PASS=$(get_secret POSTGRES_PASSWORD prod | python3 -c "import sys,urllib.parse; print(urllib.parse.unquote(sys.stdin.read().strip()))")
PROD_DB=$(get_secret POSTGRES_DB prod)
DEV_USER=$(get_secret POSTGRES_USER dev)
DEV_PASS=$(get_secret POSTGRES_PASSWORD dev)
DEV_DB=$(get_secret POSTGRES_DB dev)

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

DUMP="/tmp/foundry-dump-$(date +%Y%m%d%H%M%S).dump"
LOCAL_DUMP="/tmp/foundry-local-$(date +%Y%m%d%H%M%S).sql"

# Tables excluded from prod sync - preserve local data across syncs.
# config/role_panels: Discord-server-specific IDs invalid on dev server.
# tickets/transcripts/survey_*: excluded from prod for privacy.
EXCLUDED_TABLES=(config role_panels tickets transcripts survey_active survey_responses)

echo "Saving local excluded table data..."
TABLE_ARGS=()
for t in "${EXCLUDED_TABLES[@]}"; do TABLE_ARGS+=(-t "$t"); done
PGPASSWORD="$DEV_PASS" pg_dump \
  -h 127.0.0.1 \
  -U "$DEV_USER" \
  -d "$DEV_DB" \
  --data-only \
  "${TABLE_ARGS[@]}" \
  -f "$LOCAL_DUMP" 2>/dev/null || { echo "No local DB found, skipping save."; LOCAL_DUMP=""; }

echo "Dumping prod DB ($PROD_DB)..."
EXCLUDE_ARGS=()
for t in "${EXCLUDED_TABLES[@]}"; do EXCLUDE_ARGS+=(--exclude-table-data="$t"); done
PGPASSWORD="$PROD_PASS" /usr/lib/postgresql/17/bin/pg_dump \
  -h 127.0.0.1 \
  -p "$TUNNEL_PORT" \
  -U "$PROD_USER" \
  -d "$PROD_DB" \
  -Fc \
  "${EXCLUDE_ARGS[@]}" \
  -f "$DUMP"

echo "Dropping local dev DB ($DEV_DB)..."
PGPASSWORD="$DEV_PASS" dropdb --if-exists -h 127.0.0.1 -U "$DEV_USER" "$DEV_DB"
PGPASSWORD="$DEV_PASS" createdb -h 127.0.0.1 -U "$DEV_USER" "$DEV_DB"

echo "Restoring prod data to local dev DB..."
PGPASSWORD="$DEV_PASS" pg_restore \
  -h 127.0.0.1 \
  -U "$DEV_USER" \
  -d "$DEV_DB" \
  --no-owner \
  --role="$DEV_USER" \
  "$DUMP"

if [[ -n "$LOCAL_DUMP" ]]; then
  echo "Restoring local excluded table data..."
  PGPASSWORD="$DEV_PASS" psql \
    -h 127.0.0.1 \
    -U "$DEV_USER" \
    -d "$DEV_DB" \
    -f "$LOCAL_DUMP" \
    -q
  rm "$LOCAL_DUMP"
fi

rm "$DUMP"
echo "Done. Local dev DB synced from prod."
