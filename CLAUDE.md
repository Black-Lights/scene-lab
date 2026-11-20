# Scene Lab: topics and documents into narrated explainer videos

Scene Lab turns a topic, a report or a web page into a narrated video of 1 to about 12 minutes with analogies,
illustrations and burned-in subtitles. Every video is directed and designed for its topic (F-015): the session that
makes it decides the look, the order and whether 2D, 3D or mixed, writes one JSON spec as the script, and draws the
pictures that carry the explanation as scene code (videos/<slug>/scenes/*.tsx) on the kit (src/kit). Nothing is
fixed in advance, and what the user states ("2D only", "no Blender") is followed exactly. The fixed templates are
parts a director may pick, and the cheap path when the user asks for one.

Any topic, any field (F-010): no video is the engine's subject. The engine gets only general capabilities; anything
that serves one topic (its geometry, data, scene code) lives in videos/<slug>/.

This file is shared with everyone who clones the repository. A user's own instructions for this project go in
`CLAUDE.local.md` beside it (git ignores it), which Claude Code loads after this file.

## Token rules (the reason this project exists)

- Making a video: follow the steps of docs/skill/SKILL.md (the template of the skill `explainer-video`, which
  setup.ps1 installs so that sessions in other projects load it). Read SPEC.md, FEEDBACK.md and docs/made.md, then
  docs/kit/README.md and only the kit pages the video needs (core.md for any scene code). Do not read src/ or the
  .py files.
- Direct before the first scene (SPEC.md part 0). The spec's `direction` block records the decisions and the limits
  the user stated, and make.py holds the video to them.
- Scene code is checked with `--strip` and `--still N@t` (one image each) before a preview is rendered.
- Source material goes through source.py first (drops HTML, scripts and images). Never load page HTML into context.
- After make.py: read its JSON report and view out/sheet.png once. Fix in the spec or the scene code and run again
  (narration is cached per scene, so only changed scenes are synthesized again).
- Never open the MP4, never read build/, never paste the narration back into chat.

## Commands (PowerShell, from this folder)

| What | Command |
|---|---|
| Source to text | `.venv\Scripts\python source.py <file-or-url> videos\<slug>` |
| Asset contact sheets | `.venv\Scripts\python make.py videos\<slug> --assets` -> `out\assets\NN-*.png` (one image read each) |
| Check without a picture | `.venv\Scripts\python make.py videos\<slug> --no-render`: the voice, the direction and its limits, every cue |
| Iterate | `.venv\Scripts\python make.py videos\<slug> --strip N` or `--strip 3,7,12` = frames of those scenes at their timed moments; `--still N@t` = one frame of scene N at t seconds; `--preview` (half size, 30 fps) once the scenes are right |
| Try another look | add `--design <file>.json` to any of these: the file's design (with an optional `"theme"`) replaces the spec's for that run, and the pictures go to `out\look-<file name>\` |
| Make the video | `.venv\Scripts\python make.py videos\<slug>` = 1080p 30 fps; `--master` = 4K 60 fps, only when the user asks (F-007); `--fps 30` halves its frames and its time. Measured for a 12-minute video at 4K on a 16 GB laptop: mostly 2D 71 min at 60 fps and 36 at 30; mostly 3D 125 and 65 (SPEC.md part 8). `--report <path>` writes the JSON report to a file |
| Save a design | `.venv\Scripts\python make.py videos\<slug> --save-theme <name>`, only when the user says "save" (F-006) |
| Page parts | `.venv\Scripts\python page.py videos\<slug>` -> `out\share\part-NN.html`: the finished video cut at chapters into self-contained HTML pages |
| Template studio | `npm run studio` (only when improving templates) |
| Smoke test | `make.py videos\_demo --preview` (the new templates), `make.py videos\_compat --preview` (a v0.1 spec: the rest), strips of `videos\_kit_core`, `_kit_world` and `_kit_board` (the kit's core), `make.py videos\_kit_parts --strip 1,2`, `make.py videos\_kit_blocks --strip 1,2,3` and `make.py videos\_kit_shapes --still 1@0.3,1@9 --strip 1` (the kit's parts, blocks and 3D shapes), and `make.py videos\_kit_errors --preview` (it must finish with five errors in the report and exit code 1; its sheet shows four of the cards) |

One run per video folder: make.py holds `build/.lock` while it works, and a second run on the same folder stops.
Rendering takes about 1.6x the video length (the template demo, when it ran 2:39: 260 s), so run long videos in the
background.

## Page parts and publishing

page.py only builds files: each part is one HTML page with its stretch of the video embedded (720p 30 fps, under
2.85 MB each, cut at chapters), so any host that serves single HTML files can carry it. Its size limits are
defaults for such a host. Publishing a video, or anything else that leaves the machine, happens only when the user
asks: a link is outward facing.

## Asset sources

Keys live in `.env` (gitignored); `.env.example` is the empty template, so a key never goes there.
docs/asset-sources.md records each provider's status, limits and terms (Noun Project SVGs must not be cached,
Pixabay responses must be cached for 24 h, Unsplash needs its download endpoint and a credit). Read it before
touching asset code. Every provider is optional: with no key at all the engine and every demo still work.

## Feedback loop

Every correction from the user becomes a numbered F-rule in FEEDBACK.md: the date, where it came from, the rule in
general words and its reason in one line. Confirm the number. Wishes that need template, kit or engine work go in
docs/backlog.md and are done in a template session. Record what changed in CHANGELOG.md.

## Long runs (workflows and subagents)

A video too big for one session is split over several agents (a planner, builders, a checker). A usage limit or a
shutdown must never mean starting again: every agent keeps a notes file and reads it first, so an agent that is cut
is continued by its successor; work is saved in small commits by path; a script stops at the first missing result;
a cut run is resumed by its id with the script unchanged. docs/workflows.md has the rules and the text to paste
into a script; read it before writing a workflow. docs/plan-example.md shows the form of a planner's shot plan.

## Improving templates (only when asked)

- Templates: src/templates/ (one file per family; the type map is src/templates/index.ts). Tokens per theme:
  src/themes.json (read by make.py too); what differs per look: src/looks.tsx. Motion language: src/motion.ts and
  docs/design.md. Cuts: src/transitions.tsx. Captions and the chapter bar: src/Captions.tsx, src/Progress.tsx.
- Assets: providers.py (one function per provider), assets.py (order, merge, cache, ledger). Rules per provider:
  docs/asset-sources.md.
- A new template = component + an entry in src/templates/index.ts + TYPES in make.py + a row in SPEC.md + a scene in
  videos/_demo/spec.json. Re-render the demo with --preview and check its sheet and a --strip before calling it done.
- The kit (scene code): src/kit, one barrel imported as `@kit`; the runtime is src/custom.tsx and src/Explainer.tsx;
  the build side is custom.py (entry, validation, lint, type check), cues.py (cue grammar, strips), render.py
  (bundle and render caches, encode, lock) and direction.py (the `direction` block, the limits, the report's nudges,
  the ledger docs/made.md). The contract is docs/v0.3-architecture.md; video authors start at docs/kit/README.md
  (the index: core.md, parts.md, blocks.md, chart.md, shapes.md, every export with its page, and what is not built),
  kept in step with the code; the demos are videos/_kit_*. A kit piece is built only when a video needs it, with a
  demo from an everyday subject and a page in docs/kit/; what is built for one video and could serve another topic
  moves into the kit, topic-free (F-014).
- The words every video session reads are SPEC.md and the skill. docs/skill/SKILL.md is the skill's template: it
  names the engine folder `{{ENGINE_DIR}}`, and setup.ps1 writes the real path and installs it in the user's skills
  folder. Change the template, then run the install again. A machine's own extra steps (a host to publish to, for
  example) go in `local/skill-extras.md`, which git ignores and the skill reads when it exists.
- Determinism: everything derives from useCurrentFrame(); no Math.random, no wall clock.
- Keep the background static and motion brief: moving pixels cost file size, and page parts stay under 2.85 MB.
- Every look is data (themes.json plus a spec's "design"), so a video can be designed for its topic (F-005).

## Stack (pinned, verified 2026-11-14)

Python 3.12 venv `.venv`: kokoro 0.9.4, misaki[en] 0.9.4, soundfile 0.13.1, torch 2.15.0+cpu (CPU is enough).
Node 24: remotion, @remotion/cli, transitions, paths, shapes, layout-utils, lottie and fonts, all 4.0.499; react
19.2.8; three 0.186.1 and @react-three/fiber 9.8.2 (the 3D stage of the kit); @dagrejs/dagre 3.1.3; Fontsource
variable fonts 5.3.0. ffmpeg 7.1.1 (with ffprobe) on PATH. Fresh machine: `setup.ps1`.
Optional: Blender 5.2.4 LTS, portable, in `tools/blender` (ignored by git; `blender/install.ps1`), run headless for
hero shots, and the official Blender Lab MCP (`blender/install-mcp.ps1`); see docs/blender.md. The second voice,
ZONOS3-Mini, is optional too: docs/voice-zonos3.md.

## Layout

make.py (spec -> MP4) with custom.py, cues.py, render.py, sound.py and direction.py (the `direction` block, the
limits, the nudges and the ledger) beside it, assets.py + providers.py (asset search), page.py (MP4 -> page parts),
source.py (document -> text), zonos.py (the optional second voice), SPEC.md (how to direct and write a video),
FEEDBACK.md (the rules), CHANGELOG.md, docs/skill/ (the skill's template), docs/made.md (the ledger of finished
videos, written by make.py), docs/design.md (direction, motion language, research), docs/avoid-list.md (marks of
machine-made design), docs/kit/README.md (the index of the kit's pages for scene authors), docs/v0.3-architecture.md
(the kit's contract), docs/workflows.md (long runs), docs/backlog.md (wishes for template work),
docs/asset-sources.md, src/ (Remotion; src/kit is the toolkit), blender/ (Blender scripts), videos/<slug>/
(spec.json, scenes/, source.md and ledger.json are kept in git; build/ and out/ are ignored), videos/_* (the demos
and smoke tests).
