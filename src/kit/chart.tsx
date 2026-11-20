/**
 * @file kit/chart.tsx
 * @description Charts drawn from data (work package A2, architecture section 6.7). What is built: Bars, a ranked
 *   column of candidates. One row per rank: the rank number, a box with the row's label in the data face (all boxes
 *   share one width, so the column reads as a chart) and, where a value was measured, a bar with the value at its end;
 *   without values the chart is ranks and boxes, and nothing is drawn that would look like a height. One row can be
 *   picked: a ring draws round its box and its rank takes the pick colour. A mask can take rows out (`maskAt`): each
 *   masked row loses its fill top to bottom and keeps the very same box in the quiet mask tone; with `dropAt` the mask
 *   first comes down behind the column as a slab with its name, and the rows drop later. The chart can arrive row by
 *   row (`at`) and leave (`leaveAt`: every part returns to the ground). (x, y) is the top-left corner of the first box;
 *   barsLayout() says how far the ranks and the names above reach.
 *   Not built yet (no video has needed them): scale.linear, scale.log, scale.band, Axes, Series, Rule, Band, Cursor,
 *   Marker. Lifted from an earlier video's scene code, topic-free. A pure function of its props, the theme
 *   and `t`.
 */
import React from 'react';
import { DUR } from '../motion';
import { useTheme } from '../theme';
import { inkAt, strongOf, toward } from './ink';
import { contrast, paint } from './paint';
import { Tag, Text } from './parts2d';
import { mix, mixColour, prog } from './time';
import { MIN_TYPE, dataStyle, useCharWidth, useTextSize } from './type';

export type BarRow = {
  /** The rank, drawn left of the box; it also names the row for `picked`. */
  rank: number;
  /** The label in the box (keep its leading space when it has one: letters are shown one by one, no ligatures). */
  label: string;
  /** A measured value, 0..1 or any scale (bars are drawn against the largest). Without it the row has no bar. */
  value?: number;
  /** Taken out by the mask. */
  masked?: boolean;
};

export type BarsProps = {
  /** Top-left corner of the first box. */
  x: number; y: number;
  /** From x to the right end of the bars. Only used when a row has a value. */
  w: number;
  /** The name of the chart, above the column. */
  label?: string;
  /** How far right of x the two names start (to clear a leader that comes down to the first box). */
  labelDx?: number;
  /** The least width of a box; default as wide as the widest label asks for. */
  colW?: number;
  rows: BarRow[];
  /** Height of a row and the gap between two rows; defaults BARS_ROW and BARS_GAP. */
  rowH?: number;
  gap?: number;
  /** The rank of the picked row, and when its ring is drawn (default from the start). */
  picked?: number;
  pickedAt?: number;
  /** When the mask comes down; without it there is no mask. */
  maskAt?: number;
  /** When the masked rows lose their fill, if that is later than the mask: the mask then comes down at `maskAt` as a
   *  slab behind the column, and the rows drop at `dropAt`. Without it they drop at `maskAt`. */
  dropAt?: number;
  /** The name of the mask, on a second line above the column. */
  maskLabel?: string;
  /** When the ranks of the masked rows step back; default a little after the mask is down. */
  goneAt?: number;
  /** A Tag beside the last box, or, when rows have bars, under the chart at the bars' right end. */
  tag?: string;
  /** When the chart arrives, row by row; without it the chart is there from the start. */
  at?: number;
  /** When the chart leaves: every part of it returns to the ground tone. */
  leaveAt?: number;
  dim?: number;
  t: number;
  /** The fill of the boxes and bars (default 'a'), the text on them (default whichever of ink and ground reads best
   *  on the fill), and their outline (default the fill itself: no visible outline). */
  color?: string; onColor?: string; edge?: string;
  /** The picked row's rank and ring (default 'a'); `ringApart` sets the ring off the box by a slit in `ringColor`
   *  at the base stroke (default), else it lies on the box's edge at `heavy`. */
  pickColor?: string; ringColor?: string; ringApart?: boolean;
  /** The mask's tone (default 'line') and the text on it (default 'back'). */
  maskColor?: string; onMask?: string;
  /** The heavy stroke of a ring on the edge; default 1.5 x th.stroke. */
  heavy?: number;
  pace?: number;
};

export type BarsLayout = {
  /** Width of the box column (every box has one width) and height of all rows. */
  colW: number;
  h: number;
  rowH: number;
  /** Top of each row, from y. */
  rows: { rank: number; y: number }[];
  /** How far the ranks reach to the left of x, and the names above y. */
  left: number;
  above: number;
};

/** Height of a row and the gap between two rows, when the scene sets none. */
export const BARS_ROW = 46;
export const BARS_GAP = 12;

const BOX_PAD = 12;
const RANK_GAP = 14;
const LABEL_ROW = 40;
const LABEL_GAP = 10;
const TAG_GAP = 24;
/** From the last row to the lower edge of a tag that stands under the bars. */
const TAG_DROP = 46;
const SLIT = 4;
/** How far the slab of the mask reaches beyond the column. */
const SLAB = 8;

export type BarsParts = { rowH?: number; gap?: number; colW?: number; labels?: number };

/** The places of a chart, from the top-left corner of its first box. `chW` is useCharWidth(), `stroke` th.stroke;
 *  `labels` is the number of name lines above the column (0, 1 or 2). */
export function barsLayout(rows: BarRow[], chW: number, stroke: number, parts: BarsParts = {}): BarsLayout {
  const ch = chW;
  const rowH = parts.rowH ?? BARS_ROW;
  const gap = parts.gap ?? BARS_GAP;
  const colW = Math.max(parts.colW ?? 0, Math.max(2, ...rows.map((r) => r.label.length)) * ch + 2 * BOX_PAD + 2 * stroke);
  const h = rows.length * rowH + Math.max(0, rows.length - 1) * gap;
  const digits = Math.max(1, ...rows.map((r) => String(r.rank).length));
  return {
    colW,
    h,
    rowH,
    rows: rows.map((r, i) => ({ rank: r.rank, y: i * (rowH + gap) })),
    left: RANK_GAP + digits * ch,
    above: parts.labels ? LABEL_GAP + parts.labels * LABEL_ROW : 0,
  };
}

/** barsLayout measured with the video's data face. */
export function useBarsLayout(rows: BarRow[], parts: BarsParts = {}): BarsLayout {
  const th = useTheme();
  return barsLayout(rows, useCharWidth(), th.stroke, parts);
}

/** The ranked bars. */
export function Bars({ x, y, w, label, labelDx = 0, colW, rows, rowH, gap, picked, pickedAt, maskAt, dropAt, maskLabel, goneAt, tag, at, leaveAt,
  dim = 1, t, color = 'a', onColor, edge, pickColor = 'a', ringColor = 'ink', ringApart = true, maskColor = 'line', onMask: onMaskRef = 'back',
  heavy, pace = 1 }: BarsProps) {
  const th = useTheme();
  const chW = useCharWidth();
  const measure = useTextSize();
  const names = (label ? 1 : 0) + (maskLabel ? 1 : 0);
  const lay = barsLayout(rows, chW, th.stroke, { rowH, gap, colW, labels: names });
  const d = 0.4 + 0.6 * dim;
  const s = th.stroke;
  // Labels are shown letter by letter, without the ligatures of the data face.
  const data: React.CSSProperties = { ...dataStyle(th, MIN_TYPE), fontVariantLigatures: 'none' };
  const H = lay.rowH;
  const strong = strongOf(th);
  const micro = DUR.micro * pace;
  const enter = DUR.enter * pace;

  const stays = leaveAt === undefined ? 1 : 1 - prog(t, leaveAt, DUR.exit * pace, 'exit');
  const arrives = (i: number) => (at === undefined ? 1 : prog(t, at + i * micro * 0.4, micro, 'enter')) * stays;
  const whole = (at === undefined ? 1 : prog(t, at, enter, 'enter')) * stays;
  if (stays <= 0) return null;
  const fallAt = dropAt ?? maskAt;
  // The mask comes down row by row; once it is down the ranks of the masked rows step back.
  const masked = rows.filter((r) => r.masked);
  const falls = (r: BarRow) => (fallAt === undefined || !r.masked ? 0
    : prog(t, fallAt + masked.indexOf(r) * micro * 0.5, enter * 1.2, 'move'));
  const lastDown = (fallAt ?? 0) + Math.max(0, masked.length - 1) * micro * 0.5 + enter * 0.6;
  const gone = fallAt === undefined ? 0 : prog(t, goneAt ?? lastDown, enter, 'move');
  const pick = (picked === undefined ? 0 : pickedAt === undefined ? 1 : prog(t, pickedAt, enter, 'enter')) * stays;
  // The slab of the mask comes down behind the column, from under its name to under the last row.
  const slab = dropAt === undefined || maskAt === undefined ? 0 : prog(t, maskAt, DUR.morph * pace, 'move');

  const base = paint(th, color);
  const fillOf = (shown: number) => toward(th, toward(th, base, d), shown);
  const edgeOf = (shown: number) => (edge === undefined ? fillOf(shown) : toward(th, toward(th, paint(th, edge), d), shown));
  const pickInk = toward(th, paint(th, pickColor), d);
  const rankInk = (r: BarRow) => (r.rank === picked && pick > 0 ? mixColour(inkAt(th, dim), pickInk, pick)
    : inkAt(th, Math.min(dim, r.masked ? mix(1, 0.3, gone) : 1)));
  const onFill = onColor !== undefined ? paint(th, onColor)
    : contrast(paint(th, 'ink'), base) >= contrast(paint(th, 'bg'), base) ? paint(th, 'ink') : paint(th, 'bg');

  // Bars: only where a value was measured, in the look of the boxes, the value at the end.
  const top = Math.max(0.0001, ...rows.map((r) => r.value ?? 0));
  const laneX = lay.colW + RANK_GAP;
  const valueW = 4 * chW + RANK_GAP;
  const laneW = Math.max(0, w - laneX - valueW);
  const barInset = Math.round(H * 0.18);
  const maskTone = toward(th, toward(th, paint(th, maskColor), d), stays);
  const onMask = toward(th, toward(th, paint(th, onMaskRef), d), stays);
  const ring = heavy ?? th.stroke * 1.5;
  const tagW = tag ? Math.ceil(measure(tag, data).w) : 0;
  const nameInk = dim >= 1 ? 'ink2' : inkAt(th, dim);

  return (
    <>
      <div style={{ position: 'absolute', left: x, top: y, width: lay.colW, height: lay.h }}>
        {slab > 0 ? (
          <div style={{ position: 'absolute', left: -SLAB, top: -SLAB, width: lay.colW + 2 * SLAB, height: (lay.h + 2 * SLAB) * slab, background: maskTone }} />
        ) : null}
        {rows.map((r, i) => {
          const shown = arrives(i);
          if (shown <= 0) return null;
          const q = lay.rows[i];
          const fall = falls(r);
          const keep = 1 - fall;
          const len = r.value === undefined ? 0 : laneW * (r.value / top) * keep;
          const hidden = H * fall;
          const isPicked = r.rank === picked && pick > 0.5;
          return (
            <React.Fragment key={r.rank}>
              <div style={{ position: 'absolute', right: lay.colW + RANK_GAP, top: q.y, height: H, display: 'flex', alignItems: 'center',
                ...data, fontWeight: isPicked ? strong : data.fontWeight, lineHeight: 1, whiteSpace: 'pre', color: toward(th, rankInk(r), shown) }}>
                {String(r.rank)}
              </div>
              {hidden < H ? (
                <div style={{ position: 'absolute', left: 0, top: q.y + hidden, width: lay.colW, height: H - hidden, overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: 0, top: -hidden, width: lay.colW, height: H, boxSizing: 'border-box', background: fillOf(shown),
                    border: `${s}px solid ${edgeOf(shown)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', ...data, lineHeight: 1,
                    whiteSpace: 'pre', color: toward(th, onFill, shown) }}>
                    {r.label}
                  </div>
                </div>
              ) : null}
              {fall > 0 ? (
                <div style={{ position: 'absolute', left: 0, top: q.y, width: lay.colW, height: hidden, overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, width: lay.colW, height: H, background: maskTone, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', ...data, lineHeight: 1, whiteSpace: 'pre', color: onMask }}>
                    {r.label}
                  </div>
                </div>
              ) : null}
              {r.value !== undefined && len > 2 * s ? (
                <div style={{ position: 'absolute', left: laneX, top: q.y + barInset, width: len, height: H - 2 * barInset, boxSizing: 'border-box',
                  background: fillOf(shown), border: `${s}px solid ${edgeOf(shown)}` }} />
              ) : null}
              {r.value !== undefined ? (
                <div style={{ position: 'absolute', left: laneX + len + (len > 2 * s ? RANK_GAP : 0), top: q.y, height: H, display: 'flex',
                  alignItems: 'center', ...data, lineHeight: 1, whiteSpace: 'pre', color: toward(th, rankInk(r), shown) }}>
                  {(r.value * keep).toFixed(2)}
                </div>
              ) : null}
            </React.Fragment>
          );
        })}

        {picked !== undefined && pick > 0 ? rows.map((r, i) => {
          if (r.rank !== picked) return null;
          const q = lay.rows[i];
          // Apart: a ring in `ringColor` stands off the box by a slit of ground. On the edge: the pick colour, heavy.
          const o = ringApart ? SLIT + s / 2 : -ring / 2;
          const sw = ringApart ? s : ring;
          const round = 2 * (lay.colW + 2 * o) + 2 * (H + 2 * o);
          return (
            <svg key="picked" width={lay.colW} height={H} style={{ position: 'absolute', left: 0, top: q.y, overflow: 'visible' }}>
              <rect x={-o} y={-o} width={lay.colW + 2 * o} height={H + 2 * o} fill="none" stroke={toward(th, paint(th, ringApart ? ringColor : pickColor), d)}
                strokeWidth={sw} strokeDasharray={round} strokeDashoffset={round * (1 - pick)} />
            </svg>
          );
        }) : null}
      </div>

      {label ? <Text x={x + labelDx} y={y - LABEL_GAP - names * LABEL_ROW + 4} text={label} color={nameInk} shown={whole} /> : null}
      {maskLabel && maskAt !== undefined ? (
        <Text x={x + labelDx} y={y - LABEL_GAP - LABEL_ROW + 4} text={maskLabel} color={nameInk} shown={prog(t, maskAt, enter, 'enter') * stays} />
      ) : null}
      {tag ? (rows.some((r) => r.value !== undefined)
        // With bars the tag stands under the chart at the bars' right end; without them, beside the last box.
        ? <Tag x={x + w} y={y + lay.h + TAG_DROP} text={tag} dim={dim} shown={whole} />
        : <Tag x={x + lay.colW + TAG_GAP + tagW} y={y + lay.h} text={tag} dim={dim} shown={whole} />) : null}
    </>
  );
}
