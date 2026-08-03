#Requires -Version 5.1
<#
.SYNOPSIS
    Monorepo launcher. Bare invocation opens the menu; .\run.ps1 --help shows the
    direct command form. All it does is hand scripts\run.py to uv.
#>
[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments)]
    [string[]]$Arguments = @()
)

$ErrorActionPreference = "Stop"

$Uv = $null
try {
    $Uv = (Get-Command uv -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
} catch {
    $Candidate = Join-Path $env:USERPROFILE ".local\bin\uv.exe"
    if (Test-Path $Candidate) { $Uv = $Candidate }
}

if (-not $Uv) {
    Write-Error "uv not found. Install it from https://docs.astral.sh/uv/ - the launcher runs on it."
    exit 127
}

$Script = Join-Path $PSScriptRoot "scripts\run.py"
& $Uv run --script $Script @Arguments
exit $LASTEXITCODE
