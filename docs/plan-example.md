# Plan example: the form of a director's shot plan

When a video needs more scene code than one session carries, a planner writes `videos/<slug>/plan.md` before any
builder starts (docs/workflows.md for the run itself). This page shows the form of such a plan on an everyday
subject, cut short: a real plan details every beat the way section 4 details one. The numbers are an example, not
a measurement.

---

# How a heat pump warms a house: the director's plan

One machine, one loop: how a heat pump takes heat out of cold air and gives it to a warm room. 6 beats, 14 scenes,
mixed (the unit in 3D, the cycle on a 2D board), voice af_heart. Written from `source.md` and the spec's
`direction` block; the narration in `spec.json` is final, and every spoken word below is quoted from it.

Measured on the day: `make.py videos\heat-pump --no-render` passes with 96 cues resolved and no error. The voice
speaks the 890 words at about 150 a minute, so the video runs 6:10 with its title card and four chapter cards.

## 1. How to read this plan

- **S05** is scene 5 of the spec: the number that `--strip` and `--still` take.
- **A cue** is given as `beat name` = "cue words". A picture changes on the word that names the change, never on a
  time counted by hand.
- **A place** is a box: `[x, y, w, h]` in board units on the 2D board, `pos` and `size` on the 3D stage. **A shot**
  frames places. A builder may tune the numbers and may not drop a cue.
- Sizes are layout pixels of the 1920 x 1080 frame.

## 2. Rules of the frame, for every scene

1. **The frame.** The scene title stands in the title row (y 110 to 170); the picture area is x 110 to 1810, y 190
   to 870. Nothing reaches below y 870: the captions stand there.
2. **The thing being taught fills the picture area**: at least 85% of its width or height at the moment it is
   taught. Nothing on screen is under 28 px.
3. **The camera is slow**: 1.5 s per move, at most four moves in a scene, never while a reveal lands on a word
   less than 0.5 s away.
4. **Colour has a meaning** for the whole video: `cold` (the outdoor air and the cold side of the loop), `hot`
   (the indoor side), `work` (the compressor's electricity). Nothing else is coloured.
5. **A picture that runs through several scenes** is cut at a sentence end into scenes one component draws. The
   later scene has no cut and opens on the camera pose the scene before ended on.
6. **Words.** Every word on screen comes from the video's data file (in its `data` folder) or the scene's props.
   Scene code holds no word, no colour value and no font name.

## 3. The scenes at a glance

| Scene | Beat | Component | Builder | Chapter card | Words | About |
|---|---|---|---|---|---|---|
| S01 | before 1 | template `title` | 2 | | 0 | 4 s |
| S02 | 1 | `PuzzleBoard` | 2 | The puzzle | 70 | 28 s |
| S03 | 2 | world `unit`, `UnitWorld` | 1 | The machine | 82 | 33 s |
| S04 | 2 | world `unit` | 1 | | 64 | 26 s |
| S05 | 2 | world `unit` | 1 | | 58 | 23 s |
| S06 | 3 | `CycleBoard` | 2 | The loop | 96 | 38 s |
| S07 | 3 | `CycleBoard` | 2 | | 71 | 28 s |
| S08 | 3 | `CycleBoard` | 2 | | 66 | 26 s |
| S09 | 4 | `PressureChart` | 2 | | 60 | 24 s |
| S10 | 5 | world `unit` | 1 | Inside the room | 55 | 22 s |
| S11 | 5 | world `unit` | 1 | | 48 | 19 s |
| S12 | 6 | template `chart` | 2 | | 52 | 21 s |
| S13 | 6 | `CycleBoard` | 2 | | 74 | 30 s |
| S14 | 6 | template `points` (the recap) | 2 | | 94 | 38 s |

Cuts: a chapter card rises; scenes inside a chapter glide. S07, S08 and S13 continue the picture of the scene
before and have no cut. S04, S05, S10 and S11 continue the world of S03, so the kit makes no cut.

## 4. The beats, scene by scene

### Beat 3. The loop (2D). S06, S07 and S08

One picture, `CycleBoard`: the closed pipe drawn flat, with its four stations (evaporator, compressor, condenser,
valve). Cut at "Now follow one drop" and at "Back at the valve".

- **Size and position:** place `loop` = `[0, 0, 1600, 640]` fills the picture area at zoom 1. Station names 36 px.
- **Camera:** one shot on `loop` for S06; S07 closes in on `compressor` and `condenser`, S08 pulls back to `loop`.
- **S06 at the start:** the empty pipe in the `line` tone.

| Beat | Cue words | Change |
|---|---|---|
| `pipe` | "a closed loop" | The pipe draws round in 1.2 s, no stations yet |
| `cold` | "colder than the air" | The evaporator lights in `cold`; arrows of outdoor heat flow into it |
| `squeeze` | "squeezes" | The compressor lights; a `work` arrow enters from the socket |
| `hot` | "hotter than the room" | The condenser lights in `hot`; arrows of heat flow out to the room |
| `valve` | "lets the pressure drop" | The valve lights; the pipe after it returns to `cold` |

- **S07 and S08:** one drop travels the loop, its colour following the state at each station (track `drop` from 0
  to 1, keyed on "follow", "squeezed", "gives up", "back at the valve").

## 5. The builders

No two builders write the same file. A scene belongs to the builder named in section 3.

| | Builder 1: the unit in 3D | Builder 2: the boards, the charts, the cards |
|---|---|---|
| Scenes | S03 to S05, S10, S11 | S01, S02, S06 to S09, S12 to S14 |
| Scene files in `scenes/` | `UnitWorld` | `PuzzleBoard`, `CycleBoard`, `PressureChart` |
| Shared files | none | none |

Nobody writes `spec.json` or the data file: a wish for either goes to the planner.

Order of work: first what another builder waits for, whole and compiling, then the scenes, hardest first (the
world, the loop). A scene that waits for something is written last and drawn without it until it is there.

How a builder renders: one make.py run per video folder holds its lock, so each builder works in a scratch copy,
`videos\_heat-pump-b1\`, whose `spec.json` holds only that builder's scenes (with the scenes before any scene that
continues a picture or a world) and whose `scenes\` re-export the real files in one line each. Scratch copies are
never committed.

```powershell
.venv\Scripts\python make.py videos\_heat-pump-b2 --strip 1,2
.venv\Scripts\python make.py videos\_heat-pump-b2 --still 1@20,2@0.2
```

Checks before a scene is called done: its strip was opened and every change lands on its word; a full-size still
shows no text under 28 px and nothing below y 870; the seam into a scene without a cut was looked at with a still
at 0.2 s; the scene code holds no colour value; no long dash, no uppercase label, no sentence on screen (F-003).
