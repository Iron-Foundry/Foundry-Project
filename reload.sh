#!/usr/bin/env bash
set -euo pipefail
# Usage: ./reload.sh [service...]
# Omit service name to reload all services.
docker compose up --force-recreate --build -d "$@"
