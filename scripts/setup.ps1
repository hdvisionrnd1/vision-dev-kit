<#
.SYNOPSIS
  One-time setup for the vision-dev Claude Code plugin on this PC.
  - ast-grep CLI (required by the C# style hook)
  - csharp-ls (required by the csharp-lsp plugin, needs .NET 10 SDK)
  - ilspycmd (optional, decompile MIL/Cognex DLLs, needs .NET 10 SDK)
  - Cognex VisionPro help extraction (only if VisionPro is installed)
#>
param(
    [switch]$SkipIlspy,
    [switch]$SkipCognexHelp,
    # Kept for compatibility: OMC is now disabled automatically (it conflicts with Superpowers)
    [switch]$DisableConflicts,
    # Do NOT disable oh-my-claudecode (same as env VISION_DEV_KEEP_OMC=1)
    [switch]$KeepOmc,
    # Called from install.ps1: skip the "Next, run these commands" hint and hand the todo list back
    [switch]$FromInstaller
)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$todo = New-Object System.Collections.Generic.List[string]

function Test-Cmd($name) {
    return $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

# Highest installed .NET SDK major version (0 = none)
function Get-DotnetSdkMajor {
    if (-not (Test-Cmd dotnet)) {
        return 0
    }
    $max = 0
    $lines = & dotnet --list-sdks 2>$null
    foreach ($line in $lines) {
        if ($line -match '^(\d+)\.') {
            $major = [int]$Matches[1]
            if ($major -gt $max) {
                $max = $major
            }
        }
    }
    return $max
}

function Install-DotnetTool($toolName, $label) {
    if (Test-Cmd $toolName) {
        Write-Host "      ok: already installed"
        return
    }
    if ($script:sdkMajor -lt 10) {
        if ($script:sdkMajor -eq 0) {
            Write-Host "      skipped: .NET SDK not found."
        }
        else {
            Write-Host "      skipped: .NET SDK $($script:sdkMajor) found, but $toolName needs .NET 10 SDK."
        }
        Write-Host "      fix: winget install Microsoft.DotNet.SDK.10   (then reopen PowerShell and run setup.ps1 again)"
        $script:todo.Add("$label : install .NET 10 SDK (winget install Microsoft.DotNet.SDK.10), reopen PowerShell, run setup.ps1 again")
        return
    }
    & dotnet tool install --global $toolName
    if ($LASTEXITCODE -ne 0) {
        Write-Host "      FAILED: dotnet tool install --global $toolName (exit $LASTEXITCODE)"
        Write-Host "      check internet/proxy access to api.nuget.org, then run setup.ps1 again"
        $script:todo.Add("$label : 'dotnet tool install --global $toolName' failed (check network, run setup.ps1 again)")
    }
    else {
        Write-Host "      installed. Reopen PowerShell before using it."
    }
}

# oh-my-claudecode (OMC) conflicts with Superpowers: both tell Claude how to work.
# OMC also writes its own block into ~/.claude/CLAUDE.md, which stays even after the plugin is disabled.
function Resolve-OmcConflict {
    $cfg = $env:CLAUDE_CONFIG_DIR
    if ([string]::IsNullOrEmpty($cfg)) {
        $cfg = Join-Path $env:USERPROFILE ".claude"
    }
    $settingsPath = Join-Path $cfg "settings.json"
    $claudeMdPath = Join-Path $cfg "CLAUDE.md"

    $enabledIds = @()
    if (Test-Path $settingsPath) {
        try {
            $settings = Get-Content $settingsPath -Raw | ConvertFrom-Json
            if ($null -ne $settings.enabledPlugins) {
                foreach ($prop in $settings.enabledPlugins.PSObject.Properties) {
                    if (($prop.Name -like "oh-my-claudecode@*") -and ($prop.Value -eq $true)) {
                        $enabledIds += $prop.Name
                    }
                }
            }
        }
        catch {
            Write-Host "      could not read $settingsPath ($($_.Exception.Message))"
        }
    }

    $hasBlock = $false
    $claudeMd = ""
    if (Test-Path $claudeMdPath) {
        $claudeMd = [System.IO.File]::ReadAllText($claudeMdPath)
        if ($claudeMd -match '(?s)<!-- OMC:START -->.*?<!-- OMC:END -->') {
            $hasBlock = $true
        }
    }

    if (($enabledIds.Count -eq 0) -and (-not $hasBlock)) {
        Write-Host "      ok: oh-my-claudecode is not active"
        return
    }

    Write-Host "      oh-my-claudecode (OMC) found:" -ForegroundColor Yellow
    foreach ($id in $enabledIds) {
        Write-Host "        - plugin enabled: $id"
    }
    if ($hasBlock) {
        Write-Host "        - OMC instructions block in $claudeMdPath"
    }
    $keep = $KeepOmc -or ($env:VISION_DEV_KEEP_OMC -eq "1")
    if ($keep) {
        Write-Host "      left as is (-KeepOmc / VISION_DEV_KEEP_OMC=1)."
        $script:todo.Add("OMC : kept enabled on request - it will conflict with Superpowers (README: OMC)")
        return
    }

    Write-Host "      OMC conflicts with Superpowers (installed with vision-dev), so it is turned off automatically:"
    Write-Host "        - the OMC plugin is disabled (not uninstalled)"
    Write-Host "        - the OMC block is moved out of CLAUDE.md (backup kept)"
    Write-Host "        - the OMC status bar (HUD) is NOT touched and keeps working"

    foreach ($id in $enabledIds) {
        if (Test-Cmd claude) {
            & claude plugin disable $id
            if ($LASTEXITCODE -ne 0) {
                Write-Host "      FAILED: claude plugin disable $id"
                $script:todo.Add("OMC : run 'claude plugin disable $id' manually")
            }
        }
        else {
            $script:todo.Add("OMC : 'claude' command not found. Install Claude Code, then run 'claude plugin disable $id'")
        }
    }

    if ($hasBlock) {
        $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
        $backup = "$claudeMdPath.bak-before-vision-dev-$stamp"
        Copy-Item $claudeMdPath $backup
        $cleaned = [regex]::Replace($claudeMd, '(?s)<!-- OMC:START -->.*?<!-- OMC:END -->\r?\n?', '')
        [System.IO.File]::WriteAllText($claudeMdPath, $cleaned, (New-Object System.Text.UTF8Encoding $false))
        Write-Host "      removed OMC block from CLAUDE.md (backup: $backup)"
    }

    # The OMC HUD is a separate statusLine script; it keeps working while the plugin is disabled.
    $usesHud = $false
    if (Test-Path $settingsPath) {
        $usesHud = (Get-Content $settingsPath -Raw) -match 'omc-hud'
    }
    if ($usesHud) {
        Write-Host "      status bar (OMC HUD): kept as is"
    }

    Write-Host "      done. To undo later:" -ForegroundColor Green
    foreach ($id in $enabledIds) {
        Write-Host "        claude plugin enable $id"
    }
    if ($hasBlock) {
        Write-Host "        and restore CLAUDE.md from the backup above"
    }
}

Write-Host "[1/6] Node.js"
if (-not (Test-Cmd node)) {
    Write-Host "      FAILED: Node.js is not installed."
    Write-Host "      fix: winget install OpenJS.NodeJS.LTS   (then reopen PowerShell and run setup.ps1 again)"
    $global:VisionDevSetupTodo = @("Node.js : not installed")
    exit 1
}
Write-Host "      ok: $(node --version)"

Write-Host "[2/6] ast-grep (C# style hook)"
if (Test-Cmd ast-grep) {
    Write-Host "      ok: already installed"
}
else {
    & npm i -g @ast-grep/cli
    if ($LASTEXITCODE -ne 0) {
        Write-Host "      FAILED: npm i -g @ast-grep/cli (exit $LASTEXITCODE)"
        Write-Host "      check internet/proxy access to registry.npmjs.org, then run setup.ps1 again"
        $todo.Add("ast-grep : 'npm i -g @ast-grep/cli' failed (check network, run setup.ps1 again)")
    }
    else {
        Write-Host "      installed."
    }
}

$sdkMajor = Get-DotnetSdkMajor

Write-Host "[3/6] csharp-ls (C# code intelligence for the csharp-lsp plugin)"
Install-DotnetTool "csharp-ls" "csharp-ls"

Write-Host "[4/6] ilspycmd (optional)"
if ($SkipIlspy) {
    Write-Host "      skipped"
}
else {
    Install-DotnetTool "ilspycmd" "ilspycmd (optional)"
}

Write-Host "[5/6] Cognex VisionPro help"
$helpDir = Join-Path $env:USERPROFILE ".claude\tools\cognex-doc\VisionPro\html"
$vpro = Join-Path $env:ProgramFiles "Cognex\VisionPro"
if ($SkipCognexHelp) {
    Write-Host "      skipped"
}
elseif (Test-Path $helpDir) {
    Write-Host "      ok: $helpDir"
}
elseif (Test-Path $vpro) {
    try {
        & (Join-Path $here "extract-cognex-help.ps1")
    }
    catch {
        Write-Host "      FAILED: $($_.Exception.Message)"
        $todo.Add("Cognex help : fix the error above, then run: powershell -ExecutionPolicy Bypass -File .\scripts\extract-cognex-help.ps1")
    }
}
else {
    Write-Host "      skipped: VisionPro is not installed on this PC"
}

Write-Host "[6/6] Conflicting plugins (oh-my-claudecode)"
Resolve-OmcConflict

Write-Host ""
if ($todo.Count -gt 0) {
    Write-Host "Setup finished, but these steps need attention:" -ForegroundColor Yellow
    foreach ($item in $todo) {
        Write-Host "  - $item" -ForegroundColor Yellow
    }
    if (-not $FromInstaller) {
        Write-Host "(You can continue with the plugin install below and fix these later.)"
    }
    Write-Host ""
}
else {
    Write-Host "Setup finished." -ForegroundColor Green
}
if ($FromInstaller) {
    $global:VisionDevSetupTodo = $todo
    return
}
Write-Host "Next, run these three commands ONE LINE AT A TIME:"
Write-Host "  claude plugin marketplace add anthropics/claude-plugins-official"
Write-Host "  claude plugin marketplace add hdvisionrnd1/vision-dev-kit"
Write-Host "  claude plugin install vision-dev@vision-dev-kit"
