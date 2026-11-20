# Kit shapes: 3D shapes and materials

For a session writing a 3D scene: a `<Stage>` with things that have form or are places (F-011). Read docs/kit/core.md
first (sections 4 and 5: the stage, places, shots). Import from `'@kit'`. Every excerpt is copied from
`videos/_kit_shapes/scenes/Shed.tsx` (theme `plate`, 17 s, one scene: a garden shed whose roof lifts), which renders.
The shapes were first drawn for an earlier video and then made topic-free.

## Rules

- Inside a `<Stage>`, as its 3D children. Y up, ground at y = 0, units are the video's own (the demo: metres).
- `pos` is the centre of the shape's BASE, as for a place (core.md section 4): a shape stands on its place with
  `pos={place.pos}` and `size={place.size}`, so the camera frames what is drawn. three's own `position` (the centre)
  belongs to raw meshes only.
- Colours are colour references (hex, paint, role, token). `dim` (1 in focus, 0.3 stepped back) mixes a colour toward
  the ground, never opacity: pass `w.dim('id')` yourself (shapes do not read the focus by id yet).
- Everything moves by its props: drive them from tracks (`w.num('lid')`), never from a clock or `useFrame`.
- `shadow` makes a Box or a Room cast and receive shadows; the stage's default ground `shadow` then shows them. Off by
  default.

| Export | Use it for | Props (default) |
|---|---|---|
| `Box` | anything box-shaped: a building block, a crate, a server, a lamp | `pos`, `size`, `color`, `flat` (takes no light), `rot` (degrees about y), `dim`, `shadow`, children: a material instead of the matte one |
| `Edges` | the twelve edges of a box as thin beams (a WebGL line is 1 px, too thin at 4K) | `pos`, `size` (of the box), `color`, `k` (beam thickness, about 0.02 to 0.05), `only` ('top': the top ring; 'rest': all but it), `dim` |
| `Slab` | a thin strip lying flat along +z in coloured parts, growing from its leading end: a path being laid, a paper strip, a timeline on the ground | `start` [x, y, z] (middle of the leading end, underside), `len`, `w`, `k` (0.025 thick), `parts` `[{ color, share }]` (relative shares), `shown` 0..1 |
| `Room` | a hollow building with one opening in its front wall and a roof that lifts away so the camera can look in: a shed, a server room, an oven, a box with a lid | below |
| `Matte` | a lit matte surface (lambert): a face that looks up shows its colour exactly under `studio` light | `color`, `opacity` (1) |
| `Flat` | a surface that takes no light: the colour exactly on every face | `color` |
| `Glow` | matte with a light of its own: a lamp, a lit pane | `color`, `glow` (its light's colour, default its own), `k` (1: how strongly), `opacity` |
| `Ghost` | a see-through matte surface: a planned thing, a part that has gone | `color`, `opacity` (0.35) |

A material goes inside a `Box` (or any `<mesh>`) as its child.

`Room` props: `pos` (centre of its base; default the origin), `shape` `{ w, h, d, k, opening: { w, h, y } }` (outer size,
wall thickness; the opening is in the wall that faces +z, `y` its lower edge: 0 for a door), `wall`, `inside` (the inner
faces), `floor`, `edge` (outer edges and the roof ring), `line` (the floor's inner edges), `beam` (outer edge
thickness; 0 draws none but the roof ring), `roof` (roof ring thickness), `openingEdge`, `lid` (1 on, 0 off: the roof
rises half a unit and fades as it goes), `seam` (the roof ring's colour), `glow` `{ color, k }` (the roof pane's
light), `shadow`. The opening is closed by a pane in the floor's tone, so it reads as a door or a slot, and it glows
with a lit room.

```tsx
// videos/_kit_shapes/scenes/Shed.tsx; places in the spec: "shed": { "pos": [0, 0, -1], "size": [2.4, 2.0, 2.0] }, ...
const base = (p: Place): Vec3 => [p.pos[0], p.pos[1], p.pos[2] ?? 0];
const size = (p: Place): Vec3 => [p.size?.[0] ?? 1, p.size?.[1] ?? 1, p.size?.[2] ?? 1];
<Stage v={v} rect={[0, 180, 1920, 900]}>
  <Room pos={base(shed)} shape={{ w: sw, h: sh, d: sd, k: 0.1, opening: { w: 0.8, h: 1.5, y: 0 } }} shadow
    wall={wood} inside={mixColour(wood, paint(th, 'bg'), 0.5)} floor={mixColour(paint(th, 'surface'), wood, 0.25)}
    edge="ink" line="line" beam={0.03} roof={0.05} lid={w.num('lid')} glow={{ color: 'yellow', k: lamp * 0.4 }} />
  <Slab start={[0, 0, base(shed)[2] + sd / 2 + 0.05]} len={size(w.places.path)[2]} w={0.7} k={0.03} shown={w.num('path')}
    parts={words.stones.map((c, i) => ({ color: c, share: i % 2 ? 1 : 1.4 }))} />
  <Box pos={base(w.places.planter)} size={size(w.places.planter)} color="green" shadow />
  <Edges pos={base(w.places.planter)} size={size(w.places.planter)} color="ink" k={0.025} />
  <Box pos={base(w.places.lamp)} size={size(w.places.lamp)} color="yellow">
    <Glow color={mixColour(paint(th, 'surface'), paint(th, 'yellow'), 0.3 + 0.7 * lamp)} glow="yellow" k={lamp} />
  </Box>
  <Box pos={base(w.places.bin)} size={size(w.places.bin)} color="green">
    <Ghost color="green" opacity={0.3} />
  </Box>
</Stage>
```

The spec drives it: tracks `"lid": 1, "path": 0, "lamp": 0`, and `set` entries on the spoken words
(`{ "key": "lid", "to": 0, "cue": "roof lifts", "over": 1.2 }`), with a shot that looks in from above on the same cue
(`"el": 58`). Check with `--still` at the start of a 3D scene (the strip tool's 3D fault, docs/backlog.md) and one
still after each change of state.

## Not built

The contract (docs/v0.3-architecture.md 6.7) also names `Ball`, `Cyl`, `Cone`, `Capsule`, `Lathe`, `Extrude`,
`Prisms`, `Arrow3`, `FaceText`, a 3D `Appear`, `gridPositions`, shapes that read focus by `id`, and the materials
`Metal` and `Glass`. No video has needed them yet. The plain way meanwhile is a raw mesh inside the Stage, its
`position` the centre, with a kit material as its child:

```tsx
<mesh position={[x, y + h / 2, z]}>
  <cylinderGeometry args={[r, r, h, 48]} />
  <Matte color="blue" />
</mesh>
```

- a ball: `<sphereGeometry args={[r, 48, 32]} />` at `[x, y + r, z]`; a cone: `<coneGeometry args={[r, h, 48]} />`;
- an appearance: grow `scale` or move `position` from a track (`prog`, `tween`), never fade by opacity for focus;
- metal or glass: `<meshStandardMaterial color={paint(th, ref)} metalness={0.8} roughness={0.3} />` or
  `<meshPhysicalMaterial transmission={0.9} roughness={0.1} />` (they read darker than Matte under the studio light);
- a row or ring of things: positions from the index (`i * gap`, `Math.cos(2 * Math.PI * i / n)`), never randomness;
- text on a face: a `Label` in the stage's overlay, or labels given as data in the spec (core.md section 6).

When a second video needs one of these, build it in src/kit/shapes.tsx or materials.tsx with a demo and add it here.
