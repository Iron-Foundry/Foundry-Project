#!/usr/bin/env bash
set -euo pipefail
# Syncs prod Postgres DB to local dev DB via SSH tunnel.
# Requires: infisical login with access to both dev and prod environments.
# Requires: ~/.ssh/id_rsa with access to prod server.

PROJECT_ID=9047f633-a675-497c-8ca2-1e75ffd95db9
SSH_HOST=193.181.23.235
SSH_USER=salt
TUNNEL_PORT=15432
PG_IMAGE=postgres:17-alpine
HEALTH_TIMEOUT=120

get_secret() {
  infisical secrets get "$1" --env="$2" --projectId="$PROJECT_ID" --plain
}

# docker compose substitutes ${POSTGRES_*} from the process environment, which
# only Infisical can supply here - there is no committed .env.
compose() {
  infisical run --projectId="$PROJECT_ID" --env=dev --silent -- docker compose "$@"
}

# The postgres client tools are not installed on the host; run them from the
# same image the container uses so the dump format always matches the server.
pg() {
  local pass=$1
  shift
  docker run --rm --network host --user "$(id -u):$(id -g)" \
    -e PGPASSWORD="$pass" -v /tmp:/tmp "$PG_IMAGE" "$@"
}

echo "Ensuring postgres is running..."
compose up -d postgres
CONTAINER=$(compose ps -q postgres)
for ((i = 0; i < HEALTH_TIMEOUT; i++)); do
  [ "$(docker inspect --format '{{.State.Health.Status}}' "$CONTAINER")" = "healthy" ] && break
  sleep 1
done
if [ "$(docker inspect --format '{{.State.Health.Status}}' "$CONTAINER")" != "healthy" ]; then
  echo "postgres did not become healthy in ${HEALTH_TIMEOUT}s. Check: docker logs $CONTAINER" >&2
  exit 1
fi

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
pg "$DEV_PASS" pg_dump \
  -h 127.0.0.1 \
  -U "$DEV_USER" \
  -d "$DEV_DB" \
  --data-only \
  "${TABLE_ARGS[@]}" \
  -f "$LOCAL_DUMP" || { echo "No local DB found, skipping save."; LOCAL_DUMP=""; }

echo "Dumping prod DB ($PROD_DB)..."
EXCLUDE_ARGS=()
for t in "${EXCLUDED_TABLES[@]}"; do EXCLUDE_ARGS+=(--exclude-table-data="$t"); done
pg "$PROD_PASS" pg_dump \
  -h 127.0.0.1 \
  -p "$TUNNEL_PORT" \
  -U "$PROD_USER" \
  -d "$PROD_DB" \
  -Fc \
  "${EXCLUDE_ARGS[@]}" \
  -f "$DUMP"

echo "Dropping local dev DB ($DEV_DB)..."
pg "$DEV_PASS" dropdb --if-exists -h 127.0.0.1 -U "$DEV_USER" "$DEV_DB"
pg "$DEV_PASS" createdb -h 127.0.0.1 -U "$DEV_USER" "$DEV_DB"

echo "Restoring prod data to local dev DB..."
pg "$DEV_PASS" pg_restore \
  -h 127.0.0.1 \
  -U "$DEV_USER" \
  -d "$DEV_DB" \
  --no-owner \
  --role="$DEV_USER" \
  "$DUMP"

if [[ -n "$LOCAL_DUMP" ]]; then
  echo "Restoring local excluded table data..."
  pg "$DEV_PASS" psql \
    -h 127.0.0.1 \
    -U "$DEV_USER" \
    -d "$DEV_DB" \
    -f "$LOCAL_DUMP" \
    -q
  rm "$LOCAL_DUMP"
fi

rm "$DUMP"
echo "Done. Local dev DB synced from prod."
