# Design: the explainer engine

The design authority is docs/avoid-list.md (the method and the avoid list) with the motion test below. This file
records how it was applied here: the research, the directions shown, the one chosen and why, the motion language,
and the options rejected. Started 2026-11-14 for v0.2.

## Subject, audience, job

- **Subject:** a mechanism, explained by narration over drawings. The videos come from reports and topics of any
  field: web security (the demo), the Moon's phases, a research note on small language models, everyday things.
- **Audience:** set for each video (`direction.audience`). The engine assumes a viewer on a phone or a laptop, often
  watching a page part at 720p, so fine labels must read at that size.
- **Main job:** understanding without effort. The picture shows what words cannot (shape, motion, quantity), and
  the narration carries the sentences (F-003).

## What the research found, and what was taken

Full notes with every source URL: `docs/research/` (explainers.md, conventions.md, motion.md, assets.md, look.md),
written by a five-agent sweep on 2026-11-14.

**How the best explainers work** (explainers.md)
- 3Blue1Brown: "every movement on the screen should be deliberate"; the next idea grows out of the object already
  on screen (manim's Transform); colour is tied to a role and the matching words are coloured the same way;
  examples come before definitions. https://www.3blue1brown.com/faq
- Kurzgesagt: one visual metaphor per scene, chosen in a sketch phase; narration is recorded first and sets the
  timing. https://kurzgesagt.org/youtube/
- Bartosz Ciechanowski: each demo isolates one idea and complexity is added in order; colour encodes role through
  the whole article; symbols sit next to their objects. https://ciechanow.ski/gears/
- Distill: explanation transforms the idea ("research debt"); words and pictures should complement each other,
  never duplicate. https://distill.pub/2017/research-debt/
- Taken: one persistent drawing per chapter that changes rather than cuts; every motion tied to a narration cue;
  colour fixed to a role for the whole video; labels on the object; concrete before abstract; one through-line
  metaphor with a beat where the analogy and the real part are shown side by side.
- Not taken (their signatures): 3Blue1Brown's near-black with blue and brown, Kurzgesagt's flat glowing space,
  Primer's blobs, Distill's margin layout.

**How each field draws its own content** (conventions.md)
- Protocols: RFC 8446 figure 1 (client left, server right, time down, `{}` for encrypted messages, phase brackets
  on the left), UML sequence diagrams (heads, lifelines, filled vs open arrowheads), Mermaid's vocabulary.
  https://www.rfc-editor.org/rfc/rfc8446#section-2
- Systems: C4 notation (one line = one directed relationship, the label says what flows), data-flow diagrams,
  signal-flow diagrams (a takeoff point copies a signal undiminished). https://c4model.com/diagrams/notation
- Data: Tufte's data-ink, Wilke's direct labels instead of legends, log axes that show original values.
  https://clauswilke.com/dataviz/redundant-coding.html
- Layout library: @dagrejs/dagre 3.1.3 (MIT), the only candidate that is synchronous, layered and directional.

**Type and colour** (look.md)
- Dark text on a light ground reads better for fine detail (smaller pupils), which matters for labels watched on a
  phone. https://cogsci.nl/blog/is-bright-text-on-a-dark-background-a-good-idea
- Atkinson Hyperlegible Next (Braille Institute, for low-vision readers): documented distinct I, l, 1 and O, 0.
  https://www.brailleinstitute.org/freefont/
- Colour-blind-safe palettes: Okabe-Ito and Paul Tol; never colour alone, add shape and a word.
  https://jfly.uni-koeln.de/color/
- File size: flat fills and static grounds encode small; gradients band at low bitrate; grain costs bitrate.
- Slop lists re-checked (impeccable.style, pixelslop, Laith's list). New items, since added to docs/avoid-list.md: pure #000 or #FFF
  grounds, Title Case, several illustration systems in one piece, headlines over 5 lines, round-number stats,
  layout-shifting motion. For video: narration at one pitch with no emphasis, objects that slide weightlessly.

## Directions shown on 2026-11-14

Three directions were generated independently (one designer agent per angle), then reviewed by an adversarial
critic against the avoid list. Each was built as a real theme on the engine and rendered as stills of the same
two demo scenes (the paint-mixing key exchange and the handshake, kept in `videos/_directions`), with the critic's
required fixes applied.

**A. Whiteprint plate (light).** Each video is a technical plate printed in ink on a pale whiteprint ground, drawn
in the protocol's own notation. Ground #E3ECF4, figure white #F7FAFC, a wire-lane tint #CFDCE8 for the public zone,
one ink #14202F for every word and line. Type: Atkinson Hyperlegible Next (phone legibility at 720p), Atkinson
Hyperlegible Mono for byte values only. Icons: Bootstrap Icons (MIT; its 1 px strokes on a 16 px grid match the
diagram's 3 px lines at 48 px). Heads are boxes with a dashed box for the observer; chips are circles with a 3 px
keyline; notes have a folded corner; a takeoff dot copies each message into the public lane (signal-flow
convention). Captions sit under the plate like a figure caption, left-aligned. The progress bar is a dimension
line: the chapter name breaks its own segment, the way dimension text breaks the line on an engineering drawing.
**Signature: the detail lens.** A circle on one small object opens into an inset that shows the real artefact
behind the analogy. In the demo the watcher's green paint becomes a real 32-byte X25519 public key (computed for
the demo, checked against the RFC 7748 test vector), and the sealed packet becomes the bytes a watcher holds.

**B. Shutter Light (dark).** A lecture demonstration on a dark greenboard #18241F, chalk #EEF2EA, coloured chalk for
who may see a thing (public yellow, private pink). Type: Recursive. Icons: Phosphor. **Signature: the shutter
band**, one hard-edged band of stage light over whatever the narrator is talking about, moving down the board as
the protocol advances and turning vertical over one lane when the narration turns to one party.

**C. Public Ground (mid-tone).** Territory: each party owns a field of stone #B9B3A6, the public channel is an
asphalt street #3C3B37, and everything that crosses the street leaves a print there, so the last frame is an audit
of what was exposed. Type: Archivo on the stage, Atkinson Hyperlegible Next in a full-width caption band. Icons:
Remix (fill). **Signature: the street keeps a print**, with square chips and outline-less prints.

**Critic's ranking** (summary): A first. Its signature is the only one that works for every topic (analogy to real
artefact), it is light as the reading research supports, and it has the cheapest file profile. C second: the
strongest subject logic, but a mid-tone ground weakens the paints, it risks an old-poster look, and its signature
exists only where a shared medium does. B third: its colour roles conflicted (fixed in the still), the band is
nearly invisible at 1.29:1 (lifted to about 1.5:1 in the still), and the chalkboard is a cliché.
Fixes applied to all stills: the certificate travels sealed (in TLS 1.3 it is encrypted, so the watcher holds no
copy of it); the messages are named "Client hello" and "Server hello" as in the RFC; "Same secret key" is written
once; the red is crimson so it does not read as orange; the brown is lighter.

**Recommendation: A, Whiteprint plate.** It gives the field's notation a purpose, its signature carries to every
topic the engine will cover (a model's token becomes its real embedding, a measured value becomes its real
number), and a light ground keeps fine labels readable on a phone. From C it borrows the
outline-less print as the shape that marks a copy.

**Decision (2026-11-14):** Whiteprint plate is the default look (since F-015 no theme is a default: each video's
look is designed for it, and a stock theme is only its base). The condition (F-005): the design must adapt
to the topic, so the three directions stay as selectable themes (`"theme": "plate" | "stage" | "ground"`), and a
video can set its own content colours (`"colors"`), typeface (`"font"`, any Fontsource family) and motif. SPEC.md
says which look suits which kind of topic. The engine holds no topic-specific drawing: the analogy lives in the
spec only.

## Motion language (v0.2, src/motion.ts)

The motion test applies to every motion: what real change does it show? Motion starts on a narration cue, uses
eased curves (no bounce, no elastic, no spring overshoot, nothing infinite), and settles into a still frame while
the narration explains it. Numbers come from Material 3, IBM Carbon and manim (docs/research/motion.md); video
runs about 1.5x UI timings because the viewer did not trigger the motion.

| Token | Seconds | Curve | Used for |
|---|---|---|---|
| enter | 0.5 | emphasized decelerate (0.05, 0.7, 0.1, 1) | an item arriving at its cue |
| exit | 0.35 | emphasized accelerate (0.3, 0, 0.8, 0.15) | old items leaving at a continuity cut |
| draw | 0.7 | emphasized (0.2, 0, 0, 1) | an arrow, an edge, an axis, a lens circle drawing on |
| travel | 0.9 | emphasized | a payload moving along its arrow while it is explained |
| morph | 0.9 | emphasized | a layout change, shared actors gliding to new columns, one curve becoming another |
| camera | 1.3 | emphasized | the diagram camera, and the pull back to the whole drawing |
| settle | 0.7 | emphasized | an earlier item stepping back to the "back" ink when the next one is spoken |
| micro | 0.25 | emphasized | a highlight or colour change |
| stagger | 0.08 | none | between items revealed together without cues |
| hold | at least 1.5 | none | stillness after a reveal; scenes end on a still frame |
| data curve | 1.4 | linear | a plotted series laid down at a steady speed (real dynamics are linear) |

- **Cuts** (src/transitions.tsx, @remotion/transitions): inside a chapter the camera glides across one wide canvas
  to the next scene (1.0 s, emphasized, with a 7 percent pull back mid-move so it reads as a camera); at a chapter
  change the frame rises away to the chapter card (0.6 s); a scene that builds on the previous one has no cut at
  all, and the drawing carries across. Every cut sits in the silence between two scenes' narration, centred 0.2 s
  before the next voice starts, so picture and voice never drift.
- **Shared elements:** sequence actors with the same name stay put or glide to their new column; diagram nodes with
  the same id glide to their new place and keep their edges; the chapter card's title flies into the progress bar
  and becomes the chapter name.
- **Focus:** the item being spoken about is in full ink; earlier items step back to the theme's "back" ink (still at
  least 3:1). An actor or lane with a cue takes the focus (the stage look also moves its shutter band there).
- **Travel:** messages and payloads move along their arrows (sequence) and edges (diagram, @remotion/paths
  getPointAtLength) while they are named; the public lane keeps a copy as a payload passes it.
- **Analogy:** the connector between the two sides draws on when the analogy is named; matching parts link pair by
  pair.
- **Text that fits:** titles are sized with @remotion/layout-utils fitText against the loaded face.
- **Lottie:** @remotion/lottie is installed and the asset system finds Lottie files (lottie-web, MIT; LottieFiles
  single files by URL); no Lottie appears in the demo because none fits its story.
- **Not used:** count-ups on numbers that are not being computed, Ken Burns zooms on still pictures (only with
  `"zoom": true`), decorative or looping motion, moving backgrounds (they cost bitrate in every frame).

## Audit of the v0.2 demo (2026-11-14)

**Source search** (a regex for the avoid list's marks over src/, make.py, page.py, assets.py, providers.py, SPEC.md and the demo
spec): one hit, `cap()` in sequence.tsx, which capitalises the first letter of a colour name for the watcher's
label ("Orange"). That is sentence case, so it stays.

**Independent review** (one reviewer agent, told to find faults, given the frames and the code, not my
conclusions). Each finding and what happened:

| # | Finding | Outcome |
|---|---|---|
| 1 | The wide postcard chain ended on a tiny overview, edge labels near 13 px at 720p | Fixed: the demo chain has no edge labels (the postcard and the envelope say it), so it fits at about 0.94 scale; the diagram camera still turns on by itself for wide drawings, and moves only on spoken cues |
| 2 | Stepped-back text at 3.8:1 | Fixed: plate `back` #4F6074 (5.6:1 on the ground), ground look #47443E |
| 3 | Bars, code and lists pinned to the top with an empty lower half; the plate language only in the sequence scenes | Partly fixed: lists, code and bars now sit in the middle of the figure area. A plate frame with a figure caption for every template is a taste-level pass, left to the v0.3 design session |
| 4 | Stock photo of a padlock breaks the drawn language; aphoristic caption | Kept, with a reason: the scene is the demo's test of the asset pipeline (searched, picked, licensed, credited), and the photo shows the real object the icon stands for. The caption now says that; the credit is 26 px. A drawn padlock is an option for v0.3 |
| 5 | "Encrypted data" label touching the "Same secret key" note | Fixed: notes are shorter and message lines sit lower in their rows |
| 6 | A payload box over its edge label; nodes cut off mid-pan | Fixed: labels sit 52 px above their line; the demo no longer pans that chain |
| 7 | Chapter name too small, its width guessed | Fixed: measured with @remotion/layout-utils, 28 px |
| 8 | Paint colours as the only signal | Fixed: the watcher's copies carry their colour name in every look; mixes show + and = |
| 9 | One rounded box everywhere; two equal analogy cards; a tile around the title's lock | Kept for now, with a reason: in the plate look the boxes are the field's notation (UML heads, notes, nodes) and their radii differ by role (heads 12, notes 6 with a folded corner, inset 16, packets 8). The analogy layout and the title tile go to the v0.3 design pass |
| 10 | A label above the heading in the definition scene | Fixed: the term is the title (72 px) and the statement sits under it |
| 11 | Items without a cue faded in across the scene (a cascade) | Fixed: they build within the first second |
| 12 | Plot annotation crossed by the curve; small footnote | Fixed: the reference label sits at the left end, the footnote is 28 px. Superscript digits fall back to a system face (backlog) |

Not verified from stills: the feel of the easing and of the glide and rise cuts at full speed, and phone playback.

## Rejected options

- **Shutter Light** and **Public Ground** stay as selectable themes (F-005), not as the default: the critic found the
  shutter band nearly invisible and the colour roles in conflict, and the mid-tone ground weakens the paint colours.
- **v0.1's look** (dark navy with a radial halo, cyan and violet accents cycled per item, emoji, uppercase labels
  with colour bars): removed whole, not adapted.
- **elkjs** for layout (asynchronous only, EPL or GPL), **d3-force** (no direction, wrong for flows).
- **Karaoke captions** (word by word): all three directions chose phrase-by-phrase subtitles; dimmed upcoming words
  were grey text.
- **libx264 for the master**: same look as NVENC but 16 percent slower at 4K 60 fps.
