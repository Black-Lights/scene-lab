# Kit blocks: the larger 2D blocks

For a session writing scene code. Read docs/kit/core.md first, and docs/kit/parts.md for the small parts these blocks are
built from (Sheet, Chip, Tag, Brace, Stamp...). Import everything from `'@kit'`. Every excerpt is copied from
`videos/_kit_blocks` (theme `plate`, 37 s, three scenes: a week in a bakery), which renders; `words` is its
`videos/_kit_blocks/data/bakery.json`. Each block was first drawn for an earlier video and then made topic-free.

## Rules every block follows

The rules of parts.md hold: layout pixels, colour references with token defaults, `t` is `useClock()`, `at` is scene
seconds and `Infinity` never, `dim` 1 in focus and 0.3 stepped back, `pace` multiplies durations, type never under 28 px.
Besides:

- A block is a Sheet with a name tab: its `y` is the sheet's top edge; the tab reaches `SHEET_TAB` (46) px above it.
- Style props (`fill`, `edge`, `litColor`, ...) default to the theme, so a block wears the video's design with none
  given; set them only to restyle a block for a topic.
- Each block has a layout function (pure, for a fixed char width) and a hook (measured with the video's data face).
  Use the hook to place things beside a line or a row, never guess pixel heights.
- A lit line or span steps the others back; a lit band is the theme's `lit` tone, else the fill a little toward ink.
- Text is real text from data; a block wraps it (at spaces, keeping an indent) but never shrinks it.

| Block | Use it for | Layout helper |
|---|---|---|
| `CodeBlock` | a file whose lines appear, light up, arrive, leave: code, a recipe, a config, a contract | `useCodeBlockLayout`, `codeBlockLayout(input, chW, stroke)`, `CODE_LINE` 44, `CODE_MAX` 12 |
| `Ledger` | a list that grows: messages, orders, events, steps, a log | `useLedgerLayout`, `ledgerLayout(rows, w, chW, stroke, gap, count?)`, `ledgerNeed`, `ROW_LINE` 38, `ROW_PAD` 14 |
| `LedgerSlip` | one ledger row on its own small sheet: a row that travels | (as Ledger) |
| `Lanes` | who does what over time: actors as lanes, messages and hand-overs as arrows | `lanesLayout(input)`, `LANE_HEAD` 64, `LANE_W` 280, `LANE_BOX_H` 56, `STEP_W` 64, `STEP_H` 44 |
| `PhraseCard` | one short statement on a card: a rule, a myth, a question, a defect; struck or stamped | `usePhraseCardLayout`, `phraseCardLayout(input, th, measure)`, `CARD_W` 440, `CARD_HEAD` 58 |
| `OutputPane` | what a program printed, a terminal, a till receipt, written character by character | `usePaneLayout`, `paneLayout(input, chW)`, `PANE_LINE` 44 |

The ranked bar chart (`Bars`) has its own page: docs/kit/chart.md.

## CodeBlock

Props: `x, y, w`, `name` (the tab), `lines` (at most 12: show the part that matters), `first` (number of the first
line, 1), `lit`, `arrive`, `leave` (line numbers) with `at` and `until` (records by line: when it lights, arrives or
is struck; when its light steps back), `again` (more lit spans per line), `marks` `[{ line, text, at?, nth? }]` (a word
underlined in `markColor`, default 'a'), `lineTags` `[{ line, text, at? }]` (a quiet note at the row's right end),
`grows` `[{ line, text, at }]` (part of a line written later: until `at` the line stands closed up without it),
`appearAt`, `tag`, `dim`, `t`, `fill`, `edge`, `litColor`, `strongLit` (the number of a lit line turns bold), `pace`.
An arriving line opens its row (the lines below move down and renumber), is lit, and keeps a `+` in the gutter; a
leaving line is struck and keeps a `-`. A long line wraps after a space, comma or `(`, with a hanging indent.
`useCodeBlockLayout({ y, w, lines, first })` gives `{ h, cols, codeX, rows, lineY(n) }` (`lineY`: the middle of line n,
with every line arrived).

```tsx
// videos/_kit_blocks/scenes/Orders.tsx
const FILE = { x: 1090, y: 300, w: 720 };
<CodeBlock x={FILE.x} y={FILE.y} w={FILE.w} name={r.name} lines={r.lines} tag={r.tag} t={t}
  lit={[1, 4]} at={{ 1: flour, 4: starter, 5: fold }} until={{ 1: starter, 4: fold }} arrive={[5]}
  marks={[{ line: 4, text: r.mark, at: starter }]} />
```

## Ledger and LedgerSlip

A row (`LedgerRow`): `id`, `label` (the word on its chip: who or what), `text` (wrapped; empty for a row of items
only), `items` `[{ text, sub? }]` (chips under the text, in one line: give the ledger room with `ledgerNeed`), `ref`
(a quieter id or time before the text, on its own line when both do not fit), `color` (the chip is solid in it and the
body is it washed into the sheet), `fill` (the body exactly, instead of the wash), `chip` (a `ChipStyle`: the Chip props
other than text and place, for this row), `hatch` (diagonal lines over the body: it came from outside), `at` (it arrives
then, and the sheet grows by it).

Ledger props: `x, y, w`, `name`, `rows`, `count` and `unit` (a running number at the foot), `spans`
`[{ from, to, at }]` (square brackets at the right edge over rows, by id; `spanColor` 'ink', `spanStroke`), `dim`, `t`,
`fill`, `edge`, `wash` (0.25), `gap` (stroke / 2) and `rule` ('line') between rows, `chipStyle` and `itemStyle`
(ChipStyle of all chips and of item chips), `hatch` (a HatchLook), `pace`. `LedgerSlip`: `x, y, w, row, dim` and the
same style props; it is one row on a sheet as tall as the row (about 78 px for one line).
`useLedgerLayout(rows, w, { gap?, count? })` gives `{ h, chipW, textX, textW, rows: [{ id, y, h, lines, refInline,
refX, refW }] }`, with every row arrived.

```tsx
// videos/_kit_blocks/scenes/Orders.tsx; a row in bakery.json:
// { "id": "wed", "label": "Wed", "text": "Wedding cake, by phone", "color": "orange", "ref": "#31", "hatch": true }
const rows: LedgerRow[] = o.rows.map((r, i) => ({ ...r, at: [mon, tue, wed][i] }));
const count = t < mon ? 0 : t < tue ? o.counts[0] : t < wed ? o.counts[1] : o.counts[2];
<Ledger x={LIST.x} y={LIST.y} w={LIST.w} name={o.name} rows={rows} count={count} unit={o.unit} t={t}
  spans={[{ from: 'mon', to: 'tue', at: wed }]} />
```

## Lanes

`lanes` `[{ id, name, boxes?, color? }]` from left to right (a `color` picks a lane out: its head's outline and its
lifeline). `arrows` `[{ id, from, to, at, label?, color?, carry?, carryH?, row? }]` in time order: `from === to` is a
step, a loop on that lane with its label beside it; `carry` is an element in normal flow (a Chip without x and y, a box
with its own width and height) or a function of the arrow's dim, sliding out of the sender's lifeline to rest on the
middle of the line; give `carryH` when it is taller than a chip. A lane box `{ id, name, edge, on? }` sits astride its
lane's edge that faces lane `edge`: at the top, or on the line of each arrow named in `on` (the arrow passes behind
it; it arrives and steps back with the arrow). Props: `x, y, w, h`, `laneW` (280), `focus` ('latest': an arrow steps
back when a later one starts; 'all'; or a list of ids), `t`, `band` (theme's lane tone), `lifeline` ('line'),
`headFill`, `headEdge`, `litColor`, `lightActive` (true: a sending lane's lifeline turns ink and its head lit), `heavy`
(1.5 x stroke: lifelines and arrows), `pace`. Rows share the height `h` in proportion (a step or a carry 100, a plain
arrow 84), so more arrows means closer rows. `lanesLayout(props)` gives `{ laneX, side, arrowY, mid, box, top, bottom }`.

Spacing: the lanes stand spread over `w`, so lifelines are `(w - laneW) / (n - 1)` apart. A carried thing rests half
way between two lifelines and a lane box half a lane from its lifeline: keep the gap at 500 px or more when both stand
on one arrow (the demo's first try, 430 px, put the chip on the box).

```tsx
// videos/_kit_blocks/scenes/Shop.tsx
const LANES = { x: 110, y: 270, w: 1240, h: 560, laneW: 220 };
const arrows: LaneArrow[] = [
  { id: 'shape', from: 'baker', to: 'baker', at: at.shape, label: s.labels.shape },
  { id: 'trays', from: 'baker', to: 'shop', at: at.trays, label: s.labels.trays, carryH: SLIP_H,
    carry: (dim: number) => <div style={{ position: 'relative', width: SLIP_W, height: SLIP_H }}><LedgerSlip x={0} y={0} w={SLIP_W} row={s.tray} dim={dim} /></div> },
  { id: 'ask', from: 'customer', to: 'shop', at: at.ask, label: s.labels.ask },
  { id: 'hand', from: 'shop', to: 'customer', at: at.hand, label: s.labels.hand, color: 'a',
    carry: (dim: number) => <Chip text={s.loaf} color="brown" solid dim={dim} /> },
];
<Lanes {...LANES} lanes={s.lanes} arrows={arrows} t={t} />
// bakery.json: { "id": "shop", "name": "shop", "boxes": [{ "id": "till", "name": "till", "edge": "customer", "on": ["ask", "hand"] }] }
```

## PhraseCard

Props: `x, y`, `w` (440), `head` (the word: Rule, Myth, Question), `n` (a number after it), `phrase` (display face;
two lines at most: a longer phrase steps down 4 px twice unless `fit` is false or `size` is given), `size` (44),
`struckAt` (struck line by line), `stamp` `{ text, at }` (lands on the foot), `stampRoom` (a foot kept free: default
when `stamp` is given; give it to cards of one set so they share a height), `underline` `{ text, at? }`, `at`, `dim`,
`t`, `fill`, `edge`, `rule` (the line under the head), `ink` (underline and strike), `bare` (no rule: the word stands
on the card), `stampStyle` (Stamp props: color, tilt, double, stroke, radius), `pace`. Cards of one set differ by their
word and what happens to them, never by a colour. `usePhraseCardLayout({ w, phrase, size, fit, stampRoom, stamp })`
gives `{ w, h, lines, phraseY, lineH, size }`.

```tsx
// videos/_kit_blocks/scenes/Shop.tsx and Sales.tsx
<PhraseCard x={CARD.x} y={CARD.y} w={CARD.w} head={s.rule.head} n={s.rule.n} phrase={s.rule.phrase} at={at.trays}
  stamp={{ text: s.rule.stamp, at: at.rule }} t={t} />
<PhraseCard x={CARD.x} y={CARD.y} w={CARD.w} head={s.myth.head} phrase={s.myth.phrase} at={at.sat}
  underline={{ text: s.myth.underline, at: at.out }} struckAt={at.wrong} t={t} />
```

## OutputPane

Props: `x, y, w`, `name`, `text` (none: one empty line and a caret that stays), `rows` (the least rows, so an empty pane
has the room of the text to come), `at` (the pane arrives), `writeAt` and `writeOver` (1.2 s: written character by
character with a caret at its end), `caretAt`, `spans` `[{ text, at, until? }]` (words of the text that take the lit
band; the rest steps back; a span never breaks across rows; the same text twice lights twice), `tag`, `tagAt`, `dim`,
`t`, `fill`, `edge`, `litColor`, `caretColor` ('ink2'), `pace`. `usePaneLayout({ x, y, w, text, rows, spans })` gives
`{ h, lineH, textX, cols, lines, spanBox(text) }`: `spanBox` is the frame box of a span, for a copy that leaves the pane.

```tsx
// videos/_kit_blocks/scenes/Sales.tsx
<OutputPane x={PANE.x} y={PANE.y} w={PANE.w} name={s.till.name} text={s.till.text} rows={2} at={at.till} writeAt={at.till} t={t}
  spans={[{ text: s.till.span, at: at.total }]} />
```

Check a scene with `--strip N` for timing and one full-size `--still N@t` for spacing: in a strip a chip that touches a
box is easy to miss.
