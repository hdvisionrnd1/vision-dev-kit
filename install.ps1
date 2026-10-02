<#
.SYNOPSIS
  vision-dev one-click installer for Claude Code (Windows).

  Run in PowerShell (NOT as administrator):
    irm https://raw.githubusercontent.com/hdvisionrnd1/vision-dev-kit/main/install.ps1 | iex

  or double-click install.bat.

  What it does:
    1. Installs missing programs with winget (Git, Node.js, Claude Code, .NET 10 SDK, 7-Zip if needed)
    2. Downloads (or updates) this repository to %USERPROFILE%\vision-dev-kit
    3. Runs scripts\setup.ps1 (ast-grep, csharp-ls, ilspycmd, Cognex help, OMC check)
    4. Registers the plugin marketplaces and installs/updates the vision-dev plugin
    5. Verifies the result and writes a log to %USERPROFILE%\vision-dev-install.log

  Options (when running the file directly):
    -Yes          kept for compatibility (the installer no longer asks any questions)
    -CheckOnly    only report what is missing, change nothing
    -InstallDir   where to put the repository (default %USERPROFILE%\vision-dev-kit)
#>
param(
    [string]$InstallDir = "",
    [switch]$Yes,
    [switch]$CheckOnly
)

function Invoke-VisionDevInstall {
    param(
        [string]$InstallDir,
        [bool]$Yes,
        [bool]$CheckOnly
    )

    # Native tools write progress to stderr; never let that abort the installer.
    $ErrorActionPreference = "Continue"
    $ProgressPreference = "SilentlyContinue"

    $RepoUrl = "https://github.com/hdvisionrnd1/vision-dev-kit.git"
    $Marketplace = "hdvisionrnd1/vision-dev-kit"
    $OfficialMarketplace = "anthropics/claude-plugins-official"
    $PluginId = "vision-dev@vision-dev-kit"
    $RequiredPlugins = @("vision-dev@vision-dev-kit", "superpowers@claude-plugins-official", "csharp-lsp@claude-plugins-official")

    if ([string]::IsNullOrEmpty($InstallDir)) {
        if (-not [string]::IsNullOrEmpty($env:VISION_DEV_INSTALL_DIR)) {
            $InstallDir = $env:VISION_DEV_INSTALL_DIR
        }
        else {
            $InstallDir = Join-Path $env:USERPROFILE "vision-dev-kit"
        }
    }

    $problems = New-Object System.Collections.Generic.List[string]

    function Write-Step($text) {
        Write-Host ""
        Write-Host "==> $text" -ForegroundColor Cyan
    }
    function Write-Ok($text) {
        Write-Host "    [OK]   $text" -ForegroundColor Green
    }
    function Write-Warn($text) {
        Write-Host "    [WARN] $text" -ForegroundColor Yellow
    }
    function Write-Fail($text) {
        Write-Host "    [FAIL] $text" -ForegroundColor Red
    }

    function Test-Cmd($name) {
        return $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
    }

    # Reload PATH from the registry so programs installed a moment ago are found
    # without reopening PowerShell.
    function Update-SessionPath {
        $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
        $user = [Environment]::GetEnvironmentVariable("Path", "User")
        $extra = @(
            (Join-Path $env:USERPROFILE ".dotnet\tools"),
            (Join-Path $env:APPDATA "npm"),
            (Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Links")
        )
        $env:Path = (@($machine, $user) + $extra) -join ";"
    }

    function Get-DotnetSdkMajor {
        if (-not (Test-Cmd dotnet)) {
            return 0
        }
        $max = 0
        foreach ($line in (& dotnet --list-sdks 2>$null)) {
            if ($line -match '^(\d+)\.') {
                $major = [int]$Matches[1]
                if ($major -gt $max) {
                    $max = $major
                }
            }
        }
        return $max
    }

    # Run claude, show its output, return exit code + text
    function Invoke-Claude {
        $text = (& claude @args 2>&1 | ForEach-Object { "$_" }) -join "`n"
        $code = $LASTEXITCODE
        if (-not [string]::IsNullOrWhiteSpace($text)) {
            foreach ($line in ($text -split "`n")) {
                Write-Host "           $line"
            }
        }
        return @{ Code = $code; Text = $text }
    }

    # Windows PowerShell 5.1 returns a JSON array as ONE object, so unpack it explicitly.
    function Get-InstalledPlugins {
        $raw = (& claude plugin list --json 2>$null) -join "`n"
        $items = New-Object System.Collections.ArrayList
        try {
            $parsed = ConvertFrom-Json $raw
            foreach ($x in $parsed) {
                [void]$items.Add($x)
            }
        }
        catch {
            # no plugins or claude not available
        }
        return ,$items.ToArray()
    }

    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host " vision-dev installer for Claude Code" -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host " Install folder : $InstallDir"
    Write-Host " Log file       : $env:USERPROFILE\vision-dev-install.log"
    if ($CheckOnly) {
        Write-Host " Mode           : CHECK ONLY (nothing will be changed)" -ForegroundColor Yellow
    }

    $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    if ($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Write-Warn "PowerShell is running as Administrator. A normal (non-admin) window is recommended."
        Write-Warn "If Windows asks for permission while installing programs, just click Yes."
    }

    # ------------------------------------------------------------------
    Write-Step "1/5  Required programs"
    Update-SessionPath

    if (-not (Test-Cmd winget)) {
        Write-Fail "winget is not available on this PC."
        Write-Host "           Install 'App Installer' from Microsoft Store, then run this installer again."
        return $false
    }

    $vproDir = Join-Path $env:ProgramFiles "Cognex\VisionPro"
    $helpDir = $env:COGNEX_HELP_DIR
    if ([string]::IsNullOrEmpty($helpDir)) {
        $helpDir = Join-Path $env:USERPROFILE ".claude\tools\cognex-doc\VisionPro\html"
    }
    $sevenZip = Join-Path $env:ProgramFiles "7-Zip\7z.exe"

    $programs = @(
        @{ Name = "Git"; Id = "Git.Git"; Required = $true; Present = { Test-Cmd git } },
        @{ Name = "Node.js"; Id = "OpenJS.NodeJS.LTS"; Required = $true; Present = { Test-Cmd node } },
        @{ Name = "Claude Code"; Id = "Anthropic.ClaudeCode"; Required = $true; Present = { Test-Cmd claude } },
        @{ Name = ".NET 10 SDK"; Id = "Microsoft.DotNet.SDK.10"; Required = $false; Present = { (Get-DotnetSdkMajor) -ge 10 } }
    )
    if ((Test-Path $vproDir) -and (-not (Test-Path $helpDir))) {
        $programs += @{ Name = "7-Zip (for VisionPro help)"; Id = "7zip.7zip"; Required = $false; Present = { (Test-Path $sevenZip) -or (Test-Cmd 7z) } }
    }

    $missing = @()
    foreach ($p in $programs) {
        if (& $p.Present) {
            Write-Ok $p.Name
        }
        else {
            $kind = "recommended"
            if ($p.Required) {
                $kind = "required"
            }
            Write-Warn "$($p.Name) is missing ($kind)"
            $missing += $p
        }
    }

    if ($missing.Count -gt 0) {
        if ($CheckOnly) {
            Write-Host "    Would install: $(($missing | ForEach-Object { $_.Id }) -join ', ')"
        }
        else {
            Write-Host ""
            Write-Host "    These will be installed with winget:"
            foreach ($p in $missing) {
                Write-Host "      - $($p.Name)  (winget install $($p.Id))"
            }
            Write-Host "    Windows may ask for permission (UAC) - click Yes."
            # Installed without asking: this is a one-click installer.
            foreach ($p in $missing) {
                Write-Host "    installing $($p.Name) ..."
                & winget install --id $p.Id --exact --source winget --accept-package-agreements --accept-source-agreements | Out-Host
                Update-SessionPath
                if (& $p.Present) {
                    Write-Ok "$($p.Name) installed"
                }
                else {
                    Write-Fail "$($p.Name) was not detected after installing."
                    $problems.Add("$($p.Name): close this window, open a NEW PowerShell window and run the installer again. If it still fails: winget install $($p.Id)")
                }
            }
        }
    }

    $requiredMissing = @($programs | Where-Object { $_.Required -and (-not (& $_.Present)) })
    if ($requiredMissing.Count -gt 0) {
        if ($CheckOnly) {
            Write-Host ""
            Write-Host "CHECK ONLY: required programs are missing, so the remaining steps cannot be checked." -ForegroundColor Yellow
            return $true
        }
        Write-Fail "Required programs are missing: $(($requiredMissing | ForEach-Object { $_.Name }) -join ', ')"
        foreach ($item in $problems) {
            Write-Host "           - $item" -ForegroundColor Yellow
        }
        return $false
    }

    # ------------------------------------------------------------------
    Write-Step "2/5  Download vision-dev-kit"
    $isRepo = Test-Path (Join-Path $InstallDir ".git")
    if ($CheckOnly) {
        if ($isRepo) {
            Write-Ok "already downloaded: $InstallDir"
        }
        else {
            Write-Host "    Would download to $InstallDir"
        }
    }
    elseif ($isRepo) {
        & git -C $InstallDir pull --ff-only | Out-Host
        if ($LASTEXITCODE -eq 0) {
            Write-Ok "updated: $InstallDir"
        }
        else {
            Write-Warn "could not update (local changes?). Continuing with the existing files."
            $problems.Add("vision-dev-kit folder could not be updated with 'git pull' ($InstallDir)")
        }
    }
    elseif ((Test-Path $InstallDir) -and ((Get-ChildItem $InstallDir -Force | Measure-Object).Count -gt 0)) {
        Write-Fail "$InstallDir already exists and is not a git download."
        Write-Host "           Rename or delete that folder, then run the installer again."
        return $false
    }
    else {
        $parent = Split-Path -Parent $InstallDir
        New-Item -ItemType Directory -Force $parent | Out-Null
        & git clone $RepoUrl $InstallDir | Out-Host
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "git clone failed."
            Write-Host "           Check that https://github.com opens in your browser (company firewall/proxy?)."
            Write-Host "           'Permission denied': run the installer from a normal PowerShell window, or use -InstallDir C:\dev\vision-dev-kit"
            return $false
        }
        Write-Ok "downloaded: $InstallDir"
    }

    # ------------------------------------------------------------------
    Write-Step "3/5  Prepare this PC (scripts\setup.ps1)"
    if ($CheckOnly) {
        Write-Host "    Would run scripts\setup.ps1"
    }
    else {
        $global:VisionDevSetupTodo = $null
        $setupArgs = @{ FromInstaller = $true }
        if ($Yes) {
            $setupArgs["DisableConflicts"] = $true
        }
        # Out-Host: show everything setup.ps1 and the tools it runs print. Without it, that output
        # becomes this function's return value and never reaches the screen or the log.
        & (Join-Path $InstallDir "scripts\setup.ps1") @setupArgs | Out-Host
        if ($null -ne $global:VisionDevSetupTodo) {
            foreach ($item in $global:VisionDevSetupTodo) {
                $problems.Add($item)
            }
        }
    }

    # ------------------------------------------------------------------
    Write-Step "4/5  Install the Claude Code plugin"
    if ($CheckOnly) {
        $installed = Get-InstalledPlugins
        $vd = $installed | Where-Object { $_.id -eq $PluginId }
        if ($null -ne $vd) {
            Write-Ok "vision-dev $($vd.version) is installed (would update)"
        }
        else {
            Write-Host "    Would register marketplaces and install $PluginId"
        }
    }
    else {
        Write-Host "    register: $OfficialMarketplace"
        $r = Invoke-Claude plugin marketplace add $OfficialMarketplace
        if (($r.Code -ne 0) -and ($r.Text -notmatch 'already')) {
            $r = Invoke-Claude plugin marketplace add "https://github.com/$OfficialMarketplace.git"
            if (($r.Code -ne 0) -and ($r.Text -notmatch 'already')) {
                $problems.Add("could not register $OfficialMarketplace (see the log)")
            }
        }

        Write-Host "    register: $Marketplace"
        $r = Invoke-Claude plugin marketplace add $Marketplace
        if ($r.Text -match 'network source differs') {
            Write-Host "    vision-dev-kit was registered from a different source before. Re-registering..."
            Invoke-Claude plugin marketplace remove vision-dev-kit | Out-Null
            $r = Invoke-Claude plugin marketplace add $Marketplace
        }
        if (($r.Code -ne 0) -and ($r.Text -notmatch 'already')) {
            $r = Invoke-Claude plugin marketplace add "https://github.com/$Marketplace.git"
        }
        if (($r.Code -ne 0) -and ($r.Text -notmatch 'already')) {
            Write-Fail "could not register $Marketplace"
            $problems.Add("could not register $Marketplace (see the log)")
        }
        Invoke-Claude plugin marketplace update vision-dev-kit | Out-Null

        $installed = Get-InstalledPlugins
        $vd = $installed | Where-Object { $_.id -eq $PluginId }
        if ($null -ne $vd) {
            Write-Host "    vision-dev $($vd.version) is already installed - updating"
            Invoke-Claude plugin update $PluginId | Out-Null
            foreach ($dep in @("superpowers@claude-plugins-official", "csharp-lsp@claude-plugins-official")) {
                if ($null -eq ($installed | Where-Object { $_.id -eq $dep })) {
                    Invoke-Claude plugin install $dep | Out-Null
                }
            }
        }
        else {
            Write-Host "    install: $PluginId"
            Invoke-Claude plugin install $PluginId | Out-Null
        }
    }

    # ------------------------------------------------------------------
    Write-Step "5/5  Verify"
    $installed = Get-InstalledPlugins
    $allOk = $true
    foreach ($id in $RequiredPlugins) {
        $p = $installed | Where-Object { $_.id -eq $id }
        if ($null -eq $p) {
            if ($CheckOnly) {
                Write-Warn "$id is not installed"
            }
            else {
                Write-Fail "$id is not installed"
                $allOk = $false
            }
        }
        elseif ($p.enabled -ne $true) {
            Write-Fail "$id is installed but disabled (claude plugin enable $id)"
            $allOk = $false
        }
        else {
            Write-Ok "$id $($p.version)"
        }
    }
    # OMC must be off (it conflicts with Superpowers)
    foreach ($p in $installed) {
        if ($p.id -like "oh-my-claudecode@*") {
            if ($p.enabled -eq $true) {
                Write-Warn "$($p.id) is still enabled - it conflicts with Superpowers"
                if (-not $CheckOnly) {
                    $problems.Add("OMC is still enabled: run 'claude plugin disable $($p.id)' (README: OMC)")
                }
            }
            else {
                Write-Ok "$($p.id) is disabled (no conflict)"
            }
        }
    }

    $listText = (& claude plugin list 2>&1 | ForEach-Object { "$_" }) -join "`n"
    if ($listText -match 'failed to load') {
        Write-Fail "a plugin failed to load:"
        foreach ($line in ($listText -split "`n" | Where-Object { $_ -match 'Error' })) {
            Write-Host "           $line" -ForegroundColor Red
        }
        $allOk = $false
    }
    if ((-not $allOk) -and (-not $CheckOnly)) {
        $problems.Add("plugin check failed - see README 'Troubleshooting', step 3/4 (or send the log file)")
    }

    # ------------------------------------------------------------------
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Cyan
    if ($CheckOnly) {
        Write-Host " CHECK ONLY finished. Nothing was changed." -ForegroundColor Cyan
        return $true
    }
    if ($problems.Count -eq 0) {
        Write-Host " DONE. vision-dev is installed." -ForegroundColor Green
    }
    else {
        Write-Host " Installed, but please check these items:" -ForegroundColor Yellow
        foreach ($item in $problems) {
            Write-Host "   - $item" -ForegroundColor Yellow
        }
    }
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host " Next:"
    Write-Host "   1. Close this window and open a NEW PowerShell window."
    Write-Host "   2. Type:  claude"
    Write-Host "   3. First time only: log in to Claude when asked."
    Write-Host " If something went wrong, send this file to the person who shared the kit:"
    Write-Host "   $env:USERPROFILE\vision-dev-install.log"
    return ($problems.Count -eq 0)
}

$__visionDevLog = Join-Path $env:USERPROFILE "vision-dev-install.log"
$__visionDevOldEncoding = [Console]::OutputEncoding
try {
    Start-Transcript -Path $__visionDevLog -Force | Out-Null
}
catch {
    # transcript is optional
}
try {
    # claude prints symbols such as a check mark; read its output as UTF-8
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $__visionDevResult = Invoke-VisionDevInstall -InstallDir $InstallDir -Yes ([bool]$Yes) -CheckOnly ([bool]$CheckOnly)
}
finally {
    [Console]::OutputEncoding = $__visionDevOldEncoding
    try {
        Stop-Transcript | Out-Null
    }
    catch {
        # transcript was not running
    }
}
