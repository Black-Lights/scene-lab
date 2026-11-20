# Kit core: writing a scene

For a session making a video whose spec has a `custom` or `world` scene. Together with SPEC.md (part 8 is the
spec side) and FEEDBACK.md, this page is all you need to write a scene that works. Do not read src/. The index of
the kit's other pages (drawn parts, blocks, charts, 3D shapes) and of every export is docs/kit/README.md.
Every excerpt below is copied from a demo that renders, with its path. Lines marked "(checked)" come from a
scratch scene that was type-checked and rendered with the same kit.

| Demo | What it shows |
|---|---|
| `videos/_kit_core` | `Fill.tsx`: a free 2D scene with tracks, a `set` with `until`, a beat, a Counter. `Slabs.tsx`: a Stage, places, a shot, labels given as data |
| `videos/_kit_world` | `Garden.tsx`: one 3D world seen in scenes 1, 2 and 4: state across scenes, focus, a Label and a Counter in the overlay |
| `videos/_kit_board` | `FlatPlan.tsx`: the same on a 2D Board, with a vector track and a colour family `light.*` |
| `videos/_kit_errors` | five scenes that fail on purpose: the card and the report lines |
| `videos/_kit_parts` | `Packing.tsx`: the drawn 2D parts (sheet, chip, text card, brace, arrow, capacity bar...): docs/kit/parts.md |
| `videos/_kit_blocks` | `Orders.tsx`, `Shop.tsx`, `Sales.tsx`: the larger 2D blocks (CodeBlock, Ledger, Lanes, PhraseCard, OutputPane, Bars): docs/kit/blocks.md, chart.md |
| `videos/_kit_shapes` | `Shed.tsx`: the 3D shapes and materials (Room, Box, Edges, Slab; Matte, Glow, Ghost): docs/kit/shapes.md |

## 1. Files and what a component receives

- One component per file: `videos/<slug>/scenes/Name.tsx`, default export `function Name`, PascalCase. The spec
  names it: `{"type": "custom", "component": "Name"}`, or once under `worlds.<id>.component` for world scenes.
  Only `.tsx` files directly in `scenes/` are components; helpers go in a subfolder (`scenes/lib/`). Large data:
  `videos/<slug>/data/*.json`, imported. A helper elsewhere (`videos/<slug>/lib/`, a shared folder) is fine too:
  every file reached by a relative import is part of the bundle hash, so editing it makes a new bundle.
- Import the kit from `'@kit'`, `AbsoluteFill` from `'remotion'`, and `'three'` only for raw three objects.
- Props (`SceneProps`): `{ v, dur, scene, index, prev }`. `v` is the visual after make.py: every `cue` is now
  `at` in seconds, every `until` is `over`, assets are resolved. `dur` is the scene's length; `prev` is
  `{ v, dur }` of the scene before, or null.
- Text on screen comes from the spec (`props`) or a data file, never from a string in the TSX.

```tsx
// videos/_kit_core/scenes/Fill.tsx
export default function Fill({ v }: SceneProps) {
  const level = w.num('level'); // 0..1, moved by the spec's "set" on the spoken words
```

## 2. Time

Seconds, never frames. `useClock()` is scene time `t`: 0 is the scene's start, the voice starts at 0.35 s, and
the scene is on screen from about -0.7 s (the cut in) to `dur + 0.3`, so every value must be defined for
`t < 0` and `t > dur`. Every time helper takes `t` first.

| Helper | What it gives |
|---|---|
| `useBeat(name, fallback?)` | a named beat of the spec in scene seconds; throws for an undeclared name unless `fallback` is given (`Infinity` = never). A beat may not be named `cue`, `nth`, `at`, `over` or `until` (a spec error) |
| `useBeats()` | all beats, `{ name: seconds }` |
| `tween(t, from, keys)` | keys `[{ at, to, over?, ease? }]`; numbers, number lists, hex colours. Each key starts from wherever the value is. Default `over` 0.9 s (numbers), 0.25 s (colours); default ease `move` |
| `prog(t, at, dur = 0.5, ease = 'enter')` | eased 0..1; 0 before `at`, 1 after `at + dur`. A `dur` that is 0 or NaN (two beats never spoken) is an instant step |
| `step(t, at)` | 0 before `at`, 1 from it on |
| `mix(a, b, p)`, `mixColour(hexA, hexB, p)` | between two values (`p` held to 0..1); colours mixed in linear light. Colours must be hex: a name throws, so pass it through `paint()` first (section 7) |
| `easeOf(name)` | the curve of `enter`, `exit`, `move` or `linear` (any other name throws) |
| `useWords()`, `wordAt(words, phrase, nth = 1)` | the scene's words in scene seconds, and when a phrase starts (or null). Only for text that follows the voice, never to time a motion: that is a beat |

`DUR` holds the engine's durations (`micro` 0.25, `enter` 0.5, `exit` 0.35, `morph` 0.9, `camera` 1.3). The eases, as
the share of the way done at a quarter and at half of the time: `move` (camera, `set`, `tween`) starts at once and
settles long, 61% and 88%; `enter` is quicker still, 83% and 95%; `exit` starts slow and ends fast, 4% and 15%.

```tsx
// (checked) beats: "twice": { "cue": "again", "nth": 2 }, "fixed": 2.0
const twice = useBeat('twice');
const fixed = useBeat('fixed');
const late = useBeat('late', Infinity); // not declared in this scene: never
const size = tween(t, 40, [{ at: fixed, to: 80 }, { at: twice, to: 60, over: 0.4, ease: 'enter' }]);
const shown = prog(t, twice, 0.5) * (1 - step(t, late));
```

## 3. Worlds and tracks

A world is declared in the spec (SPEC.md part 8): its component, the first value of every state track, its
places, assets and props. `set` entries change the tracks on spoken words. A `custom` scene is a world of one
scene: its own visual holds `tracks`, `places`, `assets` and `props`. Read the state with `useWorld()`:

| Field | Meaning |
|---|---|
| `w.num(key)`, `w.vec(key)` | a number track, a list-of-numbers track, at this frame |
| `w.color(key)` | a colour track as `#rrggbb`; its values are any colour reference (section 7), mixed in linear light |
| `w.get(key)` | any track; a word or a true/false switches half way through its change |
| `w.state(key)` | `{ from, to, p }`: for a value that cannot be mixed, draw both and cross-fade with `p` |
| `w.dim(id)` | 1 when `id` is in focus or nothing is, 0.3 otherwise, cross-faded over 0.25 s |
| `w.props`, `w.places` | the world's props with the scene's own props over them; the places the spec declares |
| `w.asset(name)` | a declared asset (section 8) |
| `w.T`, `w.t`, `w.run`, `w.id` | world time, scene time, seconds since this unbroken run of the world began, the id |

The readers are plain functions, so they work in loops. Reading a track that is not declared throws.

- **Families.** `"light.*": "surface"` declares `light.kitchen`, `light.bedroom` and any other name under it.
  Read one member, `w.color('light.kitchen')`; a `set` may name one member or the whole family.
- **Focus.** `focus` is the one reserved track: a place id, a list of ids, or null. Ids match by dot prefix:
  focus `cell` holds `cell.3`. Dim by mixing toward the ground colour, never by opacity:

```tsx
// videos/_kit_board/scenes/FlatPlan.tsx
const ink = (id: string) => mixColour(th.bg, th.ink, w.dim(id));
background: mixColour(th.bg, w.color(`light.${id}`), w.dim(id)),
```

- **One timeline per world.** Every `set` of every scene of a world sits at `scene start + at` on the video's
  timeline, and each change moves the value from wherever it is. A change that starts late in one scene
  finishes in the next (`_kit_world`: the tank fill starts on the last word of scene 1 and ends in scene 2), and
  a later scene finds the state the earlier ones left, also with another scene between (`_kit_world` scene 4).
- A `custom` scene starts from its own declaration every time: `_kit_core` scenes 1 and 2 share `Fill.tsx`.

## 4. The two stages

| | `<Board>` (2D) | `<Stage>` (3D) |
|---|---|---|
| Children | HTML and SVG, `position: 'absolute'` in board units: layout pixels at zoom 1, x right, y down. They scale with the zoom | react-three-fiber elements; raw three geometry is fine |
| A place | `{ "pos": [x, y], "size": [w, h] }`, pos = top-left corner | `{ "pos": [x, y, z], "size": [w, h, d] }`, pos = centre of its base; y up, ground at y = 0 |
| Props | `v`, `places`, `rect`, `overlay` | the same, plus `light`: `studio` (default), `day`, `flat`; `ground`: `shadow` (default), `solid`, `none`, `{ color, size }`; `fog`: false, true or `{ color, near, far }` |

- Pass `v={v}`: the stage reads `shots` and `labels` from it and runs the camera on world time.
- `rect` is `[x, y, w, h]` in layout pixels (default the whole 1920x1080 frame). The camera fits the subject into
  the part of `rect` that lies in the content area. `_kit_board` puts the board under the scene title. Nothing is
  drawn outside `rect`: a shot that closes in is cut at its edge, so a 3D stage under the title runs on to the foot
  of the frame, under the captions (`[0, 180, 1920, 900]`, `_kit_shapes`).
- Board units have their own origin, neither the frame's nor `rect`'s: the camera puts the board point it looks at
  in the middle of `rect`. `_kit_board`'s rooms span [0, 0] to [1200, 560]; its opening shot puts [0, 0] at about
  (310, 222) on the frame, and at zoom 1 a room 480 units wide is 480 px wide.
- **A name on a board** keeps its size inside `<KeepSize pos={[x, y]}>` (its top-left corner at a board point;
  `center` puts its middle there); a plain 30 px name drew at 25 px in a wide shot. Draw the parts, then the names.
  On a Stage, names go in the overlay (section 6) or in the spec's `labels`.

```tsx
// videos/_kit_board/scenes/FlatPlan.tsx
const RECT = [0, 180, 1920, 690];
<SceneTitle text={v.title} t={t} />
<Board v={v} rect={RECT}>
  {/* ... every room first, then one name per room ... */}
  <KeepSize key={id} pos={w.places[id].pos}>
    <div style={{ padding: '12px 18px', ...textStyle(th, 's'), color: ink(id) }}>{name}</div>
  </KeepSize>
```

- The `places` prop adds places this stage alone knows, for code (`Pin`, `project`). A shot, a label or a focus in
  the spec may name only places declared in the spec.
- A three mesh's `position` is its centre, a place's `pos` is the centre of its base (the kit's shapes take `pos` as
  the base too, docs/kit/shapes.md):

```tsx
// videos/_kit_core/scenes/Slabs.tsx
const [x, y, z] = place.pos;
const [w, h, d] = place.size ?? [1, 1, 1];
<mesh position={[x, y + h / 2, z]} castShadow receiveShadow>
```

- `meshLambertMaterial` (the kit's `Matte`) shows its palette colour exactly on a face that looks up under `studio`
  (measured in `_kit_core` scene 3). A standard material reads a little darker. The canvas is transparent: the 3D picture sits
  on the video's own ground colour, and the `shadow` ground only darkens it where a shadow falls.
- Change three objects during render or in `useLayoutEffect`, never in `useEffect`, and never with `useFrame`.
- One `<Stage>` per scene (each is a WebGL context): a second one turns the scene into the card. A Board and a
  Stage may share a scene; a Stage or a Board inside a Stage's 3D children throws. Consecutive scenes of one world
  are one mount, so the canvas survives the seam; build heavy geometry once at module level.
- Layers: the chapter bar and the captions are drawn above every scene, with a halo of the ground colour. Inside a
  scene, JSX order is paint order: a full-frame Stage covers a `SceneTitle` written before it, so write the title
  after the Stage, or give the stage a `rect` under the title (`_kit_board`).
- `useStage()` gives `{ kind, pose, project(placeOrPoint), places, rect, area }` to the overlay, to a Board's
  children and inside the 3D canvas. `project` returns `{ x, y, depth, visible, box }` in layout pixels; `area`
  is the content area cut to the stage. A Stage's `pose` is `{ target, az, el, dist, fov, shift }`, a Board's
  `{ x, y, zoom }`.

## 5. Shots and the camera

Shots are data in the spec (fields in SPEC.md part 8). The rules the camera follows:

1. A shot with a `cue` or `at` is a move at that time: `over` 1.3 s by default, ease `move`, from wherever the
   camera is.
2. A shot without one opens its scene: a cut to that pose, or, in a scene that directly follows a scene of the
   same world, a move that starts at t = 0 (`_kit_board` scene 2 continues from scene 1's pose). That move is in
   the report's `cues` ("no cue, so a camera move from 0.00 s") and has its own cells in the strip. A `set` entry
   without a cue in such a scene is likewise a change from t = 0.
3. A scene with no shots holds the pose it inherits. The first scene of a world, and every `custom` scene, opens
   on `establish` over all places.
4. On a Stage, a shot that names no `az`, `el`, `preset` or `pos` keeps the angle of the pose before it.
5. A scene that comes back to a world after another scene inherits where the camera was; give it a first shot
   without a cue to cut to its own pose (`_kit_world` and `_kit_board` scene 4).

Presets (az, el, dist): `establish` 35, 28, 1; `top` 0, 90, 1; `side` 90, 8, 1; `front` 0, 12, 1; `low` 35, 5, 1;
`close` 30, 20, 0.6. Degrees: `az` 0 puts the camera on +Z looking at -Z and grows towards +X; `el` 90 looks
straight down. `dist` multiplies the distance at which the framed places just fit, so `close` overflows the
content area on purpose and may reach under the chapter bar. `fit` is `area` (default), `full` or `[x, y, w, h]`:
`_kit_core` scene 3 uses `[110, 200, 1700, 640]` to keep the slabs clear of the scene title. The camera fits
only the places a shot frames: one that is not framed can land anywhere, under the overlay or the chrome too, so
frame everything that must stay clear or choose an angle that keeps it clear (`_kit_world` scene 2 frames bed and
tank at `el` 14; at `el` 30 the unframed shed's roof reached under the chapter bar). On a Board, `az`, `el`, `fov` and `orbit` do nothing, `dist` 2 shows the places half as large, and the fit
is set by the tighter axis.

## 6. The overlay

HTML above a stage, in layout pixels, passed as its `overlay` prop. Pin and Label among 3D children throw.

| Part | Props |
|---|---|
| `<Pin>` | `on` (place) or `pos` (point), `side` `center` (default), `top`, `right`, `bottom`, `left`, `dx`, `dy`, `opacity`, children. Follows the camera and may leave the frame with its place; not kept in the content area |
| `<Label>` | `on` or `pos`, `text`, `sub`, `size` `s`/`m`/`l` (default `m`), `side` (default `top`), `at`, `until` (scene seconds: fades in 0.5 s, out 0.35 s), `leader` (a line to the middle of the place box), `dx`, `dy`. Kept inside the content area |
| `<Counter>` | `value`, `decimals` (0), `unit`, `size` (`m`, or pixels), `color` (a colour reference), `style`. Inline: put it in a Pin or a positioned box |

```tsx
// videos/_kit_world/scenes/Garden.tsx
const overlay = (
  <>
    {w.num('tag') > 0.5 ? <Label on="tank" text={words.tank} side="right" leader /> : null}
    <div style={{ position: 'absolute', left: AREA.side, top: 1080 - AREA.bottom - 120 }}>
      <div style={{ ...textStyle(th, 's'), color: th.ink2 }}>{words.volume}</div>
      <Counter value={litres} unit="L" size="l" />
    </div>
  </>
);
```

A Label stays clamped inside the content area even when its place has left the frame, so hide it by state, as
Garden does with its `tag` track. The content area's top row is the scene title's: a `top` label of a high place
sits level with the title, so keep the subject lower with `fit`. A label is set against its place's box, so a part
drawn beyond the box ends up under it: make the place cover what you draw (`_kit_world`'s shed holds its roof).
**Labels given as data** (the spec's `labels`) are drawn by the stage itself: you write no code. Today they take
the side the spec gives (`top` when none), stay in the content area, are hidden when the middle of their place is
outside it, and do not avoid each other yet. Across the seam of two scenes of one world, a label both scenes
declare (same `id`, else same `on`, else same `text`) stays; others fade.

## 7. Colour and type

- `paint(th, ref)` and `const c = usePaint(); c('warn')` turn a colour reference into `#rrggbb`. A reference is a
  hex value, a paint of the theme (plate: yellow, red, blue, orange, green, brown, sealed), a role (`a`, `b`, `c`,
  `warn`) or a token (`ink`, `ink2`, `back`, `line`, `surface`, `bg`, and `lit`, the focus band: the theme's, else the
  surface mixed toward the ink). An unknown name throws. The spec's
  `"design": { "paint": { "water": "#2457C5" } }` adds a name (`_kit_core`; `lamp` in `_kit_board`).
- `useTheme()` also gives `th.font.text | display | data`, `th.weight`, `th.stroke` (base stroke width),
  `th.radius` and `th.dark`. Scene code holds no hex literal.
- Type: `TYPE = { s: 30, m: 40, l: 54 }`, nothing under `MIN_TYPE` (28). `textStyle(th, 's' | 'm' | 'l')` for text
  ('l' is the display face), `dataStyle(th, size)` for numbers (tabular figures). `const measure =
  useTextSize(); measure(text, style)` gives `{ w, h }` in layout pixels; the fonts are loaded before a scene
  mounts, so the width is final.
- Layout: `AREA = { top: 110, bottom: 210, side: 110 }`, `CONTENT = [110, 110, 1700, 760]`, `FRAME`.
  `<SceneTitle text={v.title} t={t} />` draws the title at the top of the content area.
- Icons: an `icon` field anywhere in a scene's visual (`"props": { "icon": "lock" }`) arrives as icon data:
  `<Glyph icon={v.props.icon} size={60} />` (checked). An `icon` in a world's `props` arrives the same way.

## 8. Assets

Declare every asset in the spec, under the visual's `assets` or the world's (SPEC.md part 8). Before a scene
mounts, the engine loads all of them and the video's typefaces (the preload gate), so reading is synchronous:
`useAsset(name)` or `w.asset(name)` gives `{ src, kind, credit, data }`. A world scene reads the world's assets
and its own; an undeclared name throws.

```tsx
// (checked) "assets": { "mark": "mark.svg" }
const mark = useAsset('mark');
const img = mark.data as HTMLImageElement;
<img src={img.src} width={60} height={60} />
```

Pictures (`photo`, `illustration`, `vector`) arrive decoded in `data`. Other kinds have no loader yet and come
without `data`. A request make.py could not fetch arrives as `{ src: null, placeholder: true }`, with a line
under `placeholders` in the report: draw a stand-in of the right size. Never load anything yourself. A `.gltf`
brings only the files it names (its buffers and images); a `uri` outside the `.gltf`'s own folder, or a missing
file, makes the asset a placeholder with a warning. A local file is copied under a name made from its content, so
an edit is picked up on the next run, and the copy of the old content is removed from `build/public`.

## 9. Determinism

A picture is a pure function of time, the spec, the theme and the assets. No clock, no randomness, no timers, no
loops, no loading, no Remotion time containers; data from the spec or an import. make.py lints every file of
`scenes/` (comments are skipped; a line containing `deterministic-ok` is exempt).

- **Blocking:** `Math.random`, `crypto.getRandomValues` / `randomUUID`, `Date.now`, `new Date(`,
  `performance.now`, `setTimeout` / `setInterval` / `setImmediate`, `requestAnimationFrame`, `useFrame`,
  `THREE.Clock`, `new Clock(`, `useCurrentFrame`, `<Sequence`, `<Loop`, `<Freeze`, Remotion's `<Series`,
  `spring(`, `useLoader(`, `TextureLoader`, `GLTFLoader`, `fetch(`, `useEffect(`, `<Suspense`, `delayRender`.
- **Warning:** `interpolate(` (use tween, mix, prog), the word `fps`, CSS `transition` and `animation` keys, and
  a file that writes `<Stage` more than once (a second mounted Stage turns the scene into its card; a Board can
  share a scene with a Stage). The last is only a warning because a file may mount one of two at a time.
- Each message names the replacement. Variation comes from the index (a table in `data/`, or arithmetic on it).

## 10. When it fails

**Before the render**, make.py stops with exit code 1 and the report's `errors` lists every problem at once:

| Example line | Meaning |
|---|---|
| `scene 1 set[1]: the track "levl" is not declared (did you mean "level"?) (tracks: ...)` | a spec name that no declaration covers (also places in `frame`, `on`, `target`, focus) |
| `scene 1 set level: cue 'opns' is not in the narration` | a cue nobody speaks (SPEC.md part 8) |
| `scenes/Fill.tsx:12: Math.random: vary by index instead ...` | lint (section 9) |
| `scenes/Fill.tsx:22: TS2339: ...` | a type error in the video's own files |
| `type check did not run (tsc exit N): ...` | tsc could not run at all; fix the TypeScript install, or render without the check (`--no-typecheck`) |

**During the render**, a scene that throws becomes, for those frames only, a plain card with its title and "The
scene "Name" could not be drawn: <message>". The frames before the error keep their picture. The browser writes
`[kit] scene <n> <Name>: <message>` once; the report lists it under `errors` as `scene <n> <Name>: <message>`.
A full render then exits 1; `--strip` and `--still` list the errors and exit 0.

| Message (from `_kit_errors` and the kit) | What to do |
|---|---|
| `track "speed" is not declared in this scene's "tracks" (tracks: level)` | declare it, or fix the key in the code |
| `track "x" holds "full", which is not a number` | the reader does not match the value: `w.get` or `w.state` for words |
| `colour "purple" is not a hex value, a paint (...), a role (...) or a token (...)` | use a name of the theme, or add one with `design.paint` |
| `colour "red" is not hex: resolve a paint, role or token with paint(th, ref) ...` | `mixColour`, `mix` or `tween` got a name: `paint()` it first |
| `this scene mounts a second <Stage> ...` | one Stage per scene: draw both parts in it, or one on a Board |
| `beat "x" is not declared in this scene's "beats" (declared: ...)` | declare it, or pass a fallback in a component shared by scenes |
| `asset "x" is not declared (assets: ...)` | declare it under `assets` |
| `<Label> is HTML: put it in the "overlay" prop of the <Stage>, not among its 3D children` | move it to `overlay` |
| `useStage() and the overlay parts (Pin, Label) need a <Stage> or a <Board> around them` | a Pin or Label outside a stage |
| `the place "x" needs "pos": [x, y, z] on a <Stage> (a place with [x, y] belongs to a <Board>)` | 2D places on a Stage, or the reverse |
| `the camera pose of this <Stage> is not usable (...)` | a place with a missing or NaN number, or a `fov` of 180 or more |
| `a shader of this stage did not compile: ...` | a hand-written material or shader is broken |
| `the WebGL context of this stage was lost ...` | the machine was busy: render again |
| `the asset <src> (<kind>) could not be loaded: ...` | a broken or missing file |
| `scenes/Broken.tsx threw while it loaded: ...` | an error at the top level of the file, outside the component |
| `Cannot read properties of undefined (reading 'text')` | an ordinary bug in the scene (`ThrowLater` reads past its list after 1 s) |

## 11. Checking a scene

```powershell
.venv\Scripts\python make.py videos\<slug> --strip 3        # out\strip-03.png; several: --strip 1,2,4 or 3-6
.venv\Scripts\python make.py videos\<slug> --still 3@2.5    # out\still-03-2.5.png at 1920x1080; several: 3@2.5,4@0
```

A strip of a `custom` or `world` scene has a frame at the start, the middle and just after the end of every timed
entry (up to 24 frames), captioned with its time and block ("4.07 s, set mid"); `end` is the scene settled, just
before the cut out, and a world scene that continues a world adds cells for changes carried over the seam
("set from before mid") and for its entries without a cue, which move from t = 0 ("shots mid"). An entry without
`over` is timed as the kit times it: a camera move 1.3 s, a number 0.9 s, a colour or a word 0.25 s. `--strip` and `--still` can run together. Look: does each change land on its
word, does the state carry across seams? A still judges type at full size; a negative time shows the cut in. The
report's `cues` lists the resolved times. Run `--preview` only at the end. Smoke checks of the kit: `_kit_core`
scene 3 (a card means the 3D context bridge broke) and `_kit_errors --preview` (five errors, exit code 1).

## 12. Not there yet

What the contract names and the kit does not have yet, each with the plain way to do it meanwhile, is listed under
"Not built" in docs/kit/README.md: among them 3D shapes beyond boxes (`Ball`, `Cyl`, `Cone`, `Extrude`...), `Metal` and
`Glass`, chart axes and lines (`scale`, `Axes`, `Series`, `Cursor`), motion along paths (`route`, `Traveler`), seeded
variation (`rng`, `noise`), media loaders (`Model`, `Clip`), mixed sound, and the label solver. What exists has a page:
the drawn 2D parts in parts.md, the blocks (`CodeBlock`, `Ledger`, `Lanes`, `PhraseCard`, `OutputPane`) in blocks.md,
`Bars` in chart.md, and `Box`, `Edges`, `Slab`, `Room`, `Matte`, `Flat`, `Glow`, `Ghost` in shapes.md.
`dx` and `dy` belong to `<Label>`; a label given as data has none.
