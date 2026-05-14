# Usage: .\scripts\export-secrets.ps1 [dev|prod]
param([string]$Env = "dev")

infisical export `
  --projectId=9047f633-a675-497c-8ca2-1e75ffd95db9 `
  --env=$Env `
  --format=dotenv `
  | Out-File -Encoding utf8 "$PSScriptRoot\..\.env"

Write-Host "Exported $Env secrets to .env"
