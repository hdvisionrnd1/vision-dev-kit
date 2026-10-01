<#
.SYNOPSIS
  Extract the Cognex VisionPro help (CHM) installed on THIS PC into HTML files
  so the vision-dev plugin's visionpro-lookup skill can search it.

.NOTES
  The help content is Cognex's licensed documentation. It is not shipped with
  this repository; each user extracts it from their own VisionPro install.
  Requires 7-Zip (winget install 7zip.7zip).
#>
param(
    [string]$ChmPath = "",
    [string]$Lang = "en",
    [string]$Dest = (Join-Path $env:USERPROFILE ".claude\tools\cognex-doc\VisionPro")
)

$ErrorActionPreference = "Stop"

if ($ChmPath -eq "") {
    $ChmPath = Join-Path $env:ProgramFiles "Cognex\VisionPro\Doc\$Lang\VisionPro.Documentation.chm"
}
if (-not (Test-Path $ChmPath)) {
    Write-Error "VisionPro help not found: $ChmPath  (use -ChmPath to point at VisionPro.Documentation.chm)"
    exit 1
}

$sevenZip = Join-Path $env:ProgramFiles "7-Zip\7z.exe"
if (-not (Test-Path $sevenZip)) {
    $cmd = Get-Command 7z -ErrorAction SilentlyContinue
    if ($null -ne $cmd) {
        $sevenZip = $cmd.Source
    }
    else {
        Write-Error "7-Zip not found. Install it first: winget install 7zip.7zip"
        exit 1
    }
}

Write-Host "Extracting $ChmPath"
Write-Host "        -> $Dest  (this can take a few minutes)"
New-Item -ItemType Directory -Force $Dest | Out-Null
& $sevenZip x -y "-o$Dest" $ChmPath | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Error "7-Zip failed with exit code $LASTEXITCODE"
    exit 1
}

$html = Join-Path $Dest "html"
if (-not (Test-Path $html)) {
    Write-Error "Extraction finished but '$html' was not found. Set COGNEX_HELP_DIR to the folder that contains the T_*.htm files."
    exit 1
}

# Drop the old title index so it is rebuilt from the new files
$index = Join-Path $env:USERPROFILE ".claude\cache\vision-dev\cognex-titles.tsv"
if (Test-Path $index) {
    Remove-Item $index -Confirm:$false
}

$count = (Get-ChildItem $html -Filter *.htm).Count
Write-Host "Done. $count HTML files in $html"
