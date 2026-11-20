# @file setup.ps1
# @description One-time setup of Scene Lab on Windows, from a fresh clone in any folder. It checks the tools first
#   and says plainly what is missing (Python 3.12, Node.js with npm, ffmpeg and ffprobe on PATH); then it builds the
#   Python venv in .venv (torch's CPU build first, so pip does not pull a CUDA build, then requirements.txt), installs
#   the Node packages exactly as package-lock.json pins them (npm ci) and Remotion's headless browser, copies
#   .env.example to .env when there is no .env yet, and installs the Claude Code skill: docs\skill\SKILL.md with
#   {{ENGINE_DIR}} replaced by this folder, written to the user's skills folder. Safe to run again.
# @usage  powershell -ExecutionPolicy Bypass -File setup.ps1                 everything
#         powershell -ExecutionPolicy Bypass -File setup.ps1 -CheckOnly      only check the tools
#         powershell -ExecutionPolicy Bypass -File setup.ps1 -SkillOnly     only install the skill again (after an
#                                                                             edit of docs\skill\SKILL.md)
#         -SkipSkill                    everything but the skill
#         -SkillDir <folder>            install the skill there instead of %USERPROFILE%\.claude\skills\explainer-video
#         -Python <path to python.exe>  the Python 3.12 to build the venv with, when it is not found by itself
param(
    [string]$SkillDir = '',
    [switch]$SkipSkill,
    [switch]$SkillOnly,
    [switch]$CheckOnly,
    [string]$Python = ''
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'  # the progress bar slows big downloads in Windows PowerShell 5.1
$Engine = (Get-Item -LiteralPath $PSScriptRoot).FullName.TrimEnd('\')
if (-not $SkillDir) {
    $SkillDir = Join-Path (Join-Path (Join-Path $env:USERPROFILE '.claude') 'skills') 'explainer-video'
}
$TorchVersion = '2.15.0'  # CPU build; CPU is enough for the voice
$TorchIndex = 'https://download.pytorch.org/whl/cpu'

function Invoke-Native([string]$What, [scriptblock]$Command) {
    Write-Host "== $What"
    & $Command
    if ($LASTEXITCODE -ne 0) { throw "$What failed (exit code $LASTEXITCODE). The lines above say why." }
}

function Find-Python312 {
    # A Python 3.12 interpreter: -Python, then the py launcher, then python3.12 and python on PATH. Returns its path.
    $tries = @()
    if ($Python) { $tries += , @($Python) }
    $tries += , @('py', '-3.12')
    $tries += , @('python3.12')
    $tries += , @('python')
    foreach ($t in $tries) {
        $exe = $t[0]
        $rest = @($t | Select-Object -Skip 1)
        if (-not (Get-Command $exe -ErrorAction SilentlyContinue)) { continue }
        try {
            $out = & $exe @rest -c "import sys; print('%d.%d|%s' % (sys.version_info[0], sys.version_info[1], sys.executable))" 2>$null
        } catch { continue }
        if ($LASTEXITCODE -eq 0 -and "$out" -match '^3\.12\|(.+)$') { return $Matches[1].Trim() }
    }
    return $null
}

function Get-Npm([string]$Name) {
    # npm.cmd and npx.cmd run under any execution policy; the .ps1 shims do not
    $c = Get-Command "$Name.cmd" -ErrorAction SilentlyContinue
    if ($c) { return $c.Source }
    $c = Get-Command $Name -ErrorAction SilentlyContinue
    if ($c) { return $c.Source }
    return $null
}

function Test-Tools {
    # Every missing tool at once, each with where to get it. Returns the Python 3.12 path.
    $missing = @()
    $py = Find-Python312
    if (-not $py) {
        $missing += 'Python 3.12 (https://www.python.org/downloads/ ; 3.13 and newer do not work, kokoro needs below 3.13). ' +
                    'If it is installed but not found, run again with -Python <path to python.exe>.'
    }
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) {
        $missing += 'Node.js 20 or newer, with npm (https://nodejs.org ; Scene Lab is tested with Node 24).'
    } else {
        $nv = "$(& node --version)".Trim().TrimStart('v')
        $major = 0
        [void][int]::TryParse($nv.Split('.')[0], [ref]$major)
        if ($major -lt 20) {
            $missing += "Node.js 20 or newer (found $nv; https://nodejs.org ; Scene Lab is tested with Node 24)."
        } elseif ($major -lt 24) {
            Write-Host "Note: Node $nv found; Scene Lab is tested with Node 24. If npm ci or a render fails, try Node 24."
        }
        if (-not (Get-Npm 'npm')) { $missing += 'npm, which comes with Node.js (https://nodejs.org).' }
    }
    foreach ($tool in 'ffmpeg', 'ffprobe') {
        if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
            $missing += "$tool on PATH (https://ffmpeg.org/download.html , for example ``winget install Gyan.FFmpeg``; " +
                        'open a new terminal afterwards so PATH is read again).'
        }
    }
    if ($missing.Count -gt 0) {
        Write-Host ''
        Write-Host 'Setup cannot go on. Missing:' -ForegroundColor Yellow
        foreach ($m in $missing) { Write-Host "  - $m" }
        exit 1
    }
    Write-Host "Tools found: Python 3.12 ($py), Node $(& node --version), $((& ffmpeg -hide_banner -version | Select-Object -First 1))"
    return $py
}

function Install-Skill {
    $tpl = Join-Path $Engine 'docs\skill\SKILL.md'
    if (-not (Test-Path -LiteralPath $tpl)) { throw "The skill template $tpl is missing." }
    $text = [IO.File]::ReadAllText($tpl, [Text.Encoding]::UTF8)
    if (-not $text.Contains('{{ENGINE_DIR}}')) { throw "The skill template $tpl does not name {{ENGINE_DIR}}." }
    $text = $text.Replace('{{ENGINE_DIR}}', $Engine)
    if ($text -match '\{\{[A-Z_]+\}\}') { throw "The skill template holds a token setup.ps1 does not fill: $($Matches[0])" }
    New-Item -ItemType Directory -Force -Path $SkillDir | Out-Null
    $dst = Join-Path $SkillDir 'SKILL.md'
    [IO.File]::WriteAllText($dst, $text, (New-Object Text.UTF8Encoding $false))
    Write-Host "Skill installed: $dst (engine folder $Engine)"
}

Push-Location $Engine
try {
    if ($SkillOnly) {
        Install-Skill
        return
    }
    $py = Test-Tools
    if ($CheckOnly) { return }

    $venvPy = Join-Path $Engine '.venv\Scripts\python.exe'
    if (Test-Path -LiteralPath $venvPy) {
        $have = "$(& $venvPy -c "import sys; print('%d.%d' % sys.version_info[:2])")".Trim()
        if ($have -ne '3.12') { throw ".venv holds Python $have, not 3.12. Delete the .venv folder and run setup.ps1 again." }
        Write-Host '== Python venv: .venv exists (Python 3.12), kept'
    } else {
        Invoke-Native 'Python venv in .venv' { & $py -m venv (Join-Path $Engine '.venv') }
    }
    Invoke-Native 'pip itself' { & $venvPy -m pip install --upgrade pip }
    Invoke-Native "torch $TorchVersion, CPU build" { & $venvPy -m pip install "torch==$TorchVersion" --index-url $TorchIndex }
    Invoke-Native 'Python packages (requirements.txt)' { & $venvPy -m pip install -r (Join-Path $Engine 'requirements.txt') }

    $npm = Get-Npm 'npm'
    $npx = Get-Npm 'npx'
    Invoke-Native 'Node packages (npm ci, exactly as package-lock.json pins them)' { & $npm ci --no-audit --no-fund }
    Invoke-Native "Remotion's headless browser" { & $npx remotion browser ensure }

    $envFile = Join-Path $Engine '.env'
    if (-not (Test-Path -LiteralPath $envFile)) {
        Copy-Item -LiteralPath (Join-Path $Engine '.env.example') -Destination $envFile
        Write-Host '== .env made from .env.example: every key is empty, and the keyless picture sources work without any'
    }

    if (-not $SkipSkill) { Install-Skill }

    Write-Host ''
    Write-Host 'Setup done.' -ForegroundColor Green
    Write-Host 'The first render downloads more, once: the Kokoro voice model (about 330 MB) and the spaCy English model.'
    Write-Host 'Icons, fonts and pictures are fetched from the network while a video is made.'
    Write-Host 'Smoke test:  .\.venv\Scripts\python.exe make.py videos\_demo --preview'
} finally {
    Pop-Location
}
