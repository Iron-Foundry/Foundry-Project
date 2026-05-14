# Usage: .\reload.ps1 [service...]
# Omit service name to reload all services.
docker compose up --force-recreate --build -d @args
