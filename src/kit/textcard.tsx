/**
 * @file kit/textcard.tsx
 * @description The text card (work package A2): lines of real text in the data face on a Sheet, with a name on its
 *   tab (a file path, a URL, the name of a list). A line lights on its spoken word (a lit band and full ink) while
 *   the other lines step back; a `quiet` line waits in the back ink until it is first lit; a line can step back for
 *   good (`backAt`); a circled letter can stand at the end of the line it concerns, with a square bracket when it
 *   concerns several lines; a label can stand at the foot, under a rule, and a Tag under the lower right corner.
 *   Before `closedUntil` the card is closed: its outline and its tab only. Long lines wrap at spaces and keep their
 *   indent. textCardLayout() and useTextCardLayout() give a scene the card's height and the y of any line, for
 *   placing things beside it. A pure function of its props, the theme and scene time `t`.
 */
import React from 'react';
import { DUR } from '../motion';
import { useTheme } from '../theme';
import type { Theme } from '../theme';
import { highlight } from './beats';
import type { LitSpan } from './beats';
import { paint } from './paint';
import { Brace, Circled, FadeIn, Sheet, Tag } from './parts2d';
import { mixColour, prog } from './time';
import { MIN_TYPE, dataStyle, textStyle, useCharWidth, wrapText } from './type';

/** Inner margins of a card, the height of its foot, and the drop from its lower edge to the lower edge of its tag. */
const PAD_X = 22;
const PAD_Y = 16;
const FOOT_H = 66;
const TAG_DROP = 42;
/** From the end of a line to its bracket, the arm of the bracket, and the diameter of the circled letter. */
const MARK_GAP = 16;
const MARK_ARM = 14;
const MARK_D = 46;

const lineHeight = (size: number) => Math.round(size * (44 / 28));
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const toward = (th: Theme, hex: string, d: number) => mixColour(th.bg, hex, clamp(d));
const inkAt = (th: Theme, d: number) => mixColour(th.back, th.ink, clamp((d - 0.3) / 0.7));

export type TextMarker = {
  /** The line the marker stands at (numbers start at 1). */
  line: number;
  /** A bracket over these lines, first and last: the marker concerns all of them. */
  span?: [number, number];
  /** The letter (or digit) in the ring. */
  letter: string;
  /** Scene seconds at which it appears, at which it fills and at which it empties again. */
  at: number; litAt?: number; litUntil?: number;
};

export type TextCardProps = {
  /** Top-left corner of the sheet; its tab reaches SHEET_TAB above y. */
  x: number; y: number; w: number;
  /** The name on the tab: where the text comes from. */
  name: string;
  lines: string[];
  /** Type size of the lines in pixels; default MIN_TYPE. */
  size?: number;
  /** A fixed height, when it is more than the text needs: the foot stays at the lower edge. */
  h?: number;
  /** Line numbers that light, from 1, with the scene seconds at which each lights and steps back; `again`: more spans. */
  lit?: number[];
  at?: Record<number, number>;
  until?: Record<number, number>;
  again?: Record<number, LitSpan[]>;
  /** Lines that stand in the back ink until they are first lit. */
  quiet?: number[];
  /** Scene seconds at which a line steps back to the back ink for good (a row that has been passed). */
  backAt?: Record<number, number>;
  markers?: TextMarker[];
  /** A label at the foot of the card and the scene seconds at which it appears. */
  foot?: string; footAt?: number;
  /** Before this time the card is closed: outline and tab only. */
  closedUntil?: number;
  /** Scene seconds at which the whole card arrives (FadeIn). */
  appearAt?: number;
  /** A Tag under the sheet's lower right corner. */
  tag?: string;
  dim?: number;
  t: number;
  /** The sheet's fill and outline (defaults 'surface' and 'line') and the band of a lit line (default the theme's
   *  lit tone, else the surface a little toward the ink). */
  fill?: string; edge?: string; litColor?: string;
  /** The ink of the text (default the theme's ink and back ink). Name one when the fill is far from the ground, such
   *  as a light card on a dark ground: the lines that step back then mix it toward the fill. */
  ink?: string;
  pace?: number;
};

export type TextCardLayout = {
  h: number;
  lineH: number;
  /** Where the text starts, from the sheet's left edge, and the characters that fit on one row. */
  textX: number; cols: number;
  rows: { n: number; y: number; h: number; pieces: string[] }[];
  /** The y of the middle of a line's first row, in the parent's units. */
  lineY: (n: number) => number;
  /** The width of a line's longest row, in pixels. */
  lineW: (n: number) => number;
};

type CardInput = Pick<TextCardProps, 'y' | 'w' | 'lines' | 'size' | 'h' | 'foot'>;

/** A line broken into rows; the later rows keep the indent of the first. */
function wrapLine(line: string, cols: number): string[] {
  if (line.length <= cols) return [line];
  const indent = line.length - line.trimStart().length;
  return wrapText(line.trimStart(), Math.max(8, cols - indent)).map((piece) => ' '.repeat(indent) + piece);
}

/** Where every line stands. `chW` is useCharWidth() at the card's type size. */
export function textCardLayout({ y, w, lines, size, h, foot }: CardInput, chW: number): TextCardLayout {
  const px = Math.max(MIN_TYPE, size ?? MIN_TYPE);
  const lineH = lineHeight(px);
  const cols = Math.max(8, Math.floor((w - 2 * PAD_X) / chW));
  let cy = PAD_Y;
  const rows = lines.map((line, i) => {
    const pieces = wrapLine(line, cols);
    const row = { n: i + 1, y: cy, h: pieces.length * lineH, pieces };
    cy += row.h;
    return row;
  });
  const need = cy + PAD_Y + (foot ? FOOT_H : 0);
  const find = (n: number) => rows.find((r) => r.n === n);
  return {
    h: Math.max(h ?? 0, need), lineH, textX: PAD_X, cols, rows,
    lineY: (n) => y + (find(n)?.y ?? PAD_Y) + lineH / 2,
    lineW: (n) => Math.max(0, ...(find(n)?.pieces ?? []).map((piece) => piece.length)) * chW,
  };
}

/** The layout of a text card, measured with the video's data face. */
export function useTextCardLayout(props: CardInput): TextCardLayout {
  const chW = useCharWidth(Math.max(MIN_TYPE, props.size ?? MIN_TYPE));
  return textCardLayout(props, chW);
}

/** The text card. */
export function TextCard(props: TextCardProps) {
  const { x, y, w, name, size, lit = [], at = {}, until = {}, again = {}, quiet = [], backAt = {}, markers = [], foot, footAt,
    closedUntil, appearAt, tag, dim = 1, t, fill: fillRef = 'surface', edge = 'line', litColor, ink, pace = 1 } = props;
  const th = useTheme();
  const px = Math.max(MIN_TYPE, size ?? MIN_TYPE);
  const chW = useCharWidth(px);
  const L = textCardLayout(props, chW);
  const s = th.stroke;
  const data = dataStyle(th, px);
  const fill = paint(th, fillRef);
  const own = ink ? paint(th, ink) : null;
  // the theme's band is made for its own ground; a card with an ink of its own lights toward that ink
  const band = litColor ? paint(th, litColor) : th.lit && !own ? paint(th, th.lit) : mixColour(fill, own ?? paint(th, 'ink'), 0.12);
  const inkOf = (d: number) => (own ? mixColour(mixColour(fill, own, 0.45), own, clamp((d - 0.3) / 0.7)) : inkAt(th, d));
  const footInk = dim < 1 ? inkOf(dim) : own ? mixColour(fill, own, 0.75) : th.ink2;
  const micro = DUR.micro * pace;
  const whole = (dim - 0.3) / 0.7;
  const open = closedUntil === undefined ? 1 : prog(t, closedUntil, micro, 'enter');

  const light = (n: number) => (lit.includes(n) ? highlight(t, at[n], until[n], again[n], pace) : highlight(t, Infinity, undefined, again[n], pace));
  /** 0..1: a quiet line has been lit once, so it now stands in full ink. */
  const woken = (n: number) => (quiet.includes(n) ? (lit.includes(n) && at[n] !== undefined ? prog(t, at[n], micro, 'enter') : lit.includes(n) ? 1 : 0) : 1);
  const passed = (n: number) => (backAt[n] === undefined ? 0 : prog(t, backAt[n], DUR.enter * pace, 'move'));
  const focus = Math.max(0, ...L.rows.map((r) => light(r.n)));

  return (
    <FadeIn at={appearAt} t={t} pace={pace}>
      <Sheet x={x} y={y} w={w} h={L.h} name={name} dim={dim} fill={fill} edge={edge} ink={ink}>
        {open <= 0 ? null : (
          <div style={{ position: 'absolute', left: 0, top: 0, opacity: open }}>
            {L.rows.map((r) => {
              const l = light(r.n);
              const d = 0.3 + 0.7 * whole * Math.min(1 - focus * (1 - l), woken(r.n), 1 - passed(r.n));
              return (
                <div key={r.n} style={{ position: 'absolute', left: 0, top: r.y, width: w, height: r.h }}>
                  {l > 0 ? <div style={{ position: 'absolute', left: s, top: 0, width: w - 2 * s, height: r.h, background: mixColour(fill, band, l) }} /> : null}
                  {r.pieces.map((piece, j) => (
                    <div key={j} style={{ position: 'absolute', left: L.textX, top: j * L.lineH, height: L.lineH, display: 'flex', alignItems: 'center',
                      ...data, lineHeight: 1, whiteSpace: 'pre', color: inkOf(d) }}>
                      {piece}
                    </div>
                  ))}
                </div>
              );
            })}
            {foot ? (
              <FadeIn at={footAt} t={t} rise={0} pace={pace}>
                <div style={{ position: 'absolute', left: s, top: L.h - FOOT_H, width: w - 2 * s, height: Math.max(2, s - 1), background: toward(th, th.line, 0.4 + 0.6 * dim) }} />
                <div style={{ position: 'absolute', left: PAD_X, top: L.h - FOOT_H, height: FOOT_H, display: 'flex', alignItems: 'center', ...textStyle(th, 's'),
                  lineHeight: 1, whiteSpace: 'pre', color: footInk }}>
                  {foot}
                </div>
              </FadeIn>
            ) : null}
          </div>
        )}
      </Sheet>
      {markers.map((m) => {
        const [a, z] = m.span ?? [m.line, m.line];
        const first = L.rows.find((r) => r.n === a);
        const last = L.rows.find((r) => r.n === z);
        if (!first || !last) return null;
        const textW = Math.max(...L.rows.filter((r) => r.n >= a && r.n <= z).map((r) => L.lineW(r.n)));
        const bx = x + L.textX + textW + MARK_GAP;
        const top = y + first.y + 6;
        const len = last.y + last.h - first.y - 12;
        const mx = m.span ? bx + MARK_ARM + MARK_GAP + MARK_D / 2 : bx + MARK_D / 2;
        const filled = m.litAt === undefined ? 0 : highlight(t, m.litAt, m.litUntil, [], pace);
        return (
          <React.Fragment key={m.letter}>
            {m.span ? <Brace shape="square" x={bx} y={top} len={len} side="right" at={m.at} t={t} color="ink2" arm={MARK_ARM} dim={dim} pace={pace} /> : null}
            <FadeIn at={m.at} t={t} rise={0} pace={pace}>
              <Circled x={mx} y={m.span ? top + len / 2 : L.lineY(m.line)} text={m.letter} lit={filled} dim={dim} on={fill} size={MARK_D} />
            </FadeIn>
          </React.Fragment>
        );
      })}
      {tag ? <Tag x={x + w} y={y + L.h + TAG_DROP} text={tag} dim={dim} /> : null}
    </FadeIn>
  );
}
