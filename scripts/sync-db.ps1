# Syncs prod Postgres DB to local dev DB via SSH tunnel.
# Requires: infisical login with access to both dev and prod environments.
# Requires: ~/.ssh/id_rsa with access to prod server.

$ProjectId  = "9047f633-a675-497c-8ca2-1e75ffd95db9"
$SshHost    = "193.181.23.235"
$SshUser    = "salt"
$TunnelPort = 15432

function Get-Secret {
    param([string]$Name, [string]$Env)
    infisical secrets get $Name --env=$Env --projectId=$ProjectId --plain
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

Write-Host "Ensuring postgres is running..."
docker compose up -d postgres
do {
    $ContainerId = (docker compose ps -q postgres).Trim()
    $Health = (docker inspect --format '{{.State.Health.Status}}' $ContainerId).Trim()
    if ($Health -ne "healthy") { Start-Sleep -Seconds 1 }
} while ($Health -ne "healthy")

Write-Host "Fetching connection details from Infisical..."
$ProdUser    = Get-Secret POSTGRES_USER prod
$ProdPassRaw = [Uri]::UnescapeDataString((Get-Secret POSTGRES_PASSWORD prod))
$ProdDb      = Get-Secret POSTGRES_DB prod
$DevUser     = Get-Secret POSTGRES_USER dev
$DevPass     = Get-Secret POSTGRES_PASSWORD dev
$DevDb       = Get-Secret POSTGRES_DB dev

Write-Host "Opening SSH tunnel to prod (passphrase required)..."
$SshProc = Start-Process ssh -ArgumentList @(
    "-i", "$HOME\.ssh\id_rsa",
    "-NL", "${TunnelPort}:127.0.0.1:5432",
    "${SshUser}@${SshHost}"
) -PassThru -NoNewWindow

Write-Host "Waiting for tunnel..."
Wait-TunnelReady -Port $TunnelPort

try {
    $Timestamp = Get-Date -Format "yyyyMMddHHmmss"
    $Dump      = "$env:TEMP\foundry-dump-$Timestamp.dump"
    $LocalDump = "$env:TEMP\foundry-local-$Timestamp.sql"

    $ExcludedTables = @("config", "role_panels", "tickets", "transcripts", "survey_active", "survey_responses")
    $TableArgs      = $ExcludedTables | ForEach-Object { "-t", $_ }
    $ExcludeArgs    = $ExcludedTables | ForEach-Object { "--exclude-table-data=$_" }

    Write-Host "Saving local excluded table data..."
    $env:PGPASSWORD = $DevPass
    $LocalDumpExists = $true
    try {
        pg_dump -h 127.0.0.1 -U $DevUser -d $DevDb --data-only @TableArgs -f $LocalDump
    } catch {
        Write-Host "No local DB found, skipping save."
        $LocalDumpExists = $false
    }

    Write-Host "Dumping prod DB ($ProdDb)..."
    $env:PGPASSWORD = $ProdPassRaw
    & /usr/lib/postgresql/17/bin/pg_dump `
        -h 127.0.0.1 -p $TunnelPort `
        -U $ProdUser -d $ProdDb `
        -Fc @ExcludeArgs -f $Dump

    Write-Host "Dropping local dev DB ($DevDb)..."
    $env:PGPASSWORD = $DevPass
    dropdb --if-exists -h 127.0.0.1 -U $DevUser $DevDb
    createdb -h 127.0.0.1 -U $DevUser $DevDb

    Write-Host "Restoring prod data to local dev DB..."
    pg_restore -h 127.0.0.1 -U $DevUser -d $DevDb --no-owner --role=$DevUser $Dump

    if ($LocalDumpExists -and (Test-Path $LocalDump)) {
        Write-Host "Restoring local excluded table data..."
        psql -h 127.0.0.1 -U $DevUser -d $DevDb -f $LocalDump -q
        Remove-Item $LocalDump
    }

    Remove-Item $Dump
    Write-Host "Done. Local dev DB synced from prod."
} finally {
    $env:PGPASSWORD = ""
    if ($SshProc -and -not $SshProc.HasExited) {
        $SshProc | Stop-Process -Force
    }
}
