/**
 * @file kit/type.ts
 * @description Type for scene code (architecture sections 1 and 6.1). Three sizes and no others, in layout
 *   pixels of the 1920x1080 frame: TYPE = { s: 30, m: 40, l: 54 }. Nothing on screen is smaller than 28 px,
 *   because these videos are also watched on a phone. textStyle() is running text and labels, dataStyle() is
 *   numbers: the data face with tabular figures, so a value that counts does not jitter sideways.
 *   useTextSize() measures text for layout (labels, callouts). The measurement is safe in a free or world
 *   scene because the preload gate (preload.ts) mounts a scene only after the video's typefaces have arrived:
 *   a width taken earlier would be the width of a fallback face, and differ from one browser tab to the next.
 *   useCharWidth() is the advance of one character of the data face (monospaced), for code laid out in columns;
 *   wrapText() breaks text into lines of a number of characters, wrapToWidth() into lines of a measured width.
 */
import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { useTheme } from '../theme';
import type { Theme } from '../theme';
import { fontsPresent } from './preload';

export const TYPE = { s: 30, m: 40, l: 54 } as const;
export type TypeSize = keyof typeof TYPE;

/** The smallest type the engine lets on screen, in layout pixels. */
export const MIN_TYPE = 28;

const px = (size: TypeSize | number): number => (typeof size === 'number' ? Math.max(MIN_TYPE, size) : TYPE[size] ?? TYPE.m);

/** Running text and labels in the video's design: 's' and 'm' in the text face, 'l' in the display face. */
export const textStyle = (th: Theme, size: TypeSize = 'm'): CSSProperties => ({
  fontFamily: size === 'l' ? th.font.display : th.font.text,
  fontWeight: size === 'l' ? th.weight.display : th.weight.text,
  fontSize: px(size),
  lineHeight: size === 'l' ? 1.15 : 1.25,
  color: th.ink,
});

/** Numbers: the data face with tabular figures. `size` is 's', 'm', 'l' or pixels (never below 28). */
export const dataStyle = (th: Theme, size: TypeSize | number = 'm'): CSSProperties => ({
  fontFamily: th.font.data,
  fontWeight: th.weight.text,
  fontSize: px(size),
  lineHeight: 1.1,
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
  color: th.ink,
});

const bare = (family: string) => family.trim().replace(/^["']|["']$/g, '');

let pen: CanvasRenderingContext2D | null | undefined;
const widths = new Map<string, number>();

/** Width in layout pixels of one line of text in a face. An estimate from the size where no canvas exists. */
const widthOf = (text: string, family: string, size: number, weight: number | string, keep: boolean): number => {
  const font = `${weight} ${size}px "${bare(family)}"`;
  const key = font + '|' + text;
  const hit = widths.get(key);
  if (hit !== undefined) return hit;
  if (pen === undefined) pen = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  if (!pen) return text.length * size * 0.55;
  pen.font = font;
  const w = pen.measureText(text).width;
  if (keep) widths.set(key, w);
  return w;
};

/** What to measure: the text and the font part of a style (textStyle() and dataStyle() return these keys). */
export type TextSize = { w: number; h: number };
export type Measure = (text: string, style: CSSProperties) => TextSize;

/**
 * A function that measures one line of text in a style, in layout pixels: `const measure = useTextSize();
 * measure('Test bench', textStyle(th, 'm'))`. A width is remembered only once the theme's typefaces are in
 * the document, so a measurement taken too early (outside a free or world scene) is never kept.
 */
export const useTextSize = (): Measure => {
  const th = useTheme();
  const ready = fontsPresent([th.font.text, th.font.display, th.font.data].filter(Boolean));
  return useMemo<Measure>(
    () => (text, style) => {
      const size = typeof style.fontSize === 'number' ? style.fontSize : parseFloat(String(style.fontSize ?? TYPE.m)) || TYPE.m;
      const line = typeof style.lineHeight === 'number' ? style.lineHeight : 1.25;
      return { w: widthOf(text, String(style.fontFamily ?? 'sans-serif'), size, style.fontWeight ?? 400, ready), h: size * line };
    },
    [ready],
  );
};

/**
 * The advance of one character of the data face (monospaced) at a size in pixels (default MIN_TYPE), in layout
 * pixels: `const chW = useCharWidth(30)`; a code line of n characters is n * chW wide, so columns can be counted.
 */
export const useCharWidth = (size?: number): number => {
  const th = useTheme();
  const measure = useTextSize();
  return measure('0000000000', dataStyle(th, size ?? MIN_TYPE)).w / 10;
};

/** Breaks a text into lines of at most `cols` characters, at spaces; a word longer than a line is cut. */
export function wrapText(text: string, cols: number): string[] {
  const n = Math.max(1, Math.floor(cols));
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    let w = word;
    while (w.length > n) {
      if (line) { lines.push(line); line = ''; }
      lines.push(w.slice(0, n));
      w = w.slice(n);
    }
    if (!line) line = w;
    else if (line.length + 1 + w.length <= n) line += ' ' + w;
    else { lines.push(line); line = w; }
  }
  if (line || !lines.length) lines.push(line);
  return lines;
}

/**
 * Breaks a text into lines no wider than `w` layout pixels in a style, at spaces (a word wider than `w` keeps its
 * own line), measured with the video's typefaces: `wrapToWidth(measure, text, textStyle(th, 's'), 600)`. The
 * number of lines times the line height is the height the text takes. A newline in the text always breaks.
 */
export function wrapToWidth(measure: Measure, text: string, style: CSSProperties, w: number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const next = line ? line + ' ' + word : word;
      if (line && measure(next, style).w > w) { lines.push(line); line = word; }
      else line = next;
    }
    lines.push(line);
  }
  return lines;
}
