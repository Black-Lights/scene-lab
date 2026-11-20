# Blender: optional hero stills

Blender is optional. The engine draws 3D itself (the kit's Stage, docs/kit/core.md and shapes.md); Blender is only
for a hero still or a very short shot that needs real materials and light. It is never used under the limits
`no-blender` or `2d-only`, and a picture from it counts as 3D (SPEC.md part 0). Windows only as written (the
scripts fetch the Windows build).

## Install

- `.\blender\install.ps1` downloads Blender 5.2.4 LTS (the portable ZIP, about 406 MB, from
  https://download.blender.org/release/Blender5.2/), checks its SHA-256 against the file blender.org publishes, and
  unpacks it into `tools\blender\`, which git ignores. Run again, it does nothing when that version is already there.
- Blender is GPL-3.0-or-later. It is installed on your machine and never copied into this repository.

## Render headless

```powershell
tools\blender\blender.exe -b --factory-startup -P <script.py> -- <args>
```

- `--factory-startup` keeps a render independent of any saved preferences.
- `blender\bench.py` is a working example: it builds a small scene in Python (a ground, a dozen box-like parts with
  PBR materials, a sun, an area light, a camera that tracks the centre), renders stills in EEVEE and Cycles and a
  24-frame camera move, and prints the times. Run it once on a new machine to know what a shot costs there.
- Keep renders as scripts (repeatable, cacheable, cheap in tokens). Show the result as a PNG file; a scene file
  (`.blend`) or a picture with Blender's stamp is refused under `no-blender`.

## What it costs (measured once, on a laptop with a 6 GB NVIDIA GPU)

| What | Time |
|---|---|
| EEVEE, first frame of a process (shader compilation; cached for later runs) | 30 s, then about 4 s |
| EEVEE, one 1080p still, steady | about 0.9 s |
| EEVEE, a 24-frame move at 1080p, per frame | about 0.85 s |
| EEVEE, at 640 x 360, per frame | about 0.3 s |
| Cycles (OptiX, 128 samples, denoised), one 1080p frame | about 13 s |

- EEVEE at 1080p and 30 fps is about 26 minutes of rendering per minute of footage: a 6 s shot takes about 2.5
  minutes. Cycles is about 6.5 hours per minute: stills and very short shots only.
- Heavier scenes (many lights, volumetrics, displacement, more samples) cost more: time the first shot of every new
  scene script.
- In 5.2.4, `Material.use_nodes` and `World.use_nodes` print a deprecation warning (removal planned for Blender
  6.0). They still work.

## The MCP connector (optional, for building a scene interactively)

`.\blender\install-mcp.ps1` installs the official Blender Lab MCP connector (v1.0.3, GPL-3.0,
https://projects.blender.org/lab/blender_mcp) for this project: the server in `tools\blender_mcp`, its add-on in
the project's portable Blender (settings kept in `tools\blender\portable`), and the Claude Code registration in
local scope. It needs `blender\install.ps1` first, and git, uv and claude on PATH. Run again, it is safe.

- It sends nothing anywhere and works without Blender's window: the `_for_cli` tools take a .blend file and start
  Blender for each call (about 3 s a call).
- A live scene without a window, for many quick edits: `tools\blender\blender.exe -b <file.blend> --online-mode
  --command blender_mcp` (it listens on localhost:9876). With the window, for viewport screenshots:
  `tools\blender\blender.exe --online-mode`, then Preferences > Add-ons > MCP > Start.
- Two Windows fixes are applied by the script: Blender started by the server gets no input (it would otherwise hang
  until a 120 s timeout), and `--online-mode` allows the add-on's bridge for that run only.
- Token cost: the server's instructions add about 1,500 tokens to every session in the project; tool definitions
  load only when a tool is used; a scene summary is a few hundred tokens and grows with the scene. Ask for
  summaries before screenshots, render to a file and look only when needed, and move finished work into a script
  early.
- Safety: every route runs Python with full access to the machine. Work on copies of .blend files, keep secrets out
  of scenes, and keep the bridge on localhost.
- Build and debug a scene with it; the finished scene is still a script rendered headless.
