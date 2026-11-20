# @file blender/install.ps1
# @description Installs the pinned Blender (5.2.4 LTS, portable ZIP of about 406 MB) into tools\blender for hero
#   shots (docs/blender.md). Checks the SHA-256 that blender.org publishes before extracting.
#   Safe to run again: it stops early when tools\blender already holds the pinned version.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'  # the progress bar slows big downloads in Windows PowerShell 5.1
$ver = '5.2.4'
$name = "blender-$ver-windows-x64"
$base = 'https://download.blender.org/release/Blender5.2'
$tools = Join-Path (Split-Path $PSScriptRoot) 'tools'
$exe = Join-Path $tools 'blender\blender.exe'

if (Test-Path $exe) {
    $have = & $exe --version | Select-Object -First 1
    if ($have -match [regex]::Escape($ver)) {
        New-Item -ItemType Directory -Force (Join-Path $tools 'blender\portable') | Out-Null
        Write-Host "Already installed: $have"
        return
    }
    throw "tools\blender holds '$have'. Move it away, then run this again."
}
$dl = Join-Path $tools 'download'
New-Item -ItemType Directory -Force $dl | Out-Null
$zip = Join-Path $dl "$name.zip"
$sums = Join-Path $dl "blender-$ver.sha256"
if (-not (Test-Path $zip)) { Invoke-WebRequest "$base/$name.zip" -OutFile $zip }
if (-not (Test-Path $sums)) { Invoke-WebRequest "$base/blender-$ver.sha256" -OutFile $sums }
$want = ((Select-String -Path $sums -Pattern "$name\.zip").Line -split '\s+')[0].ToLower()
$got = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLower()
if ($got -ne $want) { throw "SHA-256 mismatch for $zip (want $want, got $got). Delete the ZIP and run again." }
tar.exe -xf $zip -C $tools
Rename-Item (Join-Path $tools $name) 'blender'
# A `portable` folder makes this Blender keep its settings and add-ons in tools\blender\portable, apart from any
# other Blender on the machine.
New-Item -ItemType Directory -Force (Join-Path $tools 'blender\portable') | Out-Null
& $exe --version | Select-Object -First 1
