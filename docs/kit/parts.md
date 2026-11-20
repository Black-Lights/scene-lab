# Kit parts: the 2D set

For a session writing scene code. Read docs/kit/core.md first; this page adds the drawn 2D parts. Import all of it
from `'@kit'`. Every excerpt is copied from `videos/_kit_parts/scenes/Packing.tsx` (theme `plate`, 27 s, two scenes of
one picture), which renders. `words` is its `videos/_kit_parts/data/packing.json`; its layout constants are `CARD = { x: 110, y: 290,
w: 560 }`, `COL = 780`, `CASE = { x: 780, y: 500, w: 1030, h: 120 }`, `BAR = { x: 780, y: 700, w: 1030, h: 80 }`,
`GAP = 14`.

## Rules every part follows

- Positions are layout pixels (board units on a Board). A part is `position: absolute` at its own `x, y`; inside a
  `Sheet` it counts from the sheet's top-left corner. Which point `x, y` names is given per part.
- A colour prop is a colour reference (core.md section 7): hex, paint, role or token. Defaults are tokens, so a part
  wears the video's design with no colour given. `stroke` defaults to `th.stroke`, `radius` to `th.radius`.
- `t` is `useClock()`. `at` is scene seconds (a beat). A part with `at` is not drawn before it, and arrives by its
  colour leaving the ground or by drawing on; nothing scales or bounces. `Infinity` means never.
- `dim`: 1 in focus, 0.3 stepped back (`w.dim(id)`): colours mix toward the ground, text toward the `back` ink.
- `pace` (default 1) multiplies every duration of a part: 1.3 for a design that moves slower.
- Type is never under 28 px (`MIN_TYPE`); a smaller `size` is raised to it.

## Time helpers

| Helper | What it gives |
|---|---|
| `useBeatTimes(done?)` | `at(name)`: a beat of this scene in seconds, `PAST` (-1e6) for a name listed in `done`, otherwise `Infinity`. For one picture drawn by several scenes: each declares only its own beats and lists the earlier ones in `props.done`, so it opens on the picture the last one ended on |
| `continuesPicture(done)` | true when `done` is not empty: draw the title settled |
| `highlight(t, at?, until?, again?, pace?)` | 0..1: lit from `at` (in 0.25 s) until `until` (back in 0.7 s); `again` is a list of further `[at, until]` spans. Feed it to a `lit` prop |

```tsx
// spec, scene 2: "cut": "none", "props": { "done": ["first", "boots", "borrowed", "rain", "off"] }
const done = ((v.props ?? {}) as { done?: string[] }).done ?? [];
const at = useBeatTimes(done);
<SceneTitle text={v.title} t={continuesPicture(done) ? 1e3 : t} />
<Chip x={x0} y={chipY} text={c.clothes} color="blue" solid lit={highlight(t, at('first'), at('borrowed'))} />
```

## The parts

| Part | Use it for | Props (default) |
|---|---|---|
| `FadeIn` | a group that arrives at a time (0.25 s, rising a few px) | `at` (none: always there), `t`, `rise` (6), `pace`; children keep their own coordinates |
| `Sheet` | a panel, a card, a file, a box that holds parts | `x, y` top-left, `w, h`, `fill` (surface), `edge` (line), `name` (a tab, its top `SHEET_TAB` = 46 px above y), `ink` (of the name), `dash` ("10 7"), `cap`, `hollow`, `pile`, `stroke`, `radius` (at most 16), `dim`, children |
| `Chip` | a short code, a field, an item, in the data face | `text`, `sub` (quieter, after it), `x, y` top-left (none: inline), `size` (28; height `CHIP_H` = 46 at 28), `w` (none: fits the text), `color` (surface), `solid` (the chip is its colour; else an outline chip), `ink`, `edge`, `lit` 0..1 (heavier edge; `litFill`, `litEdge`), `hatch` (true or a HatchLook), `stroke`, `heavy`, `radius`, `dim` |
| `Text` | a label or a short paragraph in the text face | `x, y` top, `text` (newline breaks), `size` (s, m, l), `color` (ink), `anchor` (start, middle, end), `w` (wraps at spaces to this width), `shown` 0..1, `strong`, `dim`. Line height 1.15 x size |
| `Tag` | a quiet note: a source, "illustrative", a status | `x, y` = its LOWER RIGHT corner, `text`, `color` (back), `shown`, `dim`. Set in the data face, as a file name or a status is; a name in words is a `Text` |
| `Badge` | a number or short code on a pill, 42 px high | `x, y` centre, `text`, `color` (the theme's lane tone, else surface), `lit` (inverted), `radius`, `dim` |
| `Circled` | a letter or digit in a ring, a cross-reference | `x, y` centre, `text`, `lit` (true/false or 0..1: fills), `on` (surface: what it stands on), `size` (46), `stroke`, `dim` |
| `TickCross` | "it passed, and it is wrong": a hollow tick beside a cross | `x, y` top-left, `size` (height; width 2.3 x size), `on` (ground: fills the tick's hollow), `color`, `stroke`, `dim` |
| `Brace` | marks a span of things, with a label beyond it | `x, y` start of the span on the thing's edge, `len`, `side` (top, bottom, left, right), `shape` (curly, square), `label`, `at`, `t`, `arm` (16), `color`, `stroke`, `dim`, `pace`. Draws on in 0.7 s |
| `Arrow2` | from one thing to another, drawing on | `from`, `to` ([x, y]), `at`, `t`, `elbow` (hv: level first, vh: upright first), `head` (true), `dashed`, `dash`, `over` (0.9 s), `color`, `stroke`, `dim`, `pace` |
| `Strike` | crosses a word out, left to right | `x, y` left end, `len`, `at`, `t`, `color`, `stroke`, `dim`, `pace` |
| `Stamp` | a verdict that lands: CLOSED, PAID | `x, y` centre, `text`, `at`, `t`, `color` (warn), `tilt` (-4 degrees), `double` (true), `stroke`, `radius`, `pace`. No ground of its own: put it on empty ground |
| `Countdown` | a ring that empties clockwise: a pause, a timer | `x, y` centre, `at`, `over` (seconds to empty), `t`, `mark` (text in the ring), `until`, `r` (50), `color`, `stroke`, `pace` |
| `HatchedRect` | a box marked "from outside", "borrowed", "estimated" | `x, y, w, h`, `color` (the fill under the lines), `radius` (0), `strength` (1; lower is quieter), `hatch` (a HatchLook), `dim` |
| `Hatch` | the lines alone, filling their positioned parent | `fill` (the colour under them), `strength`, `look`: HatchLook `{ pitch: 12, width: 2, angle: 45, line: (fill) => colour }` (default line: half way to whichever of ink and ground stands out) |
| `TextCard` | real text (a file, a list, a command) whose lines light on spoken words | below |
| `CapacityBar` | parts of a fixed total at true scale: a case's litres, a disk, a day | below |

## The list: TextCard, Brace, Strike, Arrow2

`TextCard`: `x, y, w`, `name` (the tab), `lines`, `size` (28), `h`, `lit` (line numbers from 1) with `at`, `until`,
`again` (records by line), `quiet` (back ink until first lit), `backAt` (steps back for good), `markers`
`[{ line, span?: [first, last], letter, at, litAt?, litUntil? }]` (a Circled at the line's end; `span` adds a square
bracket), `foot`, `footAt`, `tag`, `closedUntil` (outline and tab only before it), `appearAt`, `fill`, `edge`,
`litColor` (the band of a lit line), `ink` (the text's ink: name one for a light card on a dark ground), `dim`, `t`,
`pace`. A lit line steps the other lines back. Long lines wrap and keep their indent. `useTextCardLayout({ y, w,
lines, size?, h?, foot? })` gives `{ h, lineH, textX, cols, lineY(n), lineW(n) }` to place things beside a line:
`lineY` is the middle of line n in the parent's units, `textX` counts from the card's left edge, `lineW` is the
line's width in px:

```tsx
const card = useTextCardLayout({ y: CARD.y, w: CARD.w, lines: list.lines, foot: list.foot });
const braceX = CARD.x + card.textX + Math.max(card.lineW(1), card.lineW(2)) + GAP;
<TextCard x={CARD.x} y={CARD.y} w={CARD.w} name={list.name} lines={list.lines} foot={list.foot} tag={list.tag} t={t}
  lit={[1, 2, 4]} at={{ 1: at('first'), 2: at('boots'), 4: at('borrowed') }}
  until={{ 1: at('borrowed'), 2: at('borrowed'), 4: at('rain') }} backAt={{ 5: at('off') }}
  markers={[{ line: 4, letter: words.marker, at: at('borrowed'), litAt: at('borrowed'), litUntil: at('rain') }]} />
<Brace x={braceX} y={card.lineY(1) - card.lineH / 2 + 4} len={2 * card.lineH - 8} side="right" label={words.first}
  at={at('first')} t={t} />
<Strike x={CARD.x + card.textX - 6} y={card.lineY(5) + 1} len={card.lineW(5) + 12} at={at('off')} t={t} />
<Arrow2 from={[CARD.x + CARD.w + 10, card.lineY(2)]} to={[COL - 10, CASE.y + CASE.h / 2]} at={at('first')} t={t} />
```

## Labels, a badge, a timer, the hatch on your own SVG

```tsx
const blue = paint(th, 'blue');
const rainId = hatchId(blue, { pitch: 10 });
<Text x={COL} y={270} w={600} size="m" text={words.note} shown={prog(t, at('rain'), 0.5)} />
<Tag x={COL + 600} y={412} text={words.source} shown={prog(t, at('rain'), 0.5)} />
<FadeIn at={at('rain')} t={t}>
  <svg width={100} height={100} style={{ position: 'absolute', left: 1430, top: 266 }}>
    <HatchDefs id={rainId} color={blue} pitch={10} />
    <circle cx={50} cy={50} r={44} fill={hatchFill(rainId)} stroke={blue} strokeWidth={th.stroke} />
  </svg>
</FadeIn>
<Badge x={1625} y={300} text={words.nights.n} />
<Text x={1660} y={282} text={words.nights.word} color="ink2" />
<Countdown x={1745} y={395} at={at('taxi')} over={10} t={t} />
```

`hatchId(colour, look?)` names a pattern (equal ids hold equal patterns, so repeats are safe), `HatchDefs` defines
it inside an `<svg>`, `hatchFill(id)` is the `fill`. Text over a hatch takes `knockOut(fill)`, a ring of the fill
colour round every glyph:

```tsx
<HatchedRect x={1600} y={458} w={210} h={38} color="surface" radius={th.radius} />
<div style={{ position: 'absolute', left: 1600, top: 458, width: 210, height: 38, display: 'flex', alignItems: 'center',
  justifyContent: 'center', ...textStyle(th, 's'), lineHeight: 1, ...knockOut(surface) }}>
  {words.legend}
</div>
```

## A sheet of chips, measured in characters

A chip with no `w` is as wide as its text plus `2 * round(size / 2)` padding and two strokes; in the data face the
text is `text.length * useCharWidth(size)` wide. A lit chip's edge grows to `heavy`, so give `w` when neighbours
must not move by those pixels.

```tsx
const chW = useCharWidth();
const chipW = (text: string) => text.length * chW + 2 * 14 + 2 * th.stroke;
const chipY = (CASE.h - CHIP_H) / 2;
<Sheet x={CASE.x} y={CASE.y} w={CASE.w} h={CASE.h} name={words.case}>
  <FadeIn at={at('borrowed')} t={t}>
    <Chip x={x2} y={chipY} text={c.umbrella} hatch />
    <Circled x={ringX} y={CASE.h / 2} text={words.marker} lit={highlight(t, at('borrowed'), at('rain'))} />
  </FadeIn>
  <FadeIn at={at('passport')} t={t}>
    <Chip x={x3} y={chipY} text={c.passport} ink="red" edge="red" />
  </FadeIn>
  <FadeIn at={at('expired')} t={t}>
    <TickCross x={tickX} y={(CASE.h - 32) / 2} size={32} on="surface" />
    <Text x={tickX + 32 * 2.3 + GAP} y={CASE.h / 2 - 35} text={wrapText(words.expired, 12).join('\n')} />
  </FadeIn>
</Sheet>
```

## The capacity bar, a label inside it, a stamp

`CapacityBar`: `x, y, w`, `h` (`CAPACITY_H` = 120), `total`, `number` (the total as written), `note` (under the
number), `parts` `[{ id, color, size }]` from the left (never under 3 px wide), `callout` `{ x, y, w }` (the lower
edge of a larger drawing of the first part: two lines join it to the part), `at`, `numberAt`, `stroke`, `heavy`
(the outline), `dim`, `t`, `pace`. `capacityBarLayout(input, stroke, heavy?)` gives `{ outline, parts: [{ id, x, w
}], lineY, numberY, noteY, h }`; with a `note` the whole is `h + 22 + 54 + 10 + 35` px tall.

```tsx
const onBlue = contrast(paint(th, 'ink'), blue) >= contrast(paint(th, 'bg'), blue) ? 'ink' : 'bg';
const first = capacityBarLayout({ ...BAR, total: words.bar.total, parts: words.bar.parts }, th.stroke).parts[0];
<CapacityBar x={BAR.x} y={BAR.y} w={BAR.w} h={BAR.h} total={words.bar.total} number={words.bar.number} parts={words.bar.parts}
  callout={{ x: CASE.x + x0, y: CASE.y + chipY + CHIP_H, w: chipW(c.clothes) }} at={at('case')} numberAt={at('case')} t={t} />
<Text x={first.x + first.w / 2} y={BAR.y + BAR.h / 2 - 17} anchor="middle"
  text={words.bar.first} color={onBlue} shown={prog(t, at('litres'), 0.3)} />
<Stamp x={BAR.x + BAR.w - 150} y={BAR.y + BAR.h / 2} text={words.stamp} at={at('closed')} t={t} />
```

## Measuring

| Helper | What it gives |
|---|---|
| `useCharWidth(size?)` | the advance of one character of the data face (28 px default), for columns of code |
| `wrapText(text, cols)` | lines of at most `cols` characters, broken at spaces |
| `wrapToWidth(measure, text, style, w)` | lines no wider than `w` px in a style, measured (`measure = useTextSize()`); `Text` with `w` uses it |
| `contrast(a, b)` | the WCAG ratio of two hex colours: 4.5 for small text, 3 for large text and lines |
| `SHEET_TAB`, `CHIP_H`, `CAPACITY_H`, `CAPACITY_NUMBER` | 46, 46, 120, 54 px |

Check a scene that uses these with `--strip N` and one full-size `--still N@t`: a strip is too small to judge
whether a label touches an edge (the demo's "packed, but" did at first).
