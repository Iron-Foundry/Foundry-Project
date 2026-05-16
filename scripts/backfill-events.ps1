# Runs the event backfill/reparse script using Infisical credentials.
# Requires: infisical login with access to the target environment.
# For prod: also requires ~/.ssh/id_rsa with access to prod server.
#
# Usage:
#   .\scripts\backfill-events.ps1                          # dry-run against dev
#   .\scripts\backfill-events.ps1 -Apply                   # apply against dev
#   .\scripts\backfill-events.ps1 -Env prod                # dry-run against prod
#   .\scripts\backfill-events.ps1 -Env prod -Apply         # apply against prod
#   .\scripts\backfill-events.ps1 -Diagnose -Rsn "Name"    # diagnose feed for RSN
#   .\scripts\backfill-events.ps1 -Diagnose -UserId 123    # diagnose feed for Discord user ID

param(
    [string]$Env      = "dev",
    [switch]$Apply,
    [switch]$Diagnose,
    [string]$Rsn      = "",
    [string]$UserId   = ""
)

$ProjectId  = "9047f633-a675-497c-8ca2-1e75ffd95db9"
$SshHost    = "193.181.23.235"
$SshUser    = "salt"
$TunnelPort = 15432

function Get-Secret {
    param([string]$Name, [string]$SecretEnv)
    infisical secrets get $Name --env=$SecretEnv --projectId=$ProjectId --plain
}

function Wait-TunnelReady {
    param([int]$Port, [int]$TimeoutSeconds = 30)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $tcp = [System.Net.Sockets.TcpClient]::new()
            $tcp.Connect("127.0.0.1", $Port)
            $tcp.Close()
            return
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }
    throw "Tunnel on port $Port not ready after ${TimeoutSeconds}s"
}

Write-Host "Fetching $Env credentials from Infisical..."
$DbUser    = Get-Secret POSTGRES_USER $Env
$DbPassRaw = [Uri]::UnescapeDataString((Get-Secret POSTGRES_PASSWORD $Env))
$DbPass    = [Uri]::EscapeDataString($DbPassRaw)
$DbName    = Get-Secret POSTGRES_DB $Env

$SshProc = $null

if ($Env -eq "prod") {
    Write-Host "Opening SSH tunnel to prod (passphrase required)..."
    $SshProc = Start-Process ssh -ArgumentList @(
        "-i", "$HOME\.ssh\id_rsa",
        "-NL", "${TunnelPort}:127.0.0.1:5432",
        "${SshUser}@${SshHost}"
    ) -PassThru -NoNewWindow

    Write-Host "Waiting for tunnel..."
    Wait-TunnelReady -Port $TunnelPort

    $DbHost = "127.0.0.1"
    $DbPort = $TunnelPort
} else {
    $DbHost = "127.0.0.1"
    $DbPort = 5432
}

$DatabaseUrl = "postgresql+asyncpg://${DbUser}:${DbPass}@${DbHost}:${DbPort}/${DbName}"
$DryRunArg   = if ($Apply) { "--dry-run" } else { "--dry-run" }
if ($Apply) { $DryRunArg = "" }

try {
    Push-Location "$PSScriptRoot\..\api-backend"
    $env:DATABASE_URL = $DatabaseUrl

    if ($Diagnose) {
        Write-Host "--- Diagnosing feed ---"
        $DiagArgs = @()
        if ($Rsn)    { $DiagArgs += "--rsn",     $Rsn }
        if ($UserId) { $DiagArgs += "--user-id",  $UserId }
        uv run python scripts/diagnose_feed.py @DiagArgs
    } else {
        Write-Host "--- Populating user_accounts from users.rsn ---"
        uv run python scripts/populate_user_accounts.py $DryRunArg
        Write-Host "--- Reparsing events ---"
        uv run python scripts/reparse_events.py $DryRunArg
    }
} finally {
    $env:DATABASE_URL = ""
    Pop-Location
    if ($SshProc -and -not $SshProc.HasExited) {
        $SshProc | Stop-Process -Force
    }
}
