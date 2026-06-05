#!/usr/bin/env bash
set -euo pipefail
# Migrates users.clan_rank values to lowercase WOM role format.
# "Ruby" -> "ruby", "Deputy Owner" -> "deputy_owner", etc.
# Run once after deploying the WOM in-game rank source change.

docker compose exec postgres psql \
  -U "${POSTGRES_USER:-foundry}" \
  -d "${POSTGRES_DB:-foundry}" \
  -c "UPDATE users
      SET clan_rank = replace(lower(clan_rank), ' ', '_')
      WHERE clan_rank IS NOT NULL;"

echo "Done. Current clan_rank distribution:"
docker compose exec postgres psql \
  -U "${POSTGRES_USER:-foundry}" \
  -d "${POSTGRES_DB:-foundry}" \
  -c "SELECT clan_rank, count(*) FROM users WHERE clan_rank IS NOT NULL GROUP BY clan_rank ORDER BY clan_rank;"
