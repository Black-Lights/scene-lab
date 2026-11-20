/**
 * @file kit/ledger.tsx
 * @description Ledger (work package A2, the contract's "a list that grows: messages, events, steps"): rows on a Sheet.
 *   Each row is a chip that says who or what (a sender, a station, a day), its text in the data face, wrapped, and
 *   behind them the row's colour washed into the sheet, so that long text stays easy to read. A row may carry chips
 *   under its text (`items`: an order's goods, a call's name), a quieter reference before its text (`ref`: an id, a
 *   time), and the hatch over its body (text that came from outside; the chip stays plain). Rows are parted by a gap
 *   of `rule` colour. A row with `at` arrives then: the sheet grows by it. Square brackets at the right edge can span
 *   rows (`spans`), and a counter can stand at the foot (`count`). LedgerSlip is one row on its own small sheet (a row
 *   that travels). ledgerLayout() and useLedgerLayout() give a scene the place of every row.
 *   Lifted from an earlier video's scene code, topic-free. A pure function of its props, the theme and `t`.
 */
import React from 'react';
import { DUR } from '../motion';
import { useTheme } from '../theme';
import { inkAt, toward } from './ink';
import { Counter } from './overlay';
import { paint } from './paint';
import { Brace, CHIP_H, Chip, HatchedRect, Sheet, knockOut } from './parts2d';
import type { ChipProps, HatchLook } from './parts2d';
import { mixColour, prog } from './time';
import { MIN_TYPE, dataStyle, useCharWidth, wrapText } from './type';

/** How a chip of the ledger looks: the Chip props that are not its text or place. */
export type ChipStyle = Pick<ChipProps, 'color' | 'solid' | 'ink' | 'edge' | 'litFill' | 'litEdge' | 'stroke' | 'heavy' | 'radius' | 'hatch'>;

export type LedgerRow = {
  id: string;
  /** The word on the row's chip: who or what the row is (a sender, a station, a day). */
  label: string;
  /** The row's text; empty for a row that is only items. */
  text: string;
  /** Chips the row carries under its text, in a line (they do not wrap): `sub` is a quieter second text. */
  items?: { text: string; sub?: string }[];
  /** A quieter reference (an id, a time) before the text: on the first line when both fit, else on its own line. */
  ref?: string;
  /** The row's colour: its chip is solid in it, its body is it washed into the sheet (`wash`). */
  color?: string;
  /** The body's fill exactly, instead of the wash of `color`. */
  fill?: string;
  /** The look of this row's chip, instead of the solid chip in `color`. */
  chip?: ChipStyle;
  /** Diagonal lines over the body: the text came from outside. */
  hatch?: boolean;
  /** Scene seconds at which the row arrives; without it the row is there from the start. */
  at?: number;
};

export type LedgerProps = {
  x: number; y: number; w: number;
  /** The name on the sheet's tab. */
  name?: string;
  rows: LedgerRow[];
  /** A number at the foot (a running total), with its unit. */
  count?: number;
  unit?: string;
  /** Square brackets at the right edge, each over the rows from `from` to `to` (row ids), drawing on at `at`. */
  spans?: { from: string; to: string; at: number }[];
  dim?: number;
  t: number;
  /** The sheet's fill and outline (defaults 'surface' and 'line'). */
  fill?: string; edge?: string;
  /** The share of a row's colour washed into the sheet for its body; default 0.25. */
  wash?: number;
  /** The gap between two rows and its colour (defaults th.stroke / 2 and 'line'). */
  gap?: number; rule?: string;
  /** The look of every chip that is not set per row, and of the item chips. */
  chipStyle?: ChipStyle; itemStyle?: ChipStyle;
  /** The hatch of a row with `hatch`. */
  hatch?: HatchLook;
  /** The brackets of `spans`: colour (default 'ink') and stroke (default th.stroke). */
  spanColor?: string; spanStroke?: number;
  pace?: number;
};

export type LedgerLayout = {
  /** Height of the sheet with every row arrived. */
  h: number;
  /** Width of the chip column, and where the text starts and how wide it is, from the sheet's left edge. */
  chipW: number;
  textX: number;
  textW: number;
  /** One per row: its top and height from the sheet's top edge, and its text broken into lines. */
  rows: { id: string; y: number; h: number; lines: string[];
    /** The `ref` stands on the first line, before the text: its left edge and width. */
    refInline: boolean; refX: number; refW: number }[];
};

/** Height of one line of row text, and the padding of a row. */
export const ROW_LINE = 38;
export const ROW_PAD = 14;
const SIDE = 16;
const FOOT = 58;
const CHIP_GAP = 10;

/** What a row holds beside its chip, stacked: the text, the ref on its own line, the item chips. Tops count from the
 *  row's padding; the first line of text stands level with the word on the chip. */
function rowStack(r: LedgerRow, lines: number, refInline = false): { textTop: number; refTop: number; itemsTop: number; h: number } {
  const textH = lines * ROW_LINE;
  const refH = r.ref && !refInline ? ROW_LINE : 0;
  const items = r.items?.length ? CHIP_H : 0;
  const lead = textH + refH > 0 ? (CHIP_H - ROW_LINE) / 2 : 0;
  const itemsTop = lead + textH + refH + (textH + refH > 0 && items ? CHIP_GAP : 0);
  return { textTop: lead, refTop: lead + textH, itemsTop, h: Math.max(CHIP_H, itemsTop + items) };
}

/** The width a ledger needs so that its widest line of item chips is not cut. `chW`: useCharWidth(). */
export function ledgerNeed(rows: LedgerRow[], chW: number, stroke: number): number {
  const longest = Math.max(1, ...rows.map((r) => r.label.length));
  const textX = stroke + SIDE + Math.ceil(longest * chW + MIN_TYPE + 2 * stroke) + 20;
  const chip = (c: { text: string; sub?: string }) => (c.text.length + (c.sub?.length ?? 0)) * chW + 2.5 * MIN_TYPE + 2 * stroke;
  const widest = Math.max(0, ...rows.map((r) => (r.items ?? []).reduce((n, c, i) => n + chip(c) + (i ? 12 : 0), 0)));
  return Math.ceil(textX + widest + SIDE + stroke);
}

/** The place of every row of a ledger `w` wide. `chW` is useCharWidth(); `stroke` the sheet's outline; `gap` the gap
 *  between rows; `count` makes room for the foot. */
export function ledgerLayout(rows: LedgerRow[], w: number, chW: number, stroke: number, gap: number, count?: number): LedgerLayout {
  const ch = chW;
  const edge = stroke;
  const longest = Math.max(1, ...rows.map((r) => r.label.length));
  const chipW = Math.ceil(longest * ch + MIN_TYPE + 2 * stroke);
  const textX = edge + SIDE + chipW + 20;
  const textW = w - textX - SIDE - edge;
  let y = edge;
  const out = rows.map((r, i) => {
    // A row without text has no empty first line. The ref stands before the text when both fit on one line.
    const refCols = r.ref ? r.ref.length + 2 : 0;
    const short = r.ref && r.text ? wrapText(r.text, textW / ch - refCols) : [];
    const refInline = !!r.ref && short.length === 1;
    const lines = refInline ? short : r.text ? wrapText(r.text, textW / ch) : [];
    const h = rowStack(r, lines.length, refInline).h + 2 * ROW_PAD;
    const row = { id: r.id, y, h, lines, refInline, refX: textX, refW: r.ref ? r.ref.length * ch : 0 };
    y += h + (i < rows.length - 1 ? gap : 0);
    return row;
  });
  return { h: y + (count !== undefined ? FOOT : 0) + edge, chipW, textX, textW, rows: out };
}

/** ledgerLayout measured with the video's data face; `gap` defaults to th.stroke / 2 as in Ledger. */
export function useLedgerLayout(rows: LedgerRow[], w: number, opts: { gap?: number; count?: number } = {}): LedgerLayout {
  const th = useTheme();
  return ledgerLayout(rows, w, useCharWidth(), th.stroke, opts.gap ?? th.stroke / 2, opts.count);
}

type Look = { fill: string; wash: number; chipStyle?: ChipStyle; itemStyle?: ChipStyle; hatch?: HatchLook };

/** One row, drawn from the sheet's left edge: the wash, the chip, the text, the ref, the item chips. */
function RowBody({ row, lay, index, w, dim, look }: { row: LedgerRow; lay: LedgerLayout; index: number; w: number; dim: number; look: Look }) {
  const th = useTheme();
  const edge = th.stroke;
  const place = lay.rows[index];
  const body = row.fill !== undefined ? paint(th, row.fill) : row.color !== undefined ? mixColour(look.fill, paint(th, row.color), look.wash) : look.fill;
  const wash = toward(th, body, 0.4 + 0.6 * dim);
  const data = dataStyle(th, MIN_TYPE);
  const ink = inkAt(th, dim);
  const stack = rowStack(row, place.lines.length, place.refInline);
  const shift = place.refInline ? place.refW + 2 * (place.refW / Math.max(1, row.ref?.length ?? 1)) : 0;
  const textTop = ROW_PAD + stack.textTop;
  const refTop = ROW_PAD + stack.refTop;
  const itemsTop = ROW_PAD + stack.itemsTop;
  const chip: ChipStyle = row.chip ?? { ...look.chipStyle, ...(row.color !== undefined ? { color: row.color, solid: true } : {}) };
  return (
    <div style={{ position: 'absolute', left: edge, top: 0, width: w - 2 * edge, height: place.h, background: wash }}>
      {row.hatch ? <HatchedRect x={0} y={0} w={w - 2 * edge} h={place.h} color={wash} dim={1} strength={0.55 * (0.4 + 0.6 * dim)} hatch={look.hatch} /> : null}
      <Chip x={SIDE} y={ROW_PAD} w={lay.chipW} text={row.label} dim={dim} {...chip} />
      {place.lines.map((line, i) => (
        <div key={i} style={{ position: 'absolute', left: lay.textX - edge + shift, top: textTop + i * ROW_LINE, height: ROW_LINE, display: 'flex',
          alignItems: 'center', ...data, lineHeight: 1, whiteSpace: 'pre', color: ink, ...(row.hatch ? knockOut(wash) : {}) }}>
          {line}
        </div>
      ))}
      {row.ref ? (
        <div style={{ position: 'absolute', left: lay.textX - edge, top: place.refInline ? textTop : refTop, height: ROW_LINE, display: 'flex', alignItems: 'center',
          ...data, lineHeight: 1, whiteSpace: 'pre', color: toward(th, th.back, 0.4 + 0.6 * dim), ...(row.hatch ? knockOut(wash) : {}) }}>
          {row.ref}
        </div>
      ) : null}
      {row.items?.length ? (
        <div style={{ position: 'absolute', left: lay.textX - edge, top: itemsTop, display: 'flex', gap: 12 }}>
          {row.items.map((c, i) => <Chip key={i + ':' + (c.sub ?? c.text)} text={c.text} sub={c.sub} dim={dim} {...look.itemStyle} />)}
        </div>
      ) : null}
    </div>
  );
}

export type LedgerSlipProps = Pick<LedgerProps, 'fill' | 'edge' | 'wash' | 'chipStyle' | 'itemStyle' | 'hatch'> & {
  x: number; y: number; w: number; row: LedgerRow; dim?: number };

/** One row on its own small sheet: a row that travels (carried by an arrow, copied to another list). */
export function LedgerSlip({ x, y, w, row, dim = 1, fill: fillRef = 'surface', edge = 'line', wash = 0.25, chipStyle, itemStyle, hatch }: LedgerSlipProps) {
  const th = useTheme();
  const fill = paint(th, fillRef);
  const lay = ledgerLayout([row], w, useCharWidth(), th.stroke, 0);
  return (
    <Sheet x={x} y={y} w={w} h={lay.h} dim={dim} fill={fill} edge={edge}>
      <div style={{ position: 'absolute', left: 0, top: lay.rows[0].y, width: w, height: lay.rows[0].h }}>
        <RowBody row={row} lay={lay} index={0} w={w} dim={dim} look={{ fill, wash, chipStyle, itemStyle, hatch }} />
      </div>
    </Sheet>
  );
}

/** The ledger. */
export function Ledger({ x, y, w, name, rows, count, unit, spans = [], dim = 1, t, fill: fillRef = 'surface', edge = 'line', wash = 0.25,
  gap: gapIn, rule = 'line', chipStyle, itemStyle, hatch, spanColor = 'ink', spanStroke, pace = 1 }: LedgerProps) {
  const th = useTheme();
  const chW = useCharWidth();
  const fill = paint(th, fillRef);
  const gap = gapIn ?? th.stroke / 2;
  const lay = ledgerLayout(rows, w, chW, th.stroke, gap, count);
  const s = th.stroke;
  // A row that has not arrived takes no room: the sheet grows with it.
  const shares = rows.map((r) => (r.at === undefined ? 1 : prog(t, r.at, DUR.enter * pace, 'move')));
  let y0 = s;
  const tops = rows.map((_, i) => {
    const top = y0;
    y0 += (lay.rows[i].h + (i < rows.length - 1 ? gap : 0)) * shares[i];
    return top;
  });
  const h = y0 + (count !== undefined ? FOOT : 0) + s;
  const ruleInk = toward(th, paint(th, rule), 0.4 + 0.6 * dim);
  const rowOf = (id: string) => Math.max(0, rows.findIndex((r) => r.id === id));
  const look: Look = { fill, wash, chipStyle, itemStyle, hatch };
  return (
    <>
      <Sheet x={x} y={y} w={w} h={h} name={name} dim={dim} fill={fill} edge={edge}>
        {rows.map((r, i) => (shares[i] <= 0 ? null : (
          <div key={r.id} style={{ position: 'absolute', left: 0, top: tops[i], width: w, height: lay.rows[i].h * shares[i], overflow: 'hidden' }}>
            <RowBody row={r} lay={lay} index={i} w={w} dim={dim} look={look} />
          </div>
        )))}
        {rows.map((r, i) => (i === 0 || shares[i] <= 0 ? null : (
          <div key={'rule-' + r.id} style={{ position: 'absolute', left: s, top: tops[i] - gap, width: w - 2 * s, height: gap, background: ruleInk }} />
        )))}
        {count !== undefined ? (
          <div style={{ position: 'absolute', left: lay.textX, top: h - s - FOOT, height: FOOT, display: 'flex', alignItems: 'center' }}>
            <Counter value={count} unit={unit} size={MIN_TYPE} color={inkAt(th, dim)} />
          </div>
        ) : null}
      </Sheet>
      {spans.map((b, i) => {
        const a = rowOf(b.from);
        const z = rowOf(b.to);
        const top = y + tops[a];
        const bottom = y + tops[z] + lay.rows[z].h * shares[z];
        return <Brace key={i} shape="square" x={x + w + 10 + i * 30} y={top} len={bottom - top} side="right" at={b.at} t={t} dim={dim}
          color={spanColor} stroke={spanStroke} pace={pace} />;
      })}
    </>
  );
}
