/**
 * @file kit/pane.tsx
 * @description OutputPane (work package A2): what a program printed, a terminal, a receipt. A Sheet with a name on its
 *   tab and the text in the data face, wrapped at spaces. The text is written from `writeAt` on, character by
 *   character, with a caret at its end while it is being written; a pane without text shows one empty line and a caret
 *   that stays. A span of the text (a number, an id) can take the lit band on its spoken word, and while a span is lit
 *   the rest of the text steps back. A span is never broken across two rows. paneLayout() and usePaneLayout() give a
 *   scene the pane's height and the box of a span, so that a copy of the span can leave the pane and travel.
 *   Lifted from an earlier video's scene code, topic-free. A pure function of its props, the theme and `t`.
 */
import React from 'react';
import { DUR } from '../motion';
import { useTheme } from '../theme';
import { highlight } from './beats';
import { inkAt, litOf, toward } from './ink';
import { paint } from './paint';
import { FadeIn, Sheet, Tag } from './parts2d';
import { mixColour, prog } from './time';
import { MIN_TYPE, dataStyle, useCharWidth, wrapText } from './type';

export type PaneSpan = {
  /** Words of the pane's text, as they stand in it. */
  text: string;
  /** Scene seconds at which the span takes the lit band and at which it gives it back. */
  at: number; until?: number;
};

export type OutputPaneProps = {
  /** Top-left corner of the sheet; its tab reaches SHEET_TAB above y. */
  x: number; y: number; w: number;
  /** The name on the tab. */
  name: string;
  /** What was printed. Without it the pane shows one empty line and a caret. */
  text?: string;
  /** The least number of rows the sheet holds, so that an empty pane has the room of the text to come. */
  rows?: number;
  /** Scene seconds at which the pane opens (FadeIn). */
  at?: number;
  /** Scene seconds at which the text starts to be written, and how long the writing takes (default 1.2 s). */
  writeAt?: number; writeOver?: number;
  /** Scene seconds at which the caret appears; default with the pane. */
  caretAt?: number;
  /** Spans that take the lit band. The same text may stand in several entries: it then lights several times. */
  spans?: PaneSpan[];
  /** A Tag under the sheet's lower right corner, and when it appears (default with the text). */
  tag?: string;
  tagAt?: number;
  dim?: number;
  t: number;
  /** The sheet's fill and outline (defaults 'surface' and 'line'), the band of a lit span (default the theme's lit
   *  tone), the caret (default 'ink2'). */
  fill?: string; edge?: string; litColor?: string; caretColor?: string;
  pace?: number;
};

export type PaneBox = { x: number; y: number; w: number; h: number };

export type PaneLayout = {
  h: number;
  lineH: number;
  /** Where the text starts, from the sheet's left edge, and the characters that fit on one row. */
  textX: number; cols: number;
  lines: string[];
  /** The box of the first place a span stands at, in the parent's units; null when the text does not hold it. */
  spanBox: (text: string) => PaneBox | null;
};

/** Height of one row, the inner margins, and the drop to the lower edge of the tag. */
export const PANE_LINE = 44;
const PAD_X = 22;
const PAD_Y = 14;
const TAG_DROP = 42;
const HARD = String.fromCharCode(160);

type PaneInput = Pick<OutputPaneProps, 'x' | 'y' | 'w' | 'text' | 'rows' | 'spans'>;

/** A span as it stands in the wrapped lines: its spaces do not break. */
const hard = (text: string) => text.split(' ').join(HARD);

/** Where the text stands. `chW` is useCharWidth(). */
export function paneLayout({ x, y, w, text, rows = 1, spans = [] }: PaneInput, chW: number): PaneLayout {
  const cols = Math.max(8, Math.floor((w - 2 * PAD_X) / chW));
  let body = text ?? '';
  for (const sp of spans) body = body.split(sp.text).join(hard(sp.text));
  const lines = text === undefined ? [''] : wrapText(body, cols);
  const band = Math.round(MIN_TYPE * 1.36);
  return {
    h: 2 * PAD_Y + Math.max(rows, lines.length) * PANE_LINE, lineH: PANE_LINE, textX: PAD_X, cols, lines,
    spanBox: (span) => {
      const key = hard(span);
      const j = lines.findIndex((line) => line.includes(key));
      if (j < 0) return null;
      return { x: x + PAD_X + lines[j].indexOf(key) * chW, y: y + PAD_Y + j * PANE_LINE + (PANE_LINE - band) / 2, w: key.length * chW, h: band };
    },
  };
}

/** The layout of a pane, measured with the video's data face. */
export function usePaneLayout(props: PaneInput): PaneLayout {
  return paneLayout(props, useCharWidth());
}

/** The output pane. */
export function OutputPane(props: OutputPaneProps) {
  const { x, y, w, name, text, at, writeAt, writeOver = 1.2, caretAt, spans = [], tag, tagAt, dim = 1, t, fill: fillRef = 'surface', edge = 'line',
    litColor, caretColor = 'ink2', pace = 1 } = props;
  const th = useTheme();
  const chW = useCharWidth();
  const L = paneLayout(props, chW);
  const fill = paint(th, fillRef);
  const lit = litOf(th, fill, litColor);
  const data = dataStyle(th, MIN_TYPE);
  const whole = (dim - 0.3) / 0.7;
  const total = L.lines.reduce((n, line) => n + line.length, 0);
  const written = text === undefined ? 0 : writeAt === undefined ? 1 : prog(t, writeAt, Math.max(0.01, writeOver), 'linear');
  let left = Math.round(total * written);
  const band = Math.round(MIN_TYPE * 1.36);

  // How lit each distinct span is: the strongest of its entries.
  const keys = Array.from(new Set(spans.map((sp) => hard(sp.text))));
  const lightOf = (key: string) => Math.max(0, ...spans.filter((sp) => hard(sp.text) === key).map((sp) => highlight(t, sp.at, sp.until, [], pace)));
  const focus = Math.max(0, ...keys.map(lightOf));
  const rest = inkAt(th, 0.3 + 0.7 * whole * (1 - focus));

  // The caret stands after the last written character: in an empty pane for good, in a written one until the text is whole.
  let caret: { x: number; y: number } | null = text === undefined || written < 1 ? { x: L.textX, y: PAD_Y } : null;
  const body = L.lines.map((line, j) => {
    const shown = Math.min(line.length, left);
    left -= shown;
    if (caret && shown > 0) caret = { x: L.textX + shown * chW, y: PAD_Y + j * PANE_LINE };
    // The row in pieces: plain text, and the spans that stand in it.
    const cuts: { from: number; to: number; key: string }[] = [];
    for (const key of keys) {
      let i = line.indexOf(key);
      while (i >= 0) { cuts.push({ from: i, to: i + key.length, key }); i = line.indexOf(key, i + key.length); }
    }
    cuts.sort((a, b) => a.from - b.from);
    const pieces: { from: number; to: number; key?: string }[] = [];
    let pos = 0;
    for (const c of cuts) {
      if (c.from < pos) continue;
      if (c.from > pos) pieces.push({ from: pos, to: c.from });
      pieces.push(c);
      pos = c.to;
    }
    if (pos < line.length) pieces.push({ from: pos, to: line.length });
    return (
      <div key={j} style={{ position: 'absolute', left: L.textX, top: PAD_Y + j * PANE_LINE, height: PANE_LINE }}>
        {pieces.map((piece) => {
          const l = piece.key ? lightOf(piece.key) : 0;
          const end = Math.min(piece.to, shown);
          if (end <= piece.from) return null;
          return (
            <React.Fragment key={piece.from}>
              {l > 0 ? <div style={{ position: 'absolute', left: piece.from * chW - 5, top: (PANE_LINE - band) / 2, width: (piece.to - piece.from) * chW + 10,
                height: band, background: mixColour(fill, lit, l) }} /> : null}
              <div style={{ position: 'absolute', left: piece.from * chW, top: 0, height: PANE_LINE, display: 'flex', alignItems: 'center', ...data,
                lineHeight: 1, whiteSpace: 'pre', color: piece.key ? mixColour(rest, inkAt(th, 0.3 + 0.7 * whole), l) : rest }}>
                {line.slice(piece.from, end)}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    );
  });
  const mark: { x: number; y: number } | null = caret;
  const markShown = caretAt === undefined ? 1 : prog(t, caretAt, DUR.micro * pace, 'enter');

  return (
    <FadeIn at={at} t={t} pace={pace}>
      <Sheet x={x} y={y} w={w} h={L.h} name={name} dim={dim} fill={fill} edge={edge}>
        {body}
        {mark && markShown > 0 ? <div style={{ position: 'absolute', left: mark.x + 2, top: mark.y + (PANE_LINE - band) / 2, width: Math.round(chW * 0.72),
          height: band, background: mixColour(fill, toward(th, paint(th, caretColor), 0.4 + 0.6 * dim), markShown) }} /> : null}
      </Sheet>
      {tag ? <FadeIn at={tagAt ?? writeAt} t={t} rise={0} pace={pace}><Tag x={x + w} y={y + L.h + TAG_DROP} text={tag} dim={dim} /></FadeIn> : null}
    </FadeIn>
  );
}
