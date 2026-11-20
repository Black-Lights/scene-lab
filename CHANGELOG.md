# Changelog

Scene Lab has one version number, kept in package.json and printed by `make.py --version`. While it is 0.x, a
change that breaks an existing spec or a kit export raises the minor number and is named here.

## 0.4.0, 19 November 2026: first public release

What Scene Lab does at this point:

- **Videos.** A narrated explainer video of one to about twelve minutes from a topic, a document or a web page:
  an MP4 at 1080p and 30 fps with burned-in subtitles, chapter cards and a chapter bar, plus SRT and VTT subtitles,
  a transcript and a contact sheet. `--preview` renders at half size and `--master` at 4K and 60 fps.
- **The spec.** One `spec.json` per video is its script: the narration scene by scene, what each scene shows, and
  cues that tie a change in the picture to a spoken word. SPEC.md is the guide.
- **Direction.** A `direction` block records the audience, the form (2D, 3D or mixed) and the reasons. Six limits
  a user can state (`2d-only`, `no-blender`, `no-stock-pictures`, `templates-only`, `no-templates`, `stock-look`)
  are held by the build, which reads what each scene really draws. Four warnings name a decision that was skipped.
  docs/made.md lists the finished videos, so that the next one does not repeat their look.
- **Scene code on the kit.** A video can carry its own scenes as React components, built on `@kit`: a clock and
  beats, worlds whose state and camera carry on across scenes, a 3D stage and a 2D board with a camera that frames
  named places on spoken words, labels, 2D parts (sheets, chips, arrows, braces, stamps), blocks for code, lists,
  lanes and printed output, ranked bars, 3D shapes and materials. Each has a page in docs/kit and a demo.
- **Templates.** Sixteen finished pictures driven by data alone: title, sequence, stage3d, diagram, plot, analogy,
  points, flow, compare, chart, timeline, stat, quote, code, image and svg.
- **Voice.** Kokoro runs locally and gives the time of every word, which places the cues and the subtitles.
  Narration is cached per scene. A word can be shown one way and spoken another (`{shown|spoken}`). A second voice,
  ZONOS3-Mini, is optional and set up by hand.
- **Look.** Three base themes and one saved theme, and a `design` per video that sets the colours, any Fontsource family and any
  Iconify icon set. Contrast is checked. `--design` tries another look for one run and `--save-theme` keeps one.
- **Assets.** Icons, photos, illustrations and vector drawings searched across twenty providers by kind and topic,
  a numbered contact sheet to pick from, and a ledger per video with the source, author and licence of everything
  used. Every provider is optional, and eleven need no key; a request that names a provider whose key is missing
  says which key it needs. The search also finds clips, sounds, music, HDRIs and 3D models, which no scene draws or
  plays yet.
- **Checks.** `--no-render` checks the direction, the limits, every cue, the lint and the types without drawing.
  `--strip` and `--still` show one scene as one image. Every run ends with a JSON report. A scene that fails
  becomes an error card in the picture and a line in the report, and the run exits with code 1.
- **Around the engine.** source.py turns HTML, Markdown or a URL into compact text. page.py cuts a finished video
  at its chapters into self-contained HTML pages. setup.ps1 installs everything and the Claude Code skill
  `explainer-video`, with which a session in any project can make a video.
- **Examples.** `videos/moon-phases-2d` (1:27) and `videos/reflection-lab-free` (3:01), and the demos `videos/_*`.
- **Licence.** Apache-2.0 for Scene Lab's own code. THIRD-PARTY.md lists what it depends on, Remotion first.

What is not there yet. The sound track is the voice alone: music and sound effects can be searched, checked and
timed, and nothing mixes them in. Scene Lab has run on Windows 11 only, and macOS and Linux are untried, because the
setup script is PowerShell and the documented commands use Windows paths. There is no test suite. The smoke test
renders the demos and a person looks at the pictures. Every video is 16:9, with no vertical format. Parts of the
kit that no video has needed are listed as not built in docs/kit/README.md, each with a plain way to do without it.

## Before 0.4.0

Scene Lab was built in private from 14 to 18 November 2026. These versions were never published.

- 0.1, 14 November: the first working engine. One spec, twelve templates, local narration, word-timed subtitles.
- 0.2, 14 November: themes and a design per video, one motion language, the asset providers, real 3D.
- 0.3, 16 November: scene code per video on the kit, worlds, the cue grammar, strips and stills, error cards.
- 0.3.1, 18 November: direction first. The direction block, the limits, the kit's parts and pages, the skill.
