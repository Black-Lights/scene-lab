# @file blender/install-mcp.ps1
# @description Installs the official Blender Lab MCP connector (v1.0.3, GPL-3.0) for this project: the server in
#   tools\blender_mcp (with a one-line Windows fix), its add-on in the project's portable Blender, and the Claude
#   Code registration in local scope (this project only). Needs blender\install.ps1 first, plus git, uv and claude
#   on PATH. Why this connector and what it costs in tokens: docs/blender.md. Safe to run again.
$ErrorActionPreference = 'Stop'
$tag = 'v1.0.3'
$root = Split-Path $PSScriptRoot
$tools = Join-Path $root 'tools'
$exe = Join-Path $tools 'blender\blender.exe'
$src = Join-Path $tools 'blender_mcp'
if (-not (Test-Path $exe)) { throw 'Run blender\install.ps1 first.' }
Push-Location $root  # local scope in Claude Code is keyed by the project folder
try {
    New-Item -ItemType Directory -Force (Join-Path $tools 'blender\portable') | Out-Null  # settings stay in tools\
    if (-not (Test-Path $src)) {
        git clone -q --depth 1 --branch $tag https://projects.blender.org/lab/blender_mcp.git $src
    }
    # Windows fix: the server starts `blender --background` with its MCP stdio pipe as Blender's stdin, and Blender
    # hangs until the 120 s timeout. Give Blender no stdin.
    $cli = Join-Path $src 'mcp\blmcp\tools_helpers\blender_cli.py'
    $text = Get-Content $cli -Raw
    if ($text -notmatch 'stdin=subprocess\.DEVNULL') {
        $fix = "`${1}stdin=subprocess.DEVNULL,  # Windows: an inherited MCP stdio pipe hangs Blender`n`${1}capture_output=True,"
        Set-Content $cli ($text -replace '(?m)^(\s*)capture_output=True,', $fix) -NoNewline
    }
    uv --directory (Join-Path $src 'mcp') sync -q

    $out = Join-Path $tools 'download'
    & $exe --command extension build --source-dir (Join-Path $src 'addon\blender_mcp_addon') --output-dir $out | Out-Null
    & $exe --command extension install-file -r user_default -e (Join-Path $out "mcp-$($tag.TrimStart('v')).zip") |
        Select-Object -Last 1

    $ErrorActionPreference = 'Continue'
    claude mcp get blender *> $null
    $registered = $LASTEXITCODE -eq 0
    $ErrorActionPreference = 'Stop'
    if (-not $registered) {
        claude mcp add blender -s local -e "BLENDER_PATH=$exe" -- uv --directory (Join-Path $src 'mcp') run blender-mcp
    }
    claude mcp get blender | Select-Object -First 3
}
finally { Pop-Location }
