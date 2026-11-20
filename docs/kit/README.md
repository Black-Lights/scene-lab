# The kit: where to start

The kit (`src/kit`, imported as `'@kit'`) is what a video's own scene code is built on (`videos/<slug>/scenes/*.tsx`):
the free way to make a video (F-015), where the session decides the look, the flow and the kinds of picture for its
topic. Read this page first, then only the pages your video needs. Do not read `src/`.

## The pages

| Page | Read it when | Lines |
|---|---|---|
| docs/kit/core.md | always, for any scene code: files, props, time, beats, worlds and tracks, Board and Stage, shots, overlay, colour and type, assets, determinism, errors, checking | 334 |
| docs/kit/parts.md | a 2D scene draws things: sheets, chips, labels, braces, arrows, stamps, a timer, the hatch, a text card, a capacity bar | 168 |
| docs/kit/blocks.md | a 2D scene shows a file whose lines light (CodeBlock), a list that grows (Ledger), who does what over time (Lanes), a statement on a card (PhraseCard), printed output (OutputPane) | 148 |
| docs/kit/chart.md | a ranking or a share: a ranked column of bars with a pick and a mask (Bars); and how to draw axes or a line meanwhile | 68 |
| docs/kit/shapes.md | a 3D scene with boxes, edges, a flat strip, a room whose roof lifts, and the materials (matte, flat, glow, ghost) | 89 |

A 2D-only video reads core.md and the 2D pages it needs; a "no 3D" or "2D only" limit from the user means shapes.md is
never opened. Of core.md, a 2D scene with no Board needs sections 1, 2, 3, 7, 9, 10 and 11 (about 190 lines); add 4
and 5 for a Board with a camera, 6 for the spec's `labels`, 8 for pictures. The spec side is SPEC.md part 8.

The demos, all on everyday subjects, render and are copied from by the pages: `videos/_kit_core` (the core, 2D and
3D), `_kit_world` (one 3D world across scenes), `_kit_board` (a 2D board with a camera), `_kit_parts` (packing a case),
`_kit_blocks` (a week in a bakery), `_kit_shapes` (a garden shed), `_kit_errors` (five scenes that fail on purpose).

## Every export and its page

| Exports | Page |
|---|---|
| `useClock`, `useBeat`, `useBeats`, `tween`, `prog`, `step`, `mix`, `mixColour`, `easeOf`, `useWords`, `wordAt`; types `Ease`, `Key`, `Tweenable` | core.md 2 |
| `useWorld`, `DIMMED`; type `WorldState`; `useAsset`, `registerLoader`; types `Asset`, `Loader` | core.md 3, 8 |
| `Stage`, `Board`, `KeepSize`, `useStage`, `CONTENT`, `FRAME`; types `StageProps`, `BoardProps`, `KeepSizeProps`, `OnStage`, `StageState` | core.md 4 |
| `Lights`, `Ground`, `Fog`, `SHADOW_MAP`; types `Light`, `GroundSpec`, `FogSpec` (what the Stage's `light`, `ground`, `fog` props draw) | core.md 4 |
| `PRESETS`, `FOV`; types `Vec2`, `Vec3`, `Rect`, `Shot`, `Pose`, `Pose2`, `Projected`; the camera's own math (`settle`, `settle2`, `mixPose`, `mixPose2`, `project`, `project2`, `cameraOf`, `basis`, `turned`, `boundsOf`, `centreOf`, `corners`, `placeOf`, `clipFor`, `shotEntries`, `foldShots`, `OPENING`, `PAD`; types `Camera`, `View`, `Bounds`, `PlaceBox`, `Places`, `SceneShots`, `Entry`, `Folded`) | core.md 5 (scene code needs only the types and `useStage().project`) |
| `Pin`, `Label`, `Counter`, `DataLabels`; types `PinProps`, `LabelProps`, `CounterProps`; the label solver (`solveLabels`, `spotBeside`, `labelLook`; types `Side`, `LabelRect`, `LabelBox`, `LabelSpot`, `LabelLook`) | core.md 6 |
| `paint`, `usePaint`, `useTheme`, `AREA`, `TYPE`, `MIN_TYPE`, `textStyle`, `dataStyle`, `useTextSize`, `SceneTitle`, `Glyph`; types `Theme`, `TypeSize`, `TextSize`, `Measure` | core.md 7 |
| `contrast`, `useCharWidth`, `wrapText`, `wrapToWidth` | parts.md, Measuring |
| `DUR`, `EASE`, `clamp01`, `lerp` | core.md 2 |
| `useScene`, `useVideo`, `report`, `useReport`; types `SceneProps`, `SceneInfo`, `VideoInfo`, `Scene`, `Visual`, `Place`, `TrackValue`, `Word`, `WorldDecl` | core.md 1; `useReport()(message)` writes the `[kit] scene <n> <Name>: <message>` line that the run lists under `errors` (core.md 10) |
| `DrawPath`, `HArrow`, `fitSize` | shared with the fixed templates; in scene code prefer `Arrow2` (parts.md) and `Text` with `w` |
| `FadeIn`, `Sheet`, `Chip`, `Tag`, `Text`, `Brace`, `Arrow2`, `Strike`, `Stamp`, `Countdown`, `TickCross`, `Badge`, `Circled`, `HatchedRect`, `Hatch`, `HatchDefs`, `hatchId`, `hatchFill`, `knockOut`, `SHEET_TAB`, `CHIP_H` and their `...Props` types, `HatchLook` | parts.md |
| `useBeatTimes`, `continuesPicture`, `PAST`, `highlight`; type `LitSpan` | parts.md, Time helpers |
| `TextCard`, `textCardLayout`, `useTextCardLayout`; types `TextCardProps`, `TextCardLayout`, `TextMarker` | parts.md, The list |
| `CapacityBar`, `capacityBarLayout`, `CAPACITY_H`, `CAPACITY_NUMBER`; types `CapacityBarProps`, `CapacityBarLayout`, `CapacityPart` | parts.md, The capacity bar |
| `CodeBlock`, `codeBlockLayout`, `useCodeBlockLayout`, `CODE_LINE`, `CODE_MAX`; types `CodeBlockProps`, `CodeBlockLayout` | blocks.md |
| `Ledger`, `LedgerSlip`, `ledgerLayout`, `useLedgerLayout`, `ledgerNeed`, `ROW_LINE`, `ROW_PAD`; types `LedgerRow`, `LedgerProps`, `LedgerSlipProps`, `LedgerLayout`, `ChipStyle` | blocks.md |
| `Lanes`, `lanesLayout`, `LANE_HEAD`, `LANE_W`, `LANE_BOX_H`, `STEP_W`, `STEP_H`; types `Lane`, `LaneBox`, `LaneArrow`, `LanesProps`, `LanesLayout` | blocks.md |
| `PhraseCard`, `phraseCardLayout`, `usePhraseCardLayout`, `CARD_W`, `CARD_HEAD`; types `PhraseCardProps`, `PhraseCardLayout` | blocks.md |
| `OutputPane`, `paneLayout`, `usePaneLayout`, `PANE_LINE`; types `OutputPaneProps`, `PaneSpan`, `PaneBox`, `PaneLayout` | blocks.md |
| `Bars`, `barsLayout`, `useBarsLayout`, `BARS_ROW`, `BARS_GAP`; types `BarRow`, `BarsProps`, `BarsLayout`, `BarsParts` | chart.md |
| `Box`, `Edges`, `Slab`, `Room`; types `BoxProps`, `EdgesProps`, `SlabProps`, `RoomProps`, `RoomShape` | shapes.md |
| `Matte`, `Flat`, `Glow`, `Ghost`; types `MatteProps`, `GlowProps` | shapes.md |
| engine internals a scene does not call: `worldLine`, `useWorldLine`, `originOf`; types `WorldScene`, `WorldLine` | (none) |

## Not built

What the contract (docs/v0.3-architecture.md 6.7) names and the kit does not have, because no video has needed it yet.
Each has a plain way meanwhile; when a second video needs one, it is built in its module with a demo and a page (F-014).

| Not built | The plain way meanwhile |
|---|---|
| `scale.linear / log / band`, `Axes`, `Series` (with `upTo`), `Rule`, `Band`, `Cursor`, chart `Marker` | one SVG in the scene: a scale is one line of arithmetic, a series a `<polyline>` drawn on with `pathLength={1}` and a dash offset, axes `<line>`s with `Text` ticks, a cursor a `<line>` at a `tween`ed x (chart.md) |
| `useArea`, `Frame` | the constants `AREA`, `CONTENT`, `FRAME` and a `Sheet` (core.md 7, parts.md) |
| `Inset` (a rectangle that holds a template) | a free scene draws its own picture; a template stays a scene of its own |
| `along(d, s)` (a point at a distance along a 2D path) | `Arrow2` for a line that draws on; for a travelling thing, its position from `mix` or `tween` along straight pieces |
| `Ball`, `Cyl`, `Cone`, `Capsule`, `Lathe`, `Extrude`, `Prisms`, `Arrow3`, `FaceText`, `gridPositions` | a raw mesh in the Stage (`<mesh position={centre}><cylinderGeometry args={[r, r, h, 48]} /><Matte color="blue" /></mesh>`), positions from the index (shapes.md) |
| 3D `Appear`; shapes that dim by `id` | grow `scale` or move `position` from a track; pass `dim={w.dim('id')}` |
| `Metal`, `Glass` | `<meshStandardMaterial metalness roughness />`, `<meshPhysicalMaterial transmission />` with `paint(th, ref)` |
| `route`, `Path3`, `Traveler`, `Stream` (flow.tsx) | a track 0..1 per traveller and its position by `mix` between two places' `pos`, or along a list of points |
| `rng`, `hash`, `noise`, `ring`, `spiral`, `onSphere`, `inBox`, `inDisc` (random.ts) | variation from the index: a table in `data/`, or arithmetic such as `(i * 37) % 11`; never `Math.random` (core.md 9) |
| `Model`, `Environment`, `useTexture`, `Picture3`, `Clip`, `Picture` (media), loaders for models, HDRIs, video | pictures (`photo`, `illustration`, `vector`) arrive decoded through `useAsset` (core.md 8); draw them with `<img>` |
| sound: `sfx` and `music` mixed | they are checked and timed, not mixed yet |
| the label solver that keeps labels apart | `side`, `dx`, `dy` on a `Label`; place labels by hand |
