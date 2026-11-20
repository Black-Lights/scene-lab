/**
 * @file kit/codeblock.tsx
 * @description CodeBlock (work package A2, the contract's "lines that appear and light up on times"): a file drawn as a
 *   Sheet with its name on a tab; each line has its number in the gutter and its text in the data face, in one ink.
 *   A lit line takes a lit band and full ink while the other lines step back. An arriving line opens its row (the
 *   lines under it move down and take their new numbers), is lit, and keeps a plus sign in the gutter after its light
 *   has stepped back; a leaving line is struck and keeps a minus sign. A line longer than the sheet wraps with a
 *   hanging indent and no second number. At most CODE_MAX lines: show the part that matters (`first` numbers it).
 *   A line can light more than once (`again`), a word can be underlined at a chosen occurrence (`marks`), a line can
 *   carry a quiet tag at the right end of its row (`lineTags`), part of a line can arrive later (`grows`: until then
 *   the line stands without it, closed up), and the whole file can arrive (`appearAt`).
 *   codeBlockLayout() and useCodeBlockLayout() give a scene the sheet's height and the y of every line.
 *   Lifted from an earlier video's scene code, topic-free. A pure function of its props, the theme and `t`.
 */
import React from 'react';
import { DUR } from '../motion';
import { useTheme } from '../theme';
import { highlight } from './beats';
import type { LitSpan } from './beats';
import { inkAt, litOf, strongOf, toward } from './ink';
import { paint } from './paint';
import { FadeIn, Sheet, Tag } from './parts2d';
import { mix, mixColour, prog } from './time';
import { MIN_TYPE, dataStyle, useCharWidth } from './type';

export type CodeBlockProps = {
  /** Top-left corner of the sheet; its name tab reaches SHEET_TAB above y. */
  x: number; y: number; w: number;
  /** The name on the tab (a file name, a path, a title). */
  name: string;
  /** The lines as they stand when every arriving line has arrived. */
  lines: string[];
  /** The number of the first line; default 1. */
  first?: number;
  /** Line numbers that light, that arrive, that leave. */
  lit?: number[];
  arrive?: number[];
  leave?: number[];
  /** Scene seconds at which a line lights, arrives or is struck. Without an entry it is so from the start. */
  at?: Record<number, number>;
  /** Scene seconds at which the light of a lit or arrived line steps back. Without an entry it stays lit. */
  until?: Record<number, number>;
  /** Further spans of scene seconds in which a line is lit, for a line that is named more than once. */
  again?: Record<number, LitSpan[]>;
  /** Words underlined in `markColor`: `text` is looked for in line `line` (a line that is not wrapped); `at` draws
   *  it on; `nth` picks the occurrence, from 1 (default the last one). */
  marks?: { line: number; text: string; at?: number; nth?: number }[];
  /** A quiet tag at the right end of a line's row (where a line came from, "illustrative"). */
  lineTags?: { line: number; text: string; at?: number }[];
  /** A part of a line written later: `text` is looked for in line `line` (its last occurrence; a line that is not
   *  wrapped). Before `at` the line stands without it; on `at` it opens and the line takes a plus sign. */
  grows?: { line: number; text: string; at: number }[];
  /** Scene seconds at which the whole file arrives (FadeIn). */
  appearAt?: number;
  /** A Tag under the sheet's lower right corner. */
  tag?: string;
  dim?: number;
  t: number;
  /** The sheet's fill and outline (defaults 'surface' and 'line'), the band of a lit line (default the theme's lit
   *  tone), and the underline of `marks` (default 'a'). */
  fill?: string; edge?: string; litColor?: string; markColor?: string;
  /** The number of a lit line turns bold (for a design whose lit band is faint). */
  strongLit?: boolean;
  pace?: number;
};

export type CodeBlockLayout = {
  /** Height of the sheet with every line arrived. */
  h: number;
  /** Characters that fit on one row, and where the text starts, from the sheet's left edge. */
  cols: number;
  codeX: number;
  /** One per line: its number, its top and height from the sheet's top edge, and its text broken into rows. */
  rows: { n: number; y: number; h: number; pieces: string[] }[];
  /** The y of the middle of a line's first row, in the parent's units, with every line arrived. */
  lineY: (n: number) => number;
};

/** Height of one row, and the most lines a block may show. */
export const CODE_LINE = 44;
export const CODE_MAX = 12;
const PAD = 14;
const SIDE = 18;
/** From the sheet's lower edge to the lower edge of its tag. */
const TAG_DROP = 56;

/** A line broken into rows of at most `cols` characters, the later rows indented under the first. A row ends after a
 *  space, a comma or an opening parenthesis where it can, so that no name is cut. */
function wrapCode(line: string, cols: number): string[] {
  if (line.length <= cols) return [line];
  const indent = line.length - line.trimStart().length;
  const hang = Math.min(indent + 4, Math.max(0, cols - 16));
  const rows: string[] = [];
  let rest = line.trimStart();
  let pad = indent;
  while (rest.length > cols - pad) {
    const room = cols - pad;
    let cut = room;
    for (let i = room; i > room * 0.4; i--) {
      if (' ,('.includes(rest[i - 1])) { cut = i; break; }
    }
    rows.push(' '.repeat(pad) + rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
    pad = hang;
  }
  if (rest) rows.push(' '.repeat(pad) + rest);
  return rows;
}

type LayoutInput = Pick<CodeBlockProps, 'y' | 'w' | 'lines' | 'first'>;

/** Where every line stands. `chW` is useCharWidth(), `stroke` the sheet's outline (th.stroke). */
export function codeBlockLayout({ y, w, lines, first = 1 }: LayoutInput, chW: number, stroke: number): CodeBlockLayout {
  if (lines.length > CODE_MAX) throw new Error(`CodeBlock: ${lines.length} lines, and a block shows at most ${CODE_MAX}`);
  const digits = Math.max(2, String(first + lines.length - 1).length);
  const codeX = SIDE + (digits + 2.5) * chW;
  const cols = Math.max(8, Math.floor((w - codeX - SIDE - stroke) / chW));
  let cy = PAD;
  const rows = lines.map((line, i) => {
    const pieces = wrapCode(line, cols);
    const row = { n: first + i, y: cy, h: pieces.length * CODE_LINE, pieces };
    cy += row.h;
    return row;
  });
  const lineY = (n: number) => y + (rows.find((r) => r.n === n)?.y ?? PAD) + CODE_LINE / 2;
  return { h: cy + PAD, cols, codeX, rows, lineY };
}

/** The layout of a code block, measured with the video's data face. */
export function useCodeBlockLayout(props: LayoutInput): CodeBlockLayout {
  const th = useTheme();
  return codeBlockLayout(props, useCharWidth(), th.stroke);
}

/** The code block. */
export function CodeBlock(props: CodeBlockProps) {
  const { x, y, w, name, first = 1, lit = [], arrive = [], leave = [], at = {}, until = {}, again = {}, marks = [], lineTags = [], grows = [], appearAt,
    tag, dim = 1, t, fill: fillRef = 'surface', edge = 'line', litColor, markColor = 'a', strongLit = false, pace = 1 } = props;
  const th = useTheme();
  const chW = useCharWidth();
  const L = codeBlockLayout(props, chW, th.stroke);
  const s = th.stroke;
  const fill = paint(th, fillRef);
  const band = litOf(th, fill, litColor);
  const strong = strongOf(th);
  const data = dataStyle(th, MIN_TYPE);
  const digits = Math.max(2, String(first + L.rows.length - 1).length);
  const settle = DUR.morph * pace * 0.78;
  const enter = DUR.enter * pace;

  const since = (n: number, over: number, ease: 'enter' | 'move') => (at[n] === undefined ? 1 : prog(t, at[n], over, ease));
  /** 0..1: how far an arriving line's row has opened. */
  const open = (n: number) => (arrive.includes(n) ? since(n, enter, 'move') : 1);
  /** 0..1: how lit a line is. */
  const light = (n: number) => {
    const more = again[n] ? highlight(t, Infinity, undefined, again[n], pace) : 0;
    if (!lit.includes(n) && !arrive.includes(n)) return more;
    const off = until[n] === undefined ? 0 : prog(t, until[n], settle, 'move');
    return Math.max(more, since(n, DUR.micro * pace, 'enter') * (1 - off));
  };
  /** The place of the nth occurrence of a word in a row (the last one without `nth`), in characters; -1 when absent. */
  const occurrence = (row: string, text: string, nth?: number) => {
    if (nth === undefined) return row.lastIndexOf(text);
    let i = -1;
    for (let k = 0; k < nth; k++) { i = row.indexOf(text, i + 1); if (i < 0) break; }
    return i;
  };
  /** 0..1: how far a leaving line's strike has been drawn. */
  const struck = (n: number) => (leave.includes(n) ? since(n, enter, 'move') : 0);

  const focus = Math.max(0, ...L.rows.map((r) => light(r.n)));
  let cy = PAD;
  let before = 0;
  const rows = L.rows.map((r) => {
    const o = open(r.n);
    const row = { ...r, top: cy, shownH: r.h * o, o, number: first + before };
    cy += row.shownH;
    if (o >= 0.5) before += 1;
    return row;
  });
  const h = cy + PAD;
  const whole = (dim - 0.3) / 0.7;

  return (
    <FadeIn at={appearAt} t={t} pace={pace}>
      <Sheet x={x} y={y} w={w} h={h} name={name} dim={dim} fill={fill} edge={edge}>
        {rows.map((r) => {
          if (r.shownH <= 0) return null;
          const l = light(r.n);
          const k = struck(r.n);
          // In focus when lit, stepped back while another line is lit or once it is struck.
          const d = 0.3 + 0.7 * whole * Math.min(1 - focus * (1 - l), 1 - k);
          const ink = mixColour(fill, inkAt(th, d), r.o);
          // The sign stays stronger than a line that has stepped back, and quieter than the lit line.
          const mark = mixColour(fill, inkAt(th, 0.3 + 0.7 * whole), r.o);
          const numberInk = mixColour(fill, mixColour(th.back, th.ink, l * whole), r.o);
          // A part that is written later: how far it has opened, and where it sits in the row.
          const grow = r.pieces.length === 1 ? grows.find((g) => g.line === r.n && r.pieces[0].lastIndexOf(g.text) >= 0) : undefined;
          const grown = grow ? prog(t, grow.at, enter, 'move') : 1;
          const growAt = grow ? r.pieces[0].lastIndexOf(grow.text) : -1;
          const sign = arrive.includes(r.n) || (grow && grown > 0) ? '+' : leave.includes(r.n) ? '-' : '';
          const cell: React.CSSProperties = { position: 'absolute', top: 0, height: CODE_LINE, display: 'flex', alignItems: 'center',
            ...data, lineHeight: 1, whiteSpace: 'pre' };
          return (
            <div key={r.n} style={{ position: 'absolute', left: 0, top: r.top, width: w, height: r.shownH, overflow: 'hidden' }}>
              {l > 0 ? <div style={{ position: 'absolute', left: s, top: 0, width: w - 2 * s, height: r.h, background: mixColour(fill, band, l) }} /> : null}
              <div style={{ ...cell, left: SIDE, width: digits * chW, justifyContent: 'flex-end', color: numberInk,
                fontWeight: strongLit && l > 0.5 ? strong : data.fontWeight }}>
                {r.number}
              </div>
              {sign ? <div style={{ ...cell, left: SIDE + (digits + 0.75) * chW, width: chW, justifyContent: 'center', color: mark, fontWeight: strong }}>{sign}</div> : null}
              {grow ? (
                <div style={{ ...cell, left: L.codeX, color: ink }}>
                  <span style={{ whiteSpace: 'pre' }}>{r.pieces[0].slice(0, growAt)}</span>
                  <span style={{ whiteSpace: 'pre', overflow: 'hidden', flexShrink: 0, width: grow.text.length * chW * grown }}>{grow.text}</span>
                  <span style={{ whiteSpace: 'pre' }}>{r.pieces[0].slice(growAt + grow.text.length)}</span>
                </div>
              ) : r.pieces.map((piece, j) => (
                <div key={j} style={{ ...cell, left: L.codeX, top: j * CODE_LINE, color: ink }}>{piece}</div>
              ))}
              {lineTags.filter((g) => g.line === r.n).map((g, j) => {
                const p = g.at === undefined ? 1 : prog(t, g.at, enter, 'enter');
                return p <= 0 ? null : <div key={'g' + j} style={{ ...cell, left: undefined, right: SIDE,
                  color: mixColour(fill, toward(th, th.back, 0.4 + 0.6 * dim), p * r.o) }}>{g.text}</div>;
              })}
              {marks.filter((m) => m.line === r.n && r.pieces.length === 1 && occurrence(r.pieces[0], m.text, m.nth) >= 0).map((m, j) => {
                const g = m.at === undefined ? 1 : prog(t, m.at, enter, 'move');
                return g <= 0 ? null : <div key={'m' + j} style={{ position: 'absolute', left: L.codeX + occurrence(r.pieces[0], m.text, m.nth) * chW,
                  top: CODE_LINE - 7, width: m.text.length * chW * g, height: Math.max(3, s), background: toward(th, paint(th, markColor), 0.4 + 0.6 * dim) }} />;
              })}
              {k > 0 ? r.pieces.map((piece, j) => {
                const lead = piece.length - piece.trimStart().length;
                return <div key={j} style={{ position: 'absolute', left: L.codeX + lead * chW - 4, top: j * CODE_LINE + CODE_LINE / 2 - 1,
                  width: mix(0, (piece.length - lead) * chW + 8, k), height: Math.max(2, Math.round(s * 0.6)), background: inkAt(th, 0.3 + 0.7 * whole) }} />;
              }) : null}
            </div>
          );
        })}
      </Sheet>
      {tag ? <Tag x={x + w} y={y + h + TAG_DROP} text={tag} dim={dim} /> : null}
    </FadeIn>
  );
}
