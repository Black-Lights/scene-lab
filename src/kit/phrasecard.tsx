/**
 * @file kit/phrasecard.tsx
 * @description PhraseCard (work package A2): a card that holds one short statement. A head with its word (Rule, Myth,
 *   Question, Step) and an optional number, and under it the phrase in the display face, on two lines at most (a longer
 *   phrase steps down a size, twice at most, unless `fit` is false or a `size` is given). The head is parted from the
 *   phrase by a rule, or (`bare`) the word simply stands on the card. A card can arrive (`at`), have a word of its
 *   phrase underlined (`underline`), be struck through line by line (`struckAt`: a belief shown wrong), and keep a foot
 *   free (`stampRoom`) for a stamp that closes it (`stamp`). Cards of one set differ by their word and by what happens
 *   to them, never by a colour. phraseCardLayout() and usePhraseCardLayout() give a scene the card's height.
 *   Lifted from an earlier video's scene code, topic-free. A pure function of its props, the theme and `t`.
 */
import React from 'react';
import { DUR } from '../motion';
import { useTheme } from '../theme';
import type { Theme } from '../theme';
import { inkAt, strongOf, toward } from './ink';
import { paint } from './paint';
import { FadeIn, Sheet, Stamp, Strike } from './parts2d';
import type { StampProps } from './parts2d';
import { mix, prog } from './time';
import { MIN_TYPE, dataStyle, textStyle, useTextSize } from './type';

export type PhraseCardProps = {
  /** Top-left corner. */
  x: number; y: number;
  w?: number;
  /** The word in the head. */
  head: string;
  /** A number after the word, in the data face. */
  n?: number | string;
  /** The phrase, in the display face. */
  phrase: string;
  /** Type size of the phrase in pixels; default 44, stepped down for a long phrase while `fit` holds. */
  size?: number;
  /** A phrase that needs a third line steps down 4 px, twice at most (default true; only without `size`). */
  fit?: boolean;
  /** Scene seconds at which the phrase is struck through, line by line. */
  struckAt?: number;
  /** Room at the foot for a stamp; default true when `stamp` is given. */
  stampRoom?: boolean;
  /** The word of a stamp and the scene seconds at which it lands on the foot. */
  stamp?: { text: string; at: number };
  /** Scene seconds at which the card arrives (FadeIn). */
  at?: number;
  /** A word of the phrase that is underlined (the first line that holds it), and when the line draws on. */
  underline?: { text: string; at?: number };
  dim?: number;
  t: number;
  /** The sheet's fill and outline (defaults 'surface' and 'line'), the rule under the head (default 'line'), and the
   *  line of the underline and the strike (default 'ink'). */
  fill?: string; edge?: string; rule?: string; ink?: string;
  /** No rule under the head: the word stands on the card a little lower. */
  bare?: boolean;
  /** The stamp's look: Stamp props other than its place, text and time. */
  stampStyle?: Partial<Omit<StampProps, 'x' | 'y' | 'text' | 'at' | 't'>>;
  pace?: number;
};

export type PhraseCardLayout = {
  w: number; h: number;
  /** The phrase broken into lines, each with its width. */
  lines: { text: string; w: number }[];
  /** Top of the first phrase line from the card's top edge, the height of one line, and the type size. */
  phraseY: number; lineH: number; size: number;
};

/** Default width of a card and height of its head. */
export const CARD_W = 440;
export const CARD_HEAD = 58;
const PAD_X = 26;
const PAD_TOP = 22;
const PAD_FOOT = 26;
/** Room at the foot of a card for its stamp. */
const STAMP_ROOM = 84;

type Measure = (text: string, style: React.CSSProperties) => { w: number; h: number };
type LayoutInput = Pick<PhraseCardProps, 'w' | 'phrase' | 'size' | 'fit' | 'stampRoom' | 'stamp'>;

function phraseStyle(th: Theme, size: number): React.CSSProperties {
  return { ...textStyle(th, 'l'), fontSize: size, lineHeight: 1, whiteSpace: 'pre' };
}

/** The size of a card and the lines of its phrase. */
export function phraseCardLayout({ w = CARD_W, phrase, size, fit = true, stampRoom, stamp }: LayoutInput, th: Theme, measure: Measure): PhraseCardLayout {
  const room = w - 2 * PAD_X;
  const breakAt = (px: number) => {
    const style = phraseStyle(th, px);
    const out: { text: string; w: number }[] = [];
    let line = '';
    for (const word of phrase.split(' ')) {
      const next = line ? line + ' ' + word : word;
      if (line && measure(next, style).w > room) { out.push({ text: line, w: measure(line, style).w }); line = word; }
      else line = next;
    }
    if (line) out.push({ text: line, w: measure(line, style).w });
    return out;
  };
  // A phrase stands on two lines at most: when it would need a third, it steps down a size (twice at most).
  let px = Math.max(MIN_TYPE, size ?? 44);
  let lines = breakAt(px);
  for (let i = 0; i < 2 && size === undefined && fit && lines.length > 2 && px - 4 >= MIN_TYPE; i++) {
    px -= 4;
    lines = breakAt(px);
  }
  const lineH = Math.round(px * 1.18);
  const phraseY = CARD_HEAD + PAD_TOP;
  const h = phraseY + lines.length * lineH + PAD_FOOT + ((stampRoom ?? stamp !== undefined) ? STAMP_ROOM : 0);
  return { w, h, lines, phraseY, lineH, size: px };
}

/** The layout of a card, measured with the video's display face. */
export function usePhraseCardLayout(props: LayoutInput): PhraseCardLayout {
  return phraseCardLayout(props, useTheme(), useTextSize());
}

/** The card. */
export function PhraseCard({ x, y, w, head, n, phrase, size, fit, struckAt, stampRoom, stamp, at, underline, dim = 1, t, fill = 'surface', edge = 'line',
  rule = 'line', ink = 'ink', bare = false, stampStyle = {}, pace = 1 }: PhraseCardProps) {
  const th = useTheme();
  const measure = useTextSize();
  const L = phraseCardLayout({ w, phrase, size, fit, stampRoom, stamp }, th, measure);
  const s = th.stroke;
  const strong = strongOf(th);
  const tone = (hex: string) => toward(th, hex, 0.4 + 0.6 * dim);
  const gone = struckAt === undefined ? 0 : prog(t, struckAt, DUR.morph * pace * 0.78, 'move');
  const phraseInk = inkAt(th, Math.min(dim, mix(1, 0.3, gone)));
  const wordInk = dim >= 1 ? th.ink2 : inkAt(th, dim);
  const stampText: React.CSSProperties = { ...textStyle(th, 's'), fontWeight: strong };
  const stampW = stamp ? measure(stamp.text, stampText).w + 44 + 4 * (stampStyle.stroke ?? s) + 10 : 0;
  // The underline: under the first line that holds the word, from the width of what stands before it.
  const ulLine = underline ? L.lines.findIndex((line) => line.text.includes(underline.text)) : -1;
  const ulStyle = phraseStyle(th, L.size);
  const ulFrom = ulLine < 0 ? 0 : measure(L.lines[ulLine].text.slice(0, L.lines[ulLine].text.indexOf(underline!.text)), ulStyle).w;
  const ulLen = ulLine < 0 ? 0 : measure(underline!.text, ulStyle).w;
  const ulShown = !underline || underline.at === undefined ? 1 : prog(t, underline.at, DUR.enter * pace, 'move');
  const headSize = textStyle(th, 's').fontSize as number;

  return (
    <FadeIn at={at} t={t} pace={pace}>
      <Sheet x={x} y={y} w={L.w} h={L.h} dim={dim} fill={fill} edge={edge}>
        {bare ? null
          : <div style={{ position: 'absolute', left: s, top: CARD_HEAD - Math.max(2, s - 1), width: L.w - 2 * s, height: Math.max(2, s - 1), background: tone(paint(th, rule)) }} />}
        <div style={{ position: 'absolute', left: PAD_X, top: s + (bare ? 6 : 0), height: CARD_HEAD - s, display: 'flex', alignItems: 'center',
          gap: 12, ...textStyle(th, 's'), fontWeight: strong, lineHeight: 1, whiteSpace: 'pre', color: wordInk }}>
          <span>{head}</span>
          {n !== undefined ? <span style={{ ...dataStyle(th, headSize), lineHeight: 1, color: wordInk }}>{String(n)}</span> : null}
        </div>
        {L.lines.map((line, j) => (
          <div key={j} style={{ position: 'absolute', left: PAD_X, top: L.phraseY + j * L.lineH, height: L.lineH, display: 'flex',
            alignItems: 'center', ...phraseStyle(th, L.size), color: phraseInk }}>
            {line.text}
          </div>
        ))}
        {ulLine >= 0 && ulShown > 0 ? (
          <div style={{ position: 'absolute', left: PAD_X + ulFrom, top: L.phraseY + ulLine * L.lineH + L.lineH - Math.max(3, s) + 1,
            width: ulLen * ulShown, height: Math.max(3, s), background: tone(paint(th, ink)) }} />
        ) : null}
      </Sheet>
      {struckAt !== undefined ? L.lines.map((line, j) => (
        <Strike key={j} x={x + PAD_X - 6} y={y + L.phraseY + j * L.lineH + L.lineH * 0.54} len={line.w + 12}
          at={struckAt + j * (DUR.enter * pace) * 0.6} t={t} dim={dim} color={ink} pace={pace} />
      )) : null}
      {stamp ? <Stamp x={x + L.w - PAD_X - stampW / 2} y={y + L.h - PAD_FOOT - STAMP_ROOM / 2 + 8} text={stamp.text} at={stamp.at} t={t} pace={pace} {...stampStyle} /> : null}
    </FadeIn>
  );
}
