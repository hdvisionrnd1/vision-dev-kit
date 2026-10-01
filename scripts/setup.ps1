<#
.SYNOPSIS
  One-time setup for the vision-dev Claude Code plugin on this PC.
  - ast-grep CLI (required by the C# style hook)
  - csharp-ls (required by the csharp-lsp plugin, needs .NET SDK 6+)
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

function Test-DotnetSdk {
    if (-not (Test-Cmd dotnet)) {
        return $false
    }
    $sdks = & dotnet --list-sdks 2>$null
    return ($null -ne $sdks) -and ($sdks.Count -gt 0)
}

Write-Host "[1/5] Node.js"
if (-not (Test-Cmd node)) {
    Write-Error "Node.js is required (hooks and skill scripts run on node). Install: winget install OpenJS.NodeJS.LTS"
    exit 1
}
Write-Host "      ok: $(node --version)"

Write-Host "[2/5] ast-grep (C# style hook)"
if (Test-Cmd ast-grep) {
    Write-Host "      ok: already installed"
}
else {
    npm i -g @ast-grep/cli
}

$hasSdk = Test-DotnetSdk

Write-Host "[3/5] csharp-ls (C# code intelligence for the csharp-lsp plugin)"
if (Test-Cmd csharp-ls) {
    Write-Host "      ok: already installed"
}
elseif ($hasSdk) {
    dotnet tool install --global csharp-ls
}
else {
    Write-Host "      skipped: .NET SDK not found. Install it, then run: dotnet tool install --global csharp-ls"
    Write-Host "               (winget install Microsoft.DotNet.SDK.8)"
}

Write-Host "[4/5] ilspycmd (optional)"
if ($SkipIlspy) {
    Write-Host "      skipped"
}
elseif (Test-Cmd ilspycmd) {
    Write-Host "      ok: already installed"
}
elseif ($hasSdk) {
    dotnet tool install --global ilspycmd
}
else {
    Write-Host "      skipped: .NET SDK not found"
}

Write-Host "[5/5] Cognex VisionPro help"
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
Write-Host "Setup finished. Next, run these three commands ONE LINE AT A TIME:"
Write-Host "  claude plugin marketplace add anthropics/claude-plugins-official"
Write-Host "  claude plugin marketplace add hdvisionrnd1/vision-dev-kit"
Write-Host "  claude plugin install vision-dev@vision-dev-kit"
