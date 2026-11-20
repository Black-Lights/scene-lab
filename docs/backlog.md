# Template backlog

Wishes that need template, kit or engine work. Done in a template session, then noted in CHANGELOG.md. Kept out of
FEEDBACK.md on purpose: a video session reads FEEDBACK.md in full and needs none of it.

- Background music bed with ducking and sound effects on key moments (v0.2 step 7, not done: the asset system
  already finds Jamendo music and Freesound effects; the audio mix in make.py and the spec fields are missing).
- Video clips as scene backgrounds (v0.2 step 7, not done: Pixabay, NASA and Wikimedia clips are findable; needs
  <OffthreadVideo> in a template and a check of page-part sizes, since moving pixels cost bitrate).
- A 3D template for models and HDRIs (@remotion/three); the asset system already fetches them.
- A Lottie moment in a real video (the component and the asset kind exist; none fits the HTTPS demo).
- Superscript digits (10 to the power n on plot axes) fall back to a system font: Fontsource's latin subset of
  Atkinson Hyperlegible lacks U+2070-2079; load the latin-ext subset or draw exponents as raised text.
- Openverse credentials (needs a name and an email; anonymous search was timing out on 2026-11-14).
- Captions above the player's controls: on a web page that plays the video in the browser's own player, the native
  control bar covers the bottom of the frame while it shows (it hides during playback on desktop). Raise the caption
  band by about 40 px at 1080p. Seen 2026-11-14 on a page part.
- Topic-specific code out of the engine (F-010): stage3d's `devices` kind is still shaped by its first video (layered
  parts from boxes per layer). Replace it with a topic-free primitive (polygons or boxes extruded per layer, with
  per-layer colour, height and build order), which also serves maps, floor plans and exploded views; that video's
  data stays in its own folder.
- `--strip` loses the WebGL context in the first cells of a 3D world scene, also at `--concurrency 1` (seen
  16 Nov 2026 in two 3D world scenes of an earlier video: cells 1 to 8 show the error card). `--still` at the same
  times and the full render draw correctly. Until it is fixed, check the start of a 3D scene with stills.
- Vertical 9:16 version for the phone.
