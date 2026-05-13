#Requires -Version 5.1
<#
.SYNOPSIS
    Start backend services in Docker and run the web-app natively for HMR.
#>
[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments)]
    [string[]]$ExtraServices
)

$ErrorActionPreference = "Stop"
$ScriptDir = $PSScriptRoot

$services = @("mongodb","postgres","valkey","api-backend","discord-server","discord-utils","discord-event") + $ExtraServices

# Start infrastructure + backend services detached
Write-Host "Starting backend services..." -ForegroundColor Cyan
& infisical run `
    --projectId=9047f633-a675-497c-8ca2-1e75ffd95db9 `
    --env=dev `
    -- docker compose up -d --build @services

if ($LASTEXITCODE -ne 0) {
    Write-Error "docker compose failed (exit $LASTEXITCODE)"
    exit $LASTEXITCODE
}

# Run web-app natively so Windows file watchers work for HMR
Write-Host "Starting web-app dev server..." -ForegroundColor Cyan
Set-Location "$ScriptDir\web-app"

& infisical run `
    --projectId=9047f633-a675-497c-8ca2-1e75ffd95db9 `
    --env=dev `
    -- bun dev
