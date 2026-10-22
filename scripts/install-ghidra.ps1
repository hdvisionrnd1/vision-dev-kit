<#
.SYNOPSIS
  Install Ghidra (and a 64-bit JDK 21 if needed) for REA native decompiling.
  - JDK 21+: uses JAVA_HOME or an installed JDK; otherwise winget install Microsoft.OpenJDK.21
  - Ghidra: downloads the pinned release from GitHub, checks SHA-256, extracts it
    to %LOCALAPPDATA%\Programs\Ghidra (no administrator rights needed)
  - Sets the user environment variables JAVA_HOME and GHIDRA_INSTALL_DIR
  Prints "GHIDRA_INSTALL_DIR=..." and "JAVA_HOME=..." at the end; exit code 0 = ready.

.PARAMETER Dest
  Folder to extract Ghidra into (default %LOCALAPPDATA%\Programs\Ghidra)
.PARAMETER NoEnv
  Do not change user environment variables (for testing)
.PARAMETER Force
  Download Ghidra even if GHIDRA_INSTALL_DIR already points at a Ghidra folder
#>
param(
    [string]$Dest = (Join-Path $env:LOCALAPPDATA "Programs\Ghidra"),
    [switch]$NoEnv,
    [switch]$Force
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

$GhidraVersion = "12.1.4"
$GhidraUrl = "https://github.com/NationalSecurityAgency/ghidra/releases/download/Ghidra_12.1.4_build/ghidra_12.1.4_PUBLIC_20260921.zip"
$GhidraSha256 = "ddac49f903da9d5bac833e5cc79395098b9c33cfd3279be5f31bd00387d2d4db"

function Get-EnvAny($name) {
    foreach ($scope in @("Process", "User", "Machine")) {
        $v = [Environment]::GetEnvironmentVariable($name, $scope)
        if (-not [string]::IsNullOrEmpty($v)) {
            return $v
        }
    }
    return ""
}

# Full 64-bit JDK with major version >= 21 (javac present, 'release' file says JAVA_VERSION)
function Test-Jdk21($dir) {
    if ([string]::IsNullOrEmpty($dir)) {
        return $false
    }
    if (-not (Test-Path (Join-Path $dir "bin\javac.exe"))) {
        return $false
    }
    $release = Join-Path $dir "release"
    if (-not (Test-Path $release)) {
        return $false
    }
    $text = Get-Content $release -Raw
    if ($text -match 'JAVA_VERSION="(\d+)') {
        if ([int]$Matches[1] -lt 21) {
            return $false
        }
    }
    else {
        return $false
    }
    if (($text -match 'OS_ARCH="([^"]+)"') -and ($Matches[1] -notmatch '64')) {
        return $false
    }
    return $true
}

function Find-Jdk21 {
    $candidates = @(Get-EnvAny "JAVA_HOME")
    foreach ($root in @("$env:ProgramFiles\Microsoft", "$env:ProgramFiles\Eclipse Adoptium", "$env:ProgramFiles\Java", "$env:ProgramFiles\Zulu")) {
        if (Test-Path $root) {
            foreach ($d in (Get-ChildItem $root -Directory -Filter "*jdk*" -ErrorAction SilentlyContinue | Sort-Object Name -Descending)) {
                $candidates += $d.FullName
            }
        }
    }
    foreach ($c in $candidates) {
        if (Test-Jdk21 $c) {
            return $c
        }
    }
    return ""
}

function Test-Ghidra($dir) {
    if ([string]::IsNullOrEmpty($dir)) {
        return $false
    }
    return ((Test-Path (Join-Path $dir "Ghidra\application.properties")) -and (Test-Path (Join-Path $dir "support\analyzeHeadless.bat")))
}

$ok = $true

# ---------- JDK 21 ----------
$jdk = Find-Jdk21
if ($jdk -eq "") {
    Write-Host "      JDK 21 not found - installing Microsoft OpenJDK 21 with winget (Windows may ask for permission)"
    & winget install --id Microsoft.OpenJDK.21 --exact --source winget --accept-package-agreements --accept-source-agreements | Out-Host
    $jdk = Find-Jdk21
}
if ($jdk -eq "") {
    Write-Host "      FAILED: no 64-bit JDK 21 found after installing. Fix: winget install Microsoft.OpenJDK.21"
    $ok = $false
}
else {
    Write-Host "      JDK: $jdk"
    $env:JAVA_HOME = $jdk
    if ((-not $NoEnv) -and ([Environment]::GetEnvironmentVariable("JAVA_HOME", "User") -ne $jdk)) {
        [Environment]::SetEnvironmentVariable("JAVA_HOME", $jdk, "User")
        Write-Host "      set user JAVA_HOME"
    }
}

# ---------- Ghidra ----------
$ghidra = Get-EnvAny "GHIDRA_INSTALL_DIR"
if ($Force -or (-not (Test-Ghidra $ghidra))) {
    $ghidra = Join-Path $Dest "ghidra_$($GhidraVersion)_PUBLIC"
}
if (Test-Ghidra $ghidra) {
    Write-Host "      Ghidra: $ghidra (already installed)"
}
else {
    $zip = Join-Path $env:TEMP "ghidra_$($GhidraVersion)_PUBLIC.zip"
    Write-Host "      downloading Ghidra $GhidraVersion (about 570 MB) ..."
    $curl = Get-Command curl.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -ne $curl) {
        & $curl.Source -L --fail --silent --show-error -o $zip $GhidraUrl
    }
    else {
        [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor 3072
        Invoke-WebRequest -Uri $GhidraUrl -OutFile $zip -UseBasicParsing
    }
    $hash = ""
    if (Test-Path $zip) {
        $hash = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLower()
    }
    if ($hash -ne $GhidraSha256) {
        Write-Host "      FAILED: Ghidra download is missing or its SHA-256 does not match (check internet/proxy access to github.com)"
        Remove-Item $zip -Force -ErrorAction SilentlyContinue
        $ok = $false
    }
    else {
        Write-Host "      SHA-256 ok. Extracting to $Dest ..."
        New-Item -ItemType Directory -Force $Dest | Out-Null
        # tar.exe (Windows 10 1803+) is much faster than Expand-Archive for this size
        $tar = Get-Command tar.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($null -ne $tar) {
            & $tar.Source -xf $zip -C $Dest
        }
        else {
            Expand-Archive -Path $zip -DestinationPath $Dest -Force
        }
        Remove-Item $zip -Force -ErrorAction SilentlyContinue
        if (Test-Ghidra $ghidra) {
            Write-Host "      Ghidra: $ghidra"
        }
        else {
            Write-Host "      FAILED: extracted, but $ghidra does not look like a Ghidra folder"
            $ok = $false
        }
    }
}
if (Test-Ghidra $ghidra) {
    $env:GHIDRA_INSTALL_DIR = $ghidra
    if ((-not $NoEnv) -and ([Environment]::GetEnvironmentVariable("GHIDRA_INSTALL_DIR", "User") -ne $ghidra) -and ([Environment]::GetEnvironmentVariable("GHIDRA_INSTALL_DIR", "Machine") -ne $ghidra)) {
        [Environment]::SetEnvironmentVariable("GHIDRA_INSTALL_DIR", $ghidra, "User")
        Write-Host "      set user GHIDRA_INSTALL_DIR"
    }
}

Write-Host "GHIDRA_INSTALL_DIR=$env:GHIDRA_INSTALL_DIR"
Write-Host "JAVA_HOME=$env:JAVA_HOME"
if ($ok) {
    exit 0
}
exit 1
