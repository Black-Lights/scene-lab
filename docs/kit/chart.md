# Kit chart: Bars

For a session writing scene code that shows a ranking or a share. Read docs/kit/core.md first. Import from `'@kit'`.
The excerpt is copied from `videos/_kit_blocks/scenes/Sales.tsx` (theme `plate`, scene 3), which renders; `s` is
`words.sales` of its `videos/_kit_blocks/data/bakery.json`, `at` its beats.

## What is built

`Bars` is one chart: a ranked column. One row per rank: the rank number, a box with the row's label in the data face
(every box has one width, so the column reads as a chart) and, where a value was measured, a bar with the value at its
end, drawn against the largest value. Without values it is ranks and boxes, and nothing that would read as a height.
On top of that it can:

- arrive row by row (`at`) and leave (`leaveAt`: every part goes back to the ground);
- ring one row (`picked`, `pickedAt`): the ring draws round the box and the rank takes the pick colour;
- take rows out (`masked` rows, `maskAt`): each loses its fill top to bottom and keeps the same box in the quiet mask
  tone; its bar shrinks to nothing and its value to 0. With `dropAt` the mask first comes down behind the whole column
  as a slab with its name (`maskLabel`) and the rows drop later.

Use it for "which candidates, in what order, and which one won": the next token of a model, the votes of a poll, the
loaves sold in a week, the routes a planner considered. For a quantity over time, an axis or a cursor, see "Not built".

## Props

| Prop (default) | Meaning |
|---|---|
| `x, y` | top-left corner of the FIRST BOX; the ranks stand left of it (`barsLayout().left` px) and the names above it |
| `w` | from x to the right end of the bars (used only when a row has a value) |
| `rows` | `[{ rank, label, value?, masked? }]`; `rank` also names the row for `picked` |
| `label`, `labelDx` (0) | the chart's name above the column, moved right by `labelDx` (to clear a leader line) |
| `colW` | the least width of a box (default: as wide as the widest label asks) |
| `rowH` (`BARS_ROW` 46), `gap` (`BARS_GAP` 12) | row height and the gap between rows |
| `picked`, `pickedAt` | the rank that is ringed, and when the ring draws (default from the start) |
| `maskAt`, `dropAt`, `maskLabel`, `goneAt` | the mask (see above); `goneAt` steps the masked ranks back (default just after the drop) |
| `tag` | a quiet Tag: beside the last box, or, when rows have bars, under the chart at the bars' right end |
| `at`, `leaveAt`, `dim`, `t`, `pace` (1) | arrival, departure, focus, scene time, durations |
| `color` ('a'), `onColor` | box and bar fill; the label on it (default whichever of ink and ground reads best) |
| `edge` | the box outline (default the fill itself: no visible outline) |
| `pickColor` ('a'), `ringColor` ('ink'), `ringApart` (true) | the picked rank's ink; apart: a ring in `ringColor` stands off the box by a slit at the base stroke, else a `heavy` ring in `pickColor` lies on its edge |
| `maskColor` ('line'), `onMask` ('back'), `heavy` (1.5 x stroke) | the mask's tone, the label on it, the ring's heavy stroke |

`barsLayout(rows, chW, stroke, { rowH?, gap?, colW?, labels? })` and `useBarsLayout(rows, parts)` give
`{ colW, h, rowH, rows: [{ rank, y }], left, above }`: `left` is how far the ranks reach left of x, `above` how far the
names reach above y (`labels`: how many name lines, 0 to 2). Use them to place the chart so nothing leaves the frame.

```tsx
// videos/_kit_blocks/scenes/Sales.tsx
const CHART = { x: 170, y: 380, w: 760 };
const rows: BarRow[] = s.rows;              // [{ "rank": 1, "label": "sourdough", "value": 0.38 }, ...]
const lay = useBarsLayout(rows, { labels: 2 });
<Bars x={CHART.x + lay.left} y={CHART.y} w={CHART.w - lay.left} label={s.label} rows={rows} tag={s.tag} t={t}
  at={at.sat} picked={1} pickedAt={at.best} maskAt={at.out} maskLabel={s.mask} />
```

## Not built

The contract (docs/v0.3-architecture.md 6.7) also names `scale.linear | log | band`, `Axes`, `Series` (a line that
draws up to a time), `Rule`, `Band`, `Cursor` and `Marker`. No video has needed them yet, so they do not exist. The
plain way meanwhile, in one SVG inside the scene:

- a scale is one line of arithmetic: `const sx = (v: number) => x0 + ((v - lo) / (hi - lo)) * w;`
- a line that draws up to a time: the points of the series in an SVG `<polyline>`, cut at the share
  `prog(t, at, over, 'move')` of its length (`pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p}`), as
  `Brace` does in parts2d;
- axes and ticks: `<line>`s in `paint(th, 'line')` with `Text` labels (never under 28 px);
- a cursor: a `<line>` whose x is `tween(t, ...)` of the data value.

When a second video needs one of these, build it in src/kit/chart.tsx with a demo and add it here (F-014).
