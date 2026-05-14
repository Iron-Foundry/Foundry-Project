# Runs the event backfill/reparse script using Infisical credentials.
# Requires: infisical login with access to the target environment.
# For prod: also requires ~/.ssh/id_rsa with access to prod server.
#
# Usage:
#   .\scripts\backfill-events.ps1               # dry-run against dev
#   .\scripts\backfill-events.ps1 -Apply         # apply against dev
#   .\scripts\backfill-events.ps1 -Env prod      # dry-run against prod
#   .\scripts\backfill-events.ps1 -Env prod -Apply

param(
    [string]$Env    = "dev",
    [switch]$Apply
)

$ProjectId  = "9047f633-a675-497c-8ca2-1e75ffd95db9"
$SshHost    = "193.181.23.235"
$SshUser    = "salt"
$TunnelPort = 15432

function Get-Secret {
    param([string]$Name, [string]$SecretEnv)
    infisical secrets get $Name --env=$SecretEnv --projectId=$ProjectId --plain
}

Write-Host "Fetching $Env credentials from Infisical..."
$DbUser     = Get-Secret POSTGRES_USER $Env
$DbPassRaw  = [Uri]::UnescapeDataString((Get-Secret POSTGRES_PASSWORD $Env))
$DbPass     = [Uri]::EscapeDataString($DbPassRaw)
$DbName     = Get-Secret POSTGRES_DB $Env

if ($Env -eq "prod") {
    $SshCtrl = [System.IO.Path]::GetTempFileName()
    Remove-Item $SshCtrl

    Write-Host "Opening SSH tunnel to prod (passphrase required)..."
    Start-Process ssh -ArgumentList @(
        "-i", "$HOME\.ssh\id_rsa",
        "-MS", $SshCtrl,
        "-fNL", "${TunnelPort}:127.0.0.1:5432",
        "${SshUser}@${SshHost}"
    ) -Wait

    $DbHost = "127.0.0.1"
    $DbPort = $TunnelPort
} else {
    $DbHost = "127.0.0.1"
    $DbPort = 5432
}

$DatabaseUrl = "postgresql+asyncpg://${DbUser}:${DbPass}@${DbHost}:${DbPort}/${DbName}"
$DryRunArg   = if ($Apply) { "" } else { "--dry-run" }

try {
    Push-Location "$PSScriptRoot\.."
    $env:DATABASE_URL = $DatabaseUrl
    uv run python scripts/reparse_events.py $DryRunArg
} finally {
    $env:DATABASE_URL = ""
    Pop-Location
    if ($Env -eq "prod") {
        ssh -S $SshCtrl -O exit "${SshUser}@${SshHost}" 2>$null
    }
}
