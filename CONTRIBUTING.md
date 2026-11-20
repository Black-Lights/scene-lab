# Contributing to Scene Lab

## Reporting a fault

Open an issue at github.com/Black-Lights/scene-lab. A report that can be acted on has:

- the version (`.venv\Scripts\python make.py --version`) and your Windows, Python, Node and ffmpeg versions
- the command you ran
- the JSON report of the run. It is the last JSON object on standard output, and `--report <path>` writes it to
  a file. If the run stopped before a report, send the message it printed on standard error.
- the smallest `spec.json` that shows the fault, with its scene code if it has any
- for a fault in a picture, one image: `--strip N` or `--still N@t`

Never paste a key from your `.env` file.

Scene Lab has run on Windows 11 only. A report of what breaks on macOS or Linux is useful, and a fix is better.

## What a change must keep

**Determinism.** Every picture depends on the frame number alone. Everything derives from `useCurrentFrame()`,
with no `Math.random` and no wall clock. The build's lint refuses scene code that breaks this, and the engine's
own code follows the same rule.

**A topic-free engine.** The engine gets general capabilities only (rule F-010 in FEEDBACK.md). What serves one
topic, its data, its geometry and its scene code, stays in that video's folder under `videos/`.

**A demo and a page for every kit piece.** A new export in `src/kit` comes with a demo on an everyday subject in
a `videos/_kit_*` folder and with its section on a page in `docs/kit`. docs/kit/README.md lists every export with
its page, so add the line there too. A piece is built when a video needs it (F-014).

**The parts of a template.** A new template is a component in `src/templates`, an entry in
`src/templates/index.ts`, its name in `TYPES` in make.py, a row in SPEC.md and a scene in `videos/_demo/spec.json`.

**Public files free of private matter.** No names of people, no paths of your machine, no keys, no address of a
host of your own. The docs say "the user". Paths start at the engine folder. What belongs to one machine goes in
the folder `local/`, which git ignores.

A correction to how videos are made is a new numbered rule in FEEDBACK.md. A wish that needs template, kit or
engine work goes in docs/backlog.md.

## The smoke test

There is no test suite yet. Before you send a pull request, run the smoke test from the engine folder:

```powershell
.venv\Scripts\python make.py videos\_demo --preview
.venv\Scripts\python make.py videos\_compat --preview
.venv\Scripts\python make.py videos\_kit_core --strip 1,2,3
.venv\Scripts\python make.py videos\_kit_world --strip 1,2,3,4
.venv\Scripts\python make.py videos\_kit_board --strip 1,2,3,4
.venv\Scripts\python make.py videos\_kit_parts --strip 1,2
.venv\Scripts\python make.py videos\_kit_blocks --strip 1,2,3
.venv\Scripts\python make.py videos\_kit_shapes --still 1@0.3,1@9 --strip 1
.venv\Scripts\python make.py videos\_kit_errors --preview
```

Every run must end with a report that has no errors, except the last one. `_kit_errors` holds five scenes that
fail on purpose: it must finish with five errors in the report and exit code 1, and its sheet shows four of the
error cards, since one scene fails only at its cut-in. Look at each strip and at `out\sheet.png` of the three
previews. A report without errors does not show a wrong
picture.

Run one command at a time per video folder. make.py holds a lock in the folder's `build` directory while it works.

## Versions

There is one version number, in package.json, and `make.py --version` prints it. Scene Lab is at 0.x:

- A change that breaks an existing `spec.json` or changes or removes a kit export raises the minor number, 0.4 to
  0.5. CHANGELOG.md names what breaks and how to move a video over.
- Every other change raises the patch number, 0.4.0 to 0.4.1.

Each release gets an entry in CHANGELOG.md with its date.

## Licence of contributions

Scene Lab is under Apache-2.0. As section 5 of LICENSE says, what you submit for inclusion is under the same
licence unless you state otherwise. Do not add third-party code, fonts, icons or pictures to the repository. They
are installed or fetched on the user's machine, and THIRD-PARTY.md lists them.
