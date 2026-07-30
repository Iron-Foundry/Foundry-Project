#!/usr/bin/env pwsh
# One-command test runner for the monorepo (PowerShell port of run-tests.sh).
#
#   .\run-tests.ps1 lint          ruff + pyright per Python module, tsc for web-app
#   .\run-tests.ps1 fast          fast suites only (no Docker): api + discord + cache + web
#   .\run-tests.ps1 integration   real-infra suites (Docker): api + discord testcontainers
#   .\run-tests.ps1 e2e           full stack E2E (Docker compose): playwright + discord_e2e
#   .\run-tests.ps1 all           everything (default)
#
# E2E auto-detects free host ports: it uses 3000/8000/5432/6379 when free, otherwise
# 13000/18000/55432/16379 (so it never fights a running dev stack), and always tears
# the stack down on exit.
#
# Windows PowerShell 5.1 compatible: no &&, no ternary, no null-coalescing.

$ErrorActionPreference = 'Continue'

$Root = $PSScriptRoot
$Compose = Join-Path $Root 'integration\docker-compose.e2e.yml'
$script:Failures = 0

function Write-Ok([string]$Message) { Write-Host $Message -ForegroundColor Green }
function Write-Bad([string]$Message) { Write-Host $Message -ForegroundColor Red }
function Write-Header([string]$Message) {
  Write-Host ''
  Write-Host "== $Message ==" -ForegroundColor White
}

# Resolve uv/bun. A non-login shell may not have them on PATH, so also probe the
# standard per-user install directories.
function Resolve-Tool([string]$Name) {
  try {
    $cmd = Get-Command $Name -CommandType Application -ErrorAction Stop | Select-Object -First 1
    if ($cmd) { return $cmd.Source }
  } catch {}
  foreach ($sub in @('.local\bin', '.bun\bin', '.cargo\bin')) {
    $candidate = Join-Path (Join-Path $env:USERPROFILE $sub) "$Name.exe"
    if (Test-Path $candidate) { return $candidate }
  }
  return $null
}

$Uv = Resolve-Tool 'uv'
$Bun = Resolve-Tool 'bun'

if (-not $Uv -and -not $Bun) {
  Write-Bad "Neither uv nor bun found (searched PATH and $env:USERPROFILE)."
  Write-Bad 'Install them, or run from a shell where they resolve.'
}

# Run a native command and throw on a non-zero exit so Invoke-Step records a failure.
# Arguments are passed as one array: bare -q / -p / -o would otherwise bind to
# PowerShell's own common parameters instead of reaching the tool.
function Invoke-Native {
  param(
    [Parameter(Mandatory = $true, Position = 0)][string]$Exe,
    [Parameter(Position = 1)][string[]]$Arguments = @(),
    [switch]$Quiet
  )
  if (-not $Exe) { throw 'tool not found' }
  if ($Quiet) { & $Exe @Arguments | Out-Null } else { & $Exe @Arguments }
  if ($LASTEXITCODE -ne 0) { throw "$(Split-Path -Leaf $Exe) $($Arguments -join ' ') exited $LASTEXITCODE" }
}

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Directory,
    [Parameter(Mandatory = $true)][scriptblock]$Body
  )
  Write-Header $Name
  $ok = $true
  $err = ''
  Push-Location $Directory
  try {
    & $Body
  } catch {
    $ok = $false
    $err = $_.Exception.Message
  } finally {
    Pop-Location
  }
  if ($ok) {
    Write-Ok "PASS: $Name"
  } else {
    if ($err) { Write-Bad $err }
    Write-Bad "FAIL: $Name"
    $script:Failures = $script:Failures + 1
  }
}

function Test-Docker {
  docker info 2>$null | Out-Null
  return ($LASTEXITCODE -eq 0)
}

function Test-PortBusy([int]$Port) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $client.Connect('127.0.0.1', $Port)
    return $true
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Test-Url([string]$Url) {
  try {
    Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Require-Docker([string]$Scope) {
  if (Test-Docker) { return $true }
  Write-Bad "Docker is not available - skipping '$Scope'."
  return $false
}

# ----- fast suites -------------------------------------------------------------

$PytestFast = @('run', 'pytest', '-q', '-p', 'no:cacheprovider')

function Invoke-Fast {
  Invoke-Step 'api-backend (fast)' (Join-Path $Root 'api-backend') {
    Invoke-Native $Uv $PytestFast
  }
  Invoke-Step 'discord-server (fast)' (Join-Path $Root 'discord-server') {
    Invoke-Native $Uv $PytestFast
  }
  Invoke-Step 'discord-utils (fast)' (Join-Path $Root 'discord-utils') {
    Invoke-Native $Uv $PytestFast
  }
  Invoke-Step 'osrs-cache-service (fast)' (Join-Path $Root 'osrs-cache-service') {
    Invoke-Native $Uv $PytestFast
  }
  Invoke-Step 'web-app (unit)' (Join-Path $Root 'web-app') {
    Invoke-Native $Bun @('test', 'tests/')
  }
}

# ----- lint + typecheck --------------------------------------------------------

# discord-event has no pytest suite yet, so it appears here (lint + types) but
# not in Invoke-Fast.
$PyModules = @('api-backend', 'discord-server', 'discord-utils', 'discord-event', 'osrs-cache-service')

function Invoke-Lint {
  foreach ($module in $PyModules) {
    $dir = Join-Path $Root $module
    if (-not (Test-Path $dir)) { continue }
    Invoke-Step "$module (ruff)" $dir {
      Invoke-Native $Uv @('run', 'ruff', 'check', '.')
      Invoke-Native $Uv @('run', 'ruff', 'format', '--check', '.')
    }
    Invoke-Step "$module (pyright)" $dir {
      Invoke-Native $Uv @('run', 'pyright')
    }
  }
  Invoke-Step 'web-app (tsc)' (Join-Path $Root 'web-app') {
    Invoke-Native $Bun @('run', 'typecheck')
  }
}

# ----- integration (testcontainers, no compose) --------------------------------

function Invoke-Integration {
  if (-not (Require-Docker 'integration')) { return }
  Invoke-Step 'api-backend (integration)' (Join-Path $Root 'api-backend') {
    Invoke-Native $Uv @('run', 'pytest', '-m', 'integration', '-o', 'addopts=', 'app/tests/integration', '-q', '-p', 'no:cacheprovider')
  }
  Invoke-Step 'discord-server (integration)' (Join-Path $Root 'discord-server') {
    Invoke-Native $Uv @('run', 'pytest', '-m', 'integration', '-o', 'addopts=', 'tests/integration', '-q', '-p', 'no:cacheprovider')
  }
  Invoke-Step 'discord-utils (integration)' (Join-Path $Root 'discord-utils') {
    Invoke-Native $Uv @('run', 'pytest', '-m', 'integration', '-o', 'addopts=', 'tests/integration', '-q', '-p', 'no:cacheprovider')
  }
}

# ----- E2E (docker compose stack) ----------------------------------------------

function Invoke-E2E {
  if (-not (Require-Docker 'e2e')) { return }

  $web = 3000; $api = 8000; $pg = 5432; $vk = 6379
  $override = ''
  if ((Test-PortBusy 3000) -or (Test-PortBusy 8000) -or (Test-PortBusy 5432) -or (Test-PortBusy 6379)) {
    $web = 13000; $api = 18000; $pg = 55432; $vk = 16379
    Write-Ok "Default ports busy - using $web/$api/$pg/$vk for the E2E stack."
    $override = Join-Path $env:TEMP "foundry-e2e-override-$([guid]::NewGuid().ToString('N')).yml"
    $overrideYaml = @"
services:
  postgres:
    ports: !override ["127.0.0.1:${pg}:5432"]
  valkey:
    ports: !override ["127.0.0.1:${vk}:6379"]
  api-backend:
    ports: !override ["127.0.0.1:${api}:8000"]
    environment:
      API_BACKEND_URL: http://localhost:$api
      FRONTEND_URL: http://localhost:$web
  web-app:
    build:
      args:
        BUN_PUBLIC_API_URL: http://localhost:$api
    ports: !override ["127.0.0.1:${web}:3000"]
    environment:
      BUN_PUBLIC_API_URL: http://localhost:$api
      SITE_URL: http://localhost:$web
"@
    [System.IO.File]::WriteAllText($override, $overrideYaml, (New-Object System.Text.UTF8Encoding($false)))
  }

  $files = @('-f', $Compose)
  if ($override) { $files += @('-f', $override) }

  try {
    Write-Header 'Building and starting E2E stack'
    # Clear any stack left by an interrupted prior run so we never reuse stale
    # containers/volumes (which can leave the stack unhealthy).
    docker compose -f $Compose down -v 2>$null | Out-Null
    docker compose @files up --build --force-recreate -d
    if ($LASTEXITCODE -ne 0) {
      Write-Bad 'FAIL: stack failed to start'
      $script:Failures = $script:Failures + 1
      return
    }

    Write-Header 'Waiting for api + web'
    $ready = $false
    for ($i = 0; $i -lt 60; $i++) {
      if ((Test-Url "http://localhost:$api/health") -and (Test-Url "http://localhost:$web/")) {
        $ready = $true
        break
      }
      Start-Sleep -Seconds 3
    }
    if (-not $ready) {
      Write-Bad 'FAIL: stack did not become ready'
      $script:Failures = $script:Failures + 1
      docker compose @files logs --tail=50
      return
    }
    Write-Ok 'Stack ready.'

    $env:E2E_BASE_URL = "http://localhost:$web"
    $env:E2E_API_URL = "http://localhost:$api"
    $env:E2E_DB_DSN = "postgresql://foundry:foundry@localhost:$pg/foundry"
    $env:E2E_VALKEY_URI = "redis://localhost:$vk"
    $env:E2E_METRICS_API_KEY = 'e2e-metrics-key'
    $env:E2E_JWT_SECRET = 'e2e-test-secret-e2e-test-secret-01'

    Invoke-Step 'Playwright (web -> api -> DB)' (Join-Path $Root 'integration\e2e') {
      Invoke-Native $Bun @('install') -Quiet
      Invoke-Native $Bun @('run', 'browser') -Quiet
      Invoke-Native $Bun @('run', 'test')
    }

    Invoke-Step 'discord_e2e (discord -> api, api -> runelite, auth journey)' (Join-Path $Root 'integration\discord_e2e') {
      Invoke-Native $Uv @('sync') -Quiet
      Invoke-Native $Uv $PytestFast
    }
  } finally {
    Write-Header 'Tearing down E2E stack'
    docker compose @files down -v 2>$null | Out-Null
    if ($override -and (Test-Path $override)) { Remove-Item $override -Force }
  }
}

# ----- dispatch ----------------------------------------------------------------

$scope = 'all'
if ($args.Count -gt 0) { $scope = [string]$args[0] }

switch ($scope) {
  'lint' { Invoke-Lint }
  'fast' { Invoke-Fast }
  'integration' { Invoke-Integration }
  'e2e' { Invoke-E2E }
  'all' { Invoke-Lint; Invoke-Fast; Invoke-Integration; Invoke-E2E }
  default {
    [Console]::Error.WriteLine("usage: .\run-tests.ps1 {lint|fast|integration|e2e|all}")
    exit 2
  }
}

Write-Header 'Summary'
if ($script:Failures -eq 0) {
  Write-Ok 'All selected suites passed.'
} else {
  Write-Bad "$script:Failures suite(s) failed."
}
exit $script:Failures
