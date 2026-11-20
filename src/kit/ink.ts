/**
 * @file kit/ink.ts
 * @description Private helpers of the drawn 2D blocks (codeblock, ledger, lanes, phrasecard, pane, chart): how a colour
 *   steps back toward the ground, the text ink by focus, the theme's lit tone. Not in the barrel: scene code mixes
 *   colours with mixColour() and reads focus with w.dim(). parts2d.tsx, textcard.tsx and capacity.tsx keep their own
 *   copies of the same one-liners.
 */
import type { Theme } from '../theme';
import { paint } from './paint';
import { mixColour } from './time';

export const clamp = (n: number) => Math.max(0, Math.min(1, n));
/** A colour stepped back toward the ground: d = 1 the colour itself, 0 the ground. */
export const toward = (th: Theme, hex: string, d: number) => mixColour(th.bg, hex, clamp(d));
/** Text ink by focus: the full ink at dim 1, the back ink at dim 0.3. */
export const inkAt = (th: Theme, d: number) => mixColour(th.back, th.ink, clamp((d - 0.3) / 0.7));
/** The band of a lit line: `ref` when given, else the theme's lit tone, else the fill a little toward the ink. */
export const litOf = (th: Theme, fill: string, ref?: string) =>
  ref ? paint(th, ref) : th.lit ? paint(th, th.lit) : mixColour(fill, paint(th, 'ink'), 0.12);
/** The weight of a strong word in the text face. */
export const strongOf = (th: Theme) => th.weight?.strong ?? 700;
