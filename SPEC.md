# SPEC: making an explainer video

Read this file and FEEDBACK.md before any video. You direct the video (part 0), write its script and timing in
`videos/<slug>/spec.json`, draw the pictures that carry the explanation as scene code (part 8) and take a template
where it is the right picture (part 6). Paths start at the engine folder (the folder of this file): run commands
there.

## 0. Direct the video

Nothing about a video is fixed in advance: not the look, not the order, not the kinds of picture (F-015). Before
you write a scene, decide these eight things from the topic, the source and what the user said.

| Decide | How | Recorded in |
|---|---|---|
| Audience and level | Who watches and what they know already: it sets the words, the depth and the pace. In depth unless an overview is asked for (F-009) | `direction.audience` |
| The question | The one question the viewer can answer at the end. The video opens with it | the first `say` |
| The kind of thing | It decides the picture. A process in time: one picture that changes step by step. A structure in space: a place the camera moves through. A quantity that changes: a scale it moves along. A comparison: both sides in one frame, on one scale. An argument: each claim beside its evidence | `direction.why` |
| Form | `2d`, `3d` or `mixed` (F-008, F-011). 3D where the subject has form, depth, layers or assembly. 2D where it is a flow, a sequence, text or data. Mixed where a thing must be seen in space and its working on the flat | `direction.form`, `why` |
| Structure | An order chosen for this topic: one case followed to its end, a thing built part by part, a failure and its repair, a claim and its test. F-001 and F-009 hold; the order of the chapters and the kinds of scene are free | the `heading`s, `why` |
| Look | A ground, an ink, a typeface and content colours made for this topic, never a stock theme by default (F-005, F-006; part 4) | `theme`, `design`, `why` |
| Means, scene by scene | Scene code where the picture carries the explanation (part 8). A template where it is the right picture: a chart of real numbers, a quotation, a title (part 6) | each `visual.type` |
| Voice | The one that suits the topic and the audience (part 3) | `voice` |

```json
"direction": { "audience": "home owners, no physics; first contact, no formulas", "form": "mixed",
  "why": ["a heat pump is a machine with parts (3D: the unit, opened) that runs a cycle (2D: one loop the state travels round)",
          "the puzzle first (heat out of cold air), then the loop part by part; enamel white, pipe copper, the red and blue of its two gauges"],
  "limits": ["no-blender"], "asked": ["calm pace"] }
```

The block sits at the top level of spec.json. `audience`, `form` and `why` are required; `why` is a text or a list
of two (the kind of thing and the form; the order and the look); other keys are errors. The build holds the video
to its `form`: under `2d` a 3D scene is an error, `3d` with no 3D scene is an error, and `mixed` with none warns.

**What the user stated is binding.** A stated form sets `form`. Each stated limit goes into `limits` as a token: a
scene that breaks one is an error before anything is spoken or rendered. Never add a limit the user did not
state. A wish no build can check goes into `asked` in the user's words; the report prints it back as `check_by_eye`.

| Token | When the user says | The build refuses |
|---|---|---|
| `2d-only` | "2D only", "no 3D" | a 3D scene: the `stage3d` template, scene code that renders a `<Stage>` or imports `three` (also in a file it imports), a model, an HDRI; and all that `no-blender` refuses. Needs `"form": "2d"` |
| `no-blender` | "don't use Blender" | a `.blend`, a picture or clip that carries Blender's stamp, a script in the video folder that imports `bpy` |
| `no-stock-pictures` | "no stock photos", "draw everything" | a picture or clip from an asset provider or the web. Drawn pictures, icons, sound and the user's own files stay |
| `templates-only` | "quick", "cheap" | all scene code. The cheap path: take it only when the user asks for cheap or quick |
| `no-templates` | "no templates" | every template scene (chapter cards and captions are not scenes) |
| `stock-look` | "the plate theme as it is" | a `design` that sets `bg`, `ink`, `surface` or `font` |

The report's `direction` says what the build saw: `"form": "mixed: 3D in scenes 10, 11 and 12"`, `limits_held`. Four
warnings name a decision that was skipped: `not directed`, `look` (a stock theme, no ground and ink of its own),
`sameness` (one template three scenes in a row, or over a third of the video), `all templates` (over 2:00, no scene
code); none in a folder whose name starts with `_`. Make the decision; do not just silence the line.

**Do not repeat by habit.** `docs/made.md` lists the last videos (form, look, chapters, voice). Read it before you
direct; where the topic leaves a choice open, take a ground, type, order and voice the last rows did not. The
reason: a session that repeats the last choices never tries a better one. The variety comes from your decisions; the
render stays deterministic. make.py writes the video's row after a full render; it is committed with the video.

## 1. Length

| Material | Length | Words | Scenes |
|---|---|---|---|
| One idea | 1 min | ~150 | 4-6 |
| A mechanism | 2-3 min | 300-450 | 7-12 |
| A method, a report section | 5 min | ~750 | 14-20 |
| A full report or paper | 8-12 min | 1200-1800 | 24-40 |

About 150 spoken words per minute. The user's stated length wins; adjust words, never the speed. Material for
more than about 12 minutes becomes two or three videos.

## 2. Story rules

- Open with the question. Analogy first, then the real mechanism, then where the analogy stops (F-001).
- **One through-line metaphor per video, taken from its topic** (F-005). Other images only briefly.
- Each scene's last line sets up the next. The recap calls back earlier visuals (their swatches, icons, words).
- No two scenes of the same type in a row unless the second builds on the first (same actors or node ids:
  the drawing then carries across the cut).
- Short spoken sentences, written as heard ("four forty-three"). One idea per scene, 8 to 30 s. Keep the source's
  numbers and caveats (F-002). On-screen text is a label or a short phrase (F-003): sentence case, no em dashes.

## 3. spec.json

```json
{ "title": "...", "target_minutes": 3, "voice": "af_heart", "direction": {}, "theme": "stage", "design": {},
  "topic": ["security"], "motif": "lock", "scenes": [ { "say": "...", "visual": { "type": "chart", "items": [] } },
    { "heading": "The leak", "say": "...", "visual": { "type": "custom", "component": "Leak" } } ] }
```

- `direction`: part 0. `theme`, `design`: part 4. `topic`: part 5. `motif`: an icon on the title and chapter cards.
  `target_minutes`: the length asked; the report warns when the video is more than 25 % longer or shorter.
- `heading` starts a chapter: a 1.9 s card, counted in the length (`--still N@-1` shows the one before scene N), and
  its name in the progress bar; 3-7 chapters. `"chapter_cards": false` drops the cards, `"captions": false` the
  burned-in subtitles (default true).
- `say`: narration (or `"hold": seconds`); `"pause": seconds` holds a last reveal still before the cut.
- `voice` (Kokoro; in brackets its makers' quality grade): af_heart, US woman (A, the default); af_bella, US woman
  (A-); bf_emma, UK woman (B-); am_michael, US man (C+); bm_george, UK man (C). made.md shows the last ones' voices.
- Second voice: `"voice": "zonos3:savannah"` (ZONOS3-Mini, any stock voice; optional, set up as in
  docs/voice-zonos3.md), or `make.py ...
  --voice zonos3:savannah` over the spec and its scenes. It reads in pieces cut at sentence ends, with a fixed seed; a
  piece the aligner cannot find is retaken with the next seed, up to 3 times. The report's `voice` lists retakes and
  pieces that still fail (listen to them). It skips bracket tokens such as `[INST]` (F-013). `speed` is Kokoro only.
- Said one way, shown another (F-013): `{shown|spoken}` inside `say`. `"the token {[INST]|inst} opens a user turn"`
  is spoken as "the token inst opens a user turn" and captioned as "the token [INST] opens a user turn". The voice
  (and its cache) gets the spoken part; captions, transcript, SRT/VTT, cues and the words scene code reads get the
  shown part, timed over the spoken words (split evenly when it has several words). A cue names shown words:
  `"cue": "[INST]"`. Both parts non-empty, no nesting; a broken group stops the run. "i.e.", "e.g.", "etc." and
  "vs." outside a group warn: write them as heard, `{e.g.|for example}`.
- `cue`: a word from this scene's `say`, once, in order: the item appears (or draws, or travels) when it is spoken.
- `icon`: a plain name ("lock", "server", "browser", "id-card") in the theme's icon set (plate: Bootstrap Icons,
  `bi`; stage: Phosphor, `ph`; ground: Remix Icon, `ri`); `design.icons` names another Iconify set. A name not in
  the set takes the nearest icon found, or a neutral one, and warns with the set's name and its closest names.
- `cut` (rare): glide, rise, fade or none. By default a chapter change rises, scenes inside a chapter glide, and a
  scene that builds on the previous one has no cut.

## 4. Look, designed for the topic (F-005, F-006)

- Every video gets a design of its own: take the ground, the ink, the type and the content colours from the subject
  (its materials, instruments, documents, places). F-004: read docs/avoid-list.md (the look is yours to decide:
  do not stop to show the user directions first, F-015). Then ask whether a similar video would get this design;
  where yes, change it.
- `theme` is only the base a design is laid over (the templates' layout, the chrome, the icon set): `plate` (light, a
  technical plate), `stage` (dark, a board), `ground` (light, fields and a street), or a saved theme. Take a dark
  base for a dark ground. A base with no `design` is the stock look: right only under `stock-look`.
- `design` sets any token over the base: `{"bg": "#hex", "surface": "#hex", "ink": "#hex", "paint": {"water": "#hex"},
  "font": {"text": "IBM Plex Sans", "display": "Fraunces", "data": "JetBrains Mono"}, "icons": ["ph"], "radius": 8,
  "chrome": {"progress": "corner"}}` (this `chrome` swaps the top bar for a corner index). `bg` is the ground,
  `surface` a panel on it; a design with none of `bg`, `surface` and `ink` is still the stock look. Also `lit` (a
  highlight), `ink2`, `back`, `line` (quieter inks), `roles` `{a, b, c, warn}`, `weight`, `stroke`, `caption` `{plate,
  ink, upcoming, size, radius, align}`. Any Fontsource family and any Iconify set works (with `iconAlias`).
- `paint` names are content colours with a meaning (a party, a secret, a material). Use them as `swatch`/`color`.
- make.py checks WCAG contrast and warns. `--save-theme <name>` keeps a design as a theme, only on "save" (F-006).

## 5. Assets (many providers; keys are in .env)

- `"image": "padlock"` or `{"q": "padlock", "kind": "photo", "pick": 3, "provider": "nasa"}`; a URL or a file works.
  Kinds: icon, photo, illustration, vector, video, lottie, sound, music, font, hdri, model. `topic` orders the
  providers (space: NASA; art, history: museums; medicine: Wellcome).
- Run `make.py videos/<slug> --assets`: one numbered contact sheet per request in `out/assets/`. Look once, set
  `pick`, and check that the picture fits the meaning. Without a pick, #1 is used with a warning.
- Licences are in `ledger.json` and the credits. NC, ND, SA are flagged. `"private": true` (a video only the user
  watches) also allows copyrighted pictures; page.py then warns before it builds page parts to publish.

## 6. Templates: finished pictures to pick from

A template draws one kind of content from data, with no code. Pick one where it is the right picture, not by habit.

| type | fields | the right picture for |
|---|---|---|
| `title` | `title`, `subtitle`, `kicker`, `icon` or `image` (the motif by default) | opening |
| `sequence` | `actors`: names or `{name, icon, watch, cue}`; `messages`: `{from, to, label, swatch, icon, sealed, both, dashed, detail, cue}` or notes `{over: name or "all", note, swatch, mix: [a, b] (shows a + b = result), icon, cue}` | protocols, agents talking, anything with turns |
| `stage3d` | `objects`: `{id, kind: block/devices/panel/stack, pos: [x,y,z], size: [w,h,d], color, label, sub, cue}` (`devices`: `src` a geometry JSON with a `stack` of layers `{z, h, color, metal, opacity}` and `devices` `{name, sub, x, y, boxes: {layer: [[x0,y0,x1,y1]]}}`, `scale`, `zScale`; `panel`: `image`; `stack`: `count`); `links`: `{from, to, carry, packets, cue}`; `shots`: `{camera: establish/top/side/low/front/close/orbit, target, az, dist, cue}` | real 3D: devices, machines, a system as places (F-008) |
| `diagram` | `nodes`: `{id, label, sub, icon, shape: box/actor/store/circle, cue}`; `edges`: `{from, to, label, carry, dashed, cue}`; `groups`: `{label, nodes}`; `direction`: LR/TB | systems, pipelines, who talks to whom |
| `plot` | `x`, `y`: `{label, log, min, max, ticks}`; `series`: `{label, points: [[x,y]], color, from, cue}`; `lines`: `{y, label, cue}`; `notes`: `{x, y, text, cue}`; `source` | data, growth, scale |
| `analogy` | `left`, `right`: `{icon, image, label, sub, items, cue}`; `link` | "X works like Y"; matching `items` link pair by pair |
| `points` (`list`, `recap`) | `title`, `items`: text or `{text, icon, swatch, cue}`; `ordered` | lists, the recap |
| `flow` (`steps`) | `items`: `{label, sub, icon, carry, cue}`; `layout`: row or cycle | a short pipeline |
| `compare` | `left`, `right`: `{title, icon, items, cue}` | before and after, A vs B |
| `chart` (`bars`) | `items`: `{label, value, cue}`; `unit`; `title` | a few quantities |
| `timeline` | `items`: `{when, label, cue}` | dates (years sit at their real distance) |
| `stat` (`number`) | `value`, `label`, `sub` | one number as label and value |
| `quote` (`definition`) | `term`, `text`, `by`, `icon` | a definition, the key sentence |
| `code` | `code` (`\n`, at most 14 lines), `highlight`, `cue`, `title` | code, raw data |
| `image` | `image`, `caption`, `callouts`: `{box: [x,y,w,h] as fractions, text, cue}`, `fit` | a real object or figure |
| `svg` | `svg`, `title`, `caption` | a custom figure (costs tokens; rare) |

Special fields: `carry` on an edge sends a payload (a paint name, `{"icon": "lock"}`, or true for a dot). `watch: true`
makes an actor the public lane, keeping a copy of all that crosses it (sealed messages: scrambled bytes); `detail:
{title, lines, cue}` on a message opens a lens on that copy, the real artefact (real values, or say "example").

## 7. Run and check

```powershell
.venv\Scripts\python make.py videos\<slug> --no-render    # no picture: voice, direction, limits, cues, lint, types
.venv\Scripts\python make.py videos\<slug> --assets       # once, if the spec asks for pictures
.venv\Scripts\python make.py videos\<slug> --strip 5      # frames of scene 5 in one image: motion and timing
.venv\Scripts\python make.py videos\<slug> --still 5@2.5  # scene 5 at 2.5 s, full size: type and spacing
.venv\Scripts\python make.py videos\<slug> --strip 5 --design videos\<slug>\b.json   # another look, into out\look-b\
.venv\Scripts\python make.py videos\<slug> --preview      # the whole video, half size, 30 fps
.venv\Scripts\python make.py videos\<slug>                # 1080p 30 fps; --master = 4K 60 fps, only when the user asks (cost: part 8)
```

Get every scene right on strips and stills first (`--strip 3,7,12` or `3-6`; `--still 3@2.5,4@0`; one image each):
an error that only drawing finds (a colour name the theme lacks) never shows under `--no-render`. Then one preview.
Read the JSON report (length, `errors`, warnings, `direction`, `check_by_eye`), then `out\sheet.png` once. Fix and
run again (only changed narration is synthesized again). Outputs: `out\<slug>.mp4`, subtitles and transcript in
`out\text\`; page parts (the video cut into self-contained HTML pages): `page.py videos\<slug>` (720p 30 fps). A `--design` file holds a design (part 4) with an
optional `"theme"`; it replaces the spec's for that run only.

## 8. Scene code: free scenes, worlds and their blocks

Scene code is `videos/<slug>/scenes/Name.tsx`, built on the kit (`@kit`). Start at `docs/kit/README.md`: it names
the page for each need (`core.md` for any scene code), the demos `videos/_kit_*` and what is not built yet. The spec
stays the script: every time that depends on a spoken word is declared here and checked before the render.

| type | fields | use for |
|---|---|---|
| `custom` | `component`, `title`, `tracks`, `places`, `beats`, `set`, `shots`, `labels`, `assets`, `sfx`, `props` | one scene drawn by code, a world of its own |
| `world` | `world`, `title`, `beats`, `set`, `shots`, `labels`, `assets`, `sfx`, `props` | one view of a world declared under `worlds` |

Any other key warns (a scene's own data goes under `props`); a key close to a block name (`shot`) is an error.
`component`, `tracks` and `places` in a `world` scene are errors: they belong to the world. Adjacent scenes of one
world have no cut: the picture, the camera and the state carry on. A `cut` there plays the cut and mounts the
world again (a new canvas; the state still carries on), and make.py warns: leave it out for one continuous picture.

```json
"worlds": { "garden": { "component": "Garden",
  "tracks": { "tank": 0.1, "soil": "brown", "tag": 1, "focus": null },
  "places": { "shed": { "pos": [-3, 0, -0.5], "size": [2.2, 2, 1.8] }, "tank": { "pos": [0.2, 0, -1.2], "size": [1.2, 1.7, 1.2] } },
  "props": { "litres": 200, "words": { "tank": "Rain tank", "volume": "Water in the tank" } } } }
```

- `tracks`: each state track with its first value: a number, a list of numbers, a colour reference or another
  word, true or false, null, or a list of names. `"light.*": "surface"` declares a family. `focus` is reserved.
- `places`: named boxes. 3D (a Stage): `pos` [x, y, z] is the centre of the base, y up, `size` [w, h, d]. 2D (a
  Board): `pos` [x, y] is the top-left corner in layout pixels, `size` [w, h]. Names are lower-case dot paths.
- `assets` and `props` as in a visual. Every place, track and beat that a block or the code names must be declared.

### Blocks

- `beats`: `{ "full": "full" }`, `{ "twice": { "cue": "again", "nth": 2 } }` or `{ "fixed": 2.0 }` (seconds).
  The code reads them by name. A beat may not be named `cue`, `nth`, `at`, `over` or `until` (an error).
- `set`: `[{ "key" | "keys", "to", "cue" | "at", "over" | "until", "ease", "stagger" }]`. A key is a declared track,
  a member of a family (`light.kitchen`) or a whole family (`light.*`). `to` must be the declared kind of value.
  Default `over`: 0.9 s for numbers and lists, 0.25 s for colours, words and focus. `stagger` delays each further
  key of `keys` by that many seconds. An entry without `cue` and `at` is the state the scene opens in (in a scene
  that directly follows one of the same world: a change from its start). All entries of a world share one
  timeline, so a change can run across the seam into the next scene, and a later scene finds the state as left.
- `shots`: `[{ "frame", "target", "pos", "preset", "az", "el", "dist", "fov", "pad", "fit", "orbit", "cue" | "at",
  "over", "ease" }]`. `frame`: places to fit; `preset`: establish, top, side, front, low, close; `az`, `el` in
  degrees; `dist` multiplies the fitted distance; `pad`: room around, as a fraction; `fit`: area, full or
  [x, y, w, h]; `orbit`: degrees per second (costs file size). A shot without a cue opens the scene; a scene with
  none holds the pose it inherits; a 3D shot without an angle keeps the previous one. More: core.md 5.
- `labels`: `[{ "on" | "pos", "text", "sub", "size": s|m|l, "side": top|right|bottom|left, "cue" | "at",
  "until" | "over", "leader", "id" }]`. Drawn by the stage; no code needed; no `dx` or `dy` (an error). A name
  inside a part of a Board drawing belongs in the scene code instead (`KeepSize`, core.md 4).
- `assets`: `{ "name": "file.svg" }` (a path in the video folder) or `{ "name": { "q": "...", "kind": "photo", "pick": 2 } }`.
  Fetched today: local files, and searches for photo, illustration and vector; the rest are `placeholders` in the report.
- `sfx`: `[{ "sound", "cue" | "at", "gain", "offset" }]`: checked and timed, but not mixed yet (a placeholder).

### Cue grammar (free and world visuals)

- `cue` is words of this scene's `say` as shown: a word is what stands between spaces, its marks dropped, case
  ignored (`fact-checker` is `factchecker`, `4,444.7%` is `44447`). A group shows digits while the voice says words:
  `{29.5 days|twenty-nine and a half days}` is cued `29.5 days`. A time is the word's start minus 0.12 s.
- A whole-word match wins over a prefix: `"fill"` finds "fill" before "fills". Only when the words are never
  spoken whole does a prefix count (`"switch"` finds "switches"; the report says "as the start of").
- Each list (`set`, `shots`, `labels`, `sfx`, `beats`) is its own timeline: each cue is looked for after the
  previous cue of that list, then from the start.
- `"nth": 2` picks the second time the words are spoken. A cue spoken more than once without `nth` warns.
- `until` is a second phrase, spoken after the entry starts, that ends the change: make.py turns it into `over`.
- A number is seconds of scene time (`at`, a beat, an `until`: when the change ends); `at` wins over `cue` and warns.
- A cue nobody speaks, an `until` not spoken after its start, or an `nth` past the count is an error: no render.

The report's `cues` lists one line per timed entry. From `_kit_board`:
`"1 set walker: 'comes' -> 3.03 s, match 1 of 1; until 'walks', match 1 of 1 -> over 1.36 s, ease move"`

### Strips, renders and the report

- Pictures: `out\strip-NN.png`, `out\still-03-2.5.png` (a negative time shows the cut in); `--strip` and `--still`
  together use one bundle. A strip of scene code has a frame per timed entry, then `end`, settled (core.md 11).
- `--no-typecheck` skips the type check of the scene code. One run per video folder at a time: make.py holds
  `build/.lock`; a second run stops and names the process; a lock left by a run that died is taken over.
- 4K render time of a 12-minute video: mostly 2D 71 min at 60 fps, 36 at 30; mostly 3D 125 and 65. `--fps 30`
  gives the same pictures at the same times, half as many; `--concurrency N` sets the tabs; both are in the render key.
- The report is the last JSON object on standard output. `--report <path>` also writes it to that file (removed at
  the start, so no file means the run stopped before a report, with its message on standard error).
- Report: `scenes` is the number of scenes in the spec (the numbers `--strip` and `--still` take); chapter cards
  are counted apart under `cards`. `errors`: a broken limit, a wrong name, a lint or type error or a cue nobody
  speaks stops the run before the render, with exit code 1; a scene that fell back to the card is listed, and the
  run then exits 1 (`--strip` and `--still` only list it). Also `cues` and `placeholders`. A `cues` line ends with
  its `over` (`(default)` when the kit picks it), its ease, and `ends at E s, after the scene's end at D s` if so.
