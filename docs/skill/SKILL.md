---
name: explainer-video
description: Make a narrated explainer video (1 to about 12 minutes, analogies, illustrations, burned-in subtitles) from a topic, a document or report, or a web page, with the local Scene Lab engine at {{ENGINE_DIR}}. Use when the user says make a video of this, explain this as a video, turn this report or page into a video, I don't want to read this, or explain X in N minutes. Works from any project. Each video is directed and designed for its topic; Claude decides the look, the order and whether 2D, 3D or mixed, draws the key pictures as scene code, and follows exactly what the user states (2D only, no Blender, quick and cheap).
---

# Explainer video

Engine: `{{ENGINE_DIR}}` (`E` below); run its commands in PowerShell from `E`. You direct the video. Nothing is
fixed in advance, not the look, not the order, not the kinds of picture, and no stock theme or stock order of
scenes is taken by habit (F-015). What the user states ("2D only", "no Blender", "keep it cheap") is followed
exactly.
**Token rule:** read only what these steps and SPEC.md name. Never read the engine code (`E\src`, the `.py` files)
or a `build\` folder, never load page HTML into context, never open an MP4, never paste the narration into chat.
**This machine's own steps:** if `E\local\skill-extras.md` exists, read it first: it holds this machine's own steps
(a host to fetch pages from or publish to, for example), and they add to the steps below.

1. **Source to text.** Choose a kebab-case slug; the video folder is `E\videos\<slug>\`.
   - File or URL: `E\.venv\Scripts\python E\source.py <file-or-url> E\videos\<slug>`
   - A page behind a login: save it as an HTML file first, then source.py on that file.
   - A topic with no document: write from what you know and leave out claims you are unsure of.
   source.py prints a suggested length. The user's stated length wins.
2. **Read** `E\SPEC.md` and `E\FEEDBACK.md` in full, then `source.md` if there is one, `E\docs\made.md` (the last
   videos: do not repeat their look or their order by habit) and `E\docs\kit\README.md` (what scene code can draw;
   skip it when the user asked for cheap or quick).
3. **Direct** (SPEC.md part 0) before you write a scene: the audience and the level, the one question, what kind of
   thing the topic is, 2D, 3D or mixed and why, the order, the look, scene code or a template for each scene, the
   voice. Write the `direction` block. Each limit the user stated goes into `limits` as a token, so that the build
   holds the video to it; any other wish goes into `asked` in the user's words. These decisions are yours: do not
   stop to ask the user to choose a look or an order. The user judges the preview. Then size the work (below)
   before you build.
4. **Write** `E\videos\<slug>\spec.json`, and scene code in `E\videos\<slug>\scenes\` for the pictures that carry
   the explanation. For scene code read `E\docs\kit\core.md` and only the kit pages this video needs (README.md says
   which; a 2D video never opens `shapes.md`). From the nearest demo (`E\videos\_kit_*`) copy the scene code and the
   shape of its blocks, never its look: the demos sit on the stock theme. What serves only this topic (data,
   geometry, helpers) stays in the video folder (F-010).
   `.venv\Scripts\python make.py videos\<slug> --no-render` checks the direction, the limits, every cue, the lint and
   the types without drawing; an error only drawing finds (a colour name the theme lacks) shows on a strip (step 6).
5. **Pictures from providers,** if the spec asks for any: `.venv\Scripts\python make.py videos\<slug> --assets`,
   look once at each sheet in `out\assets\`, and set `"pick": n` to a picture that fits the meaning.
6. **Check each scene before any preview:** `make.py videos\<slug> --strip N` (several: `--strip 3,7,12`) shows
   whether each change lands on its word; `--still N@t` shows type and spacing at full size. One image read each.
7. **Preview** once the scenes are right: `make.py videos\<slug> --preview`. Read the JSON report and fix every error
   and warning; `not directed`, `look`, `sameness` and `all templates` each name a decision to make, not a line to
   silence. Check each `check_by_eye` wish yourself, then look once at `out\sheet.png`. Unchanged narration is cached.
8. **Final render:** `.venv\Scripts\python make.py videos\<slug>` gives 1080p 30 fps (the template demo took 1.6x
   its length: run a long one in the background). The 4K 60 fps master (`--master`: about 6x the length in 2D and
   9 to 10x with 3D scenes, measured 16 Nov 2026 on a 16 GB laptop; `--fps 30` halves it) only when the user asks
   for it (F-007). If the user says "save" about a design, run `make.py videos\<slug> --save-theme <name>` (F-006).
9. **Hand over** the MP4 path, its length, one line on what it covers and one on how it was directed (form, look,
   limits held). Offer page parts. Commit only when the user asks: `videos\<slug>` and `docs\made.md`, by path.
10. **Page parts, only when asked:** `.venv\Scripts\python page.py videos\<slug>` cuts the finished video into
    self-contained HTML pages, `out\share\part-NN.html` (720p 30 fps, under 2.85 MB each, cut at chapters), which
    any host that serves single HTML files can carry. Publishing them anywhere happens only when the user asks: a
    link is outward facing.
11. **Feedback:** every correction from the user becomes a numbered F-rule in `E\FEEDBACK.md`: the date, where it
    came from, the rule in general words and its reason in one line. Confirm the rule number. Wishes that need
    template or kit work go in `E\docs\backlog.md`.

## How much one session carries

Scene code is the cost. The measure we have: a video of about ten minutes with 27 scenes of scene code took a
planner, three builders and a checker.
- **Alone:** about three to four minutes of scene code, or a longer video where scene code draws the key pictures
  (those that carry the mechanism) and templates draw the rest (a title, a quotation, a chart of real numbers).
- **When the video you directed needs more scene code than that:** tell the user in one line what the whole costs
  (a planner, one builder for every three to four minutes, a checker) and what you can do alone, and ask once which
  the user wants. For several agents follow `E\docs\workflows.md`; the planner first writes `videos\<slug>\plan.md`
  (its form: `E\docs\plan-example.md`).
- **Cheap or quick,** only when the user asks: `templates-only`, one spec, no scene code, any length in one session.
- **Blender** only for a hero still that needs real materials and light, never under `no-blender` or `2d-only`:
  render it headless (`E\docs\blender.md`) and show the PNG as a local file. It counts as 3D.
