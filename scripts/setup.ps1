<#
.SYNOPSIS
  One-time setup for the vision-dev Claude Code plugin on this PC.
  - ast-grep CLI (required by the C# style hook)
  - ilspycmd (optional, decompile MIL/Cognex DLLs when docs are not enough)
  - Cognex VisionPro help extraction (only if VisionPro is installed)
#>
param(
    [switch]$SkipIlspy,
    [switch]$SkipCognexHelp
)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

function Test-Cmd($name) {
    return $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

Write-Host "[1/4] Node.js"
if (-not (Test-Cmd node)) {
    Write-Error "Node.js is required (hooks and skill scripts run on node). Install: winget install OpenJS.NodeJS.LTS"
    exit 1
}
Write-Host "      ok: $(node --version)"

Write-Host "[2/4] ast-grep (C# style hook)"
if (Test-Cmd ast-grep) {
    Write-Host "      ok: already installed"
}
else {
    npm i -g @ast-grep/cli
}

Write-Host "[3/4] ilspycmd (optional)"
if ($SkipIlspy) {
    Write-Host "      skipped"
}
elseif (Test-Cmd ilspycmd) {
    Write-Host "      ok: already installed"
}
elseif (Test-Cmd dotnet) {
    dotnet tool install -g ilspycmd
}
else {
    Write-Host "      skipped: dotnet SDK not found"
}

Write-Host "[4/4] Cognex VisionPro help"
$helpDir = Join-Path $env:USERPROFILE ".claude\tools\cognex-doc\VisionPro\html"
$vpro = Join-Path $env:ProgramFiles "Cognex\VisionPro"
if ($SkipCognexHelp) {
    Write-Host "      skipped"
}
elseif (Test-Path $helpDir) {
    Write-Host "      ok: $helpDir"
}
elseif (Test-Path $vpro) {
    & (Join-Path $here "extract-cognex-help.ps1")
}
else {
    Write-Host "      skipped: VisionPro is not installed on this PC"
}

Write-Host ""
Write-Host "Setup finished. Next, run these two commands ONE LINE AT A TIME:"
Write-Host "  claude plugin marketplace add hdvisionrnd1/vision-dev-kit"
Write-Host "  claude plugin install vision-dev@vision-dev-kit"
