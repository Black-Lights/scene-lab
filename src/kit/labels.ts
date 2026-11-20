/**
 * @file kit/labels.ts
 * @description Where labels go and what they look like (architecture sections 6.5 and 6.7).
 *   FILLED BY WORK PACKAGE A1 (3D looks and labels). What is here now is the core's stand-in, enough to render
 *   and judge scenes: solveLabels() puts every label on the side its spec asks for (above, when it asks for
 *   none) and keeps it inside the given bounds, with no test for overlaps; labelLook() is plain text with a
 *   halo in the ground colour, the way a map sets a name over a drawing.
 *   The contract A1 keeps, because overlay.tsx calls it: the two function signatures and the types below.
 *   solveLabels is called once per shot, with every label of the scene as the camera shows it at rest; the
 *   overlay moves the labels between two shots with the camera's own progress, so a solver never has to think
 *   about time. It is a pure function: the same labels and bounds always give the same spots.
 */
import type { CSSProperties } from 'react';
import { halo } from '../theme';
import type { Theme } from '../theme';
import { TYPE } from './type';
import type { TypeSize } from './type';

export type Side = 'top' | 'right' | 'bottom' | 'left';
/** x, y, width, height in layout pixels. */
export type LabelRect = [number, number, number, number];

/** One label as the solver sees it: layout pixels on the frame, at one camera pose. */
export type LabelBox = {
  id: string;
  /** The middle of the thing the label names. */
  x: number;
  y: number;
  /** The rectangle the thing covers on the frame; zero size for a point. */
  box: LabelRect;
  /** The label's own size, measured in its typeface. */
  w: number;
  h: number;
  /** The side the spec asks for. A label that names none may go on any of the four. */
  side?: Side;
  /** When the label is on screen, in scene seconds: two labels that never meet need not avoid each other. */
  at: number;
  until: number;
};

/** Where one label goes: the top-left corner of its box, the side it ended up on, and whether it is left out. */
export type LabelSpot = { x: number; y: number; side: Side; hidden: boolean };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The spot of a label of size (w, h) on one side of a box, `gap` pixels away from it. */
export const spotBeside = (box: LabelRect, w: number, h: number, side: Side, gap: number): { x: number; y: number } => {
  const [bx, by, bw, bh] = box;
  if (side === 'top') return { x: bx + bw / 2 - w / 2, y: by - gap - h };
  if (side === 'bottom') return { x: bx + bw / 2 - w / 2, y: by + bh + gap };
  if (side === 'left') return { x: bx - gap - w, y: by + bh / 2 - h / 2 };
  return { x: bx + bw + gap, y: by + bh / 2 - h / 2 };
};

/**
 * A spot for every label, by id. `bounds` is the part of the frame labels must stay inside (the content area,
 * cut to the stage); `gap` is the room between a label and the thing it names.
 * Stand-in: fixed side, kept inside the bounds, hidden only when the thing itself is outside them.
 */
export const solveLabels = (labels: LabelBox[], bounds: LabelRect, gap: number): Record<string, LabelSpot> => {
  const [x0, y0, bw, bh] = bounds;
  const out: Record<string, LabelSpot> = {};
  for (const l of labels) {
    const side: Side = l.side ?? 'top';
    const at = spotBeside(l.box, l.w, l.h, side, gap);
    const hidden = l.x < x0 || l.x > x0 + bw || l.y < y0 || l.y > y0 + bh;
    out[l.id] = { x: clamp(at.x, x0, Math.max(x0, x0 + bw - l.w)), y: clamp(at.y, y0, Math.max(y0, y0 + bh - l.h)), side, hidden };
  }
  return out;
};

/** What a label looks like. overlay.tsx measures and draws from these numbers and nothing else. */
export type LabelLook = {
  /** The label's own line: fontFamily, fontSize (a number), fontWeight, lineHeight (a number), color. */
  text: CSSProperties;
  /** The second, quieter line. Same keys. */
  sub: CSSProperties;
  /** The box behind both lines: background, border radius. Its padding is padX and padY, not a CSS padding. */
  plate: CSSProperties;
  padX: number;
  padY: number;
  /** Room between a label and the thing it names. */
  gap: number;
  /** The line from a label to its thing, and the dot where it ends. */
  leader: { color: string; width: number; dot: number };
};

export const labelLook = (th: Theme, size: TypeSize = 'm'): LabelLook => ({
  text: { fontFamily: th.font.text, fontSize: TYPE[size] ?? TYPE.m, fontWeight: th.weight.strong, lineHeight: 1.15, color: th.ink, textShadow: halo(th.bg, 3) },
  sub: { fontFamily: th.font.text, fontSize: TYPE.s, fontWeight: th.weight.text, lineHeight: 1.2, color: th.ink2, textShadow: halo(th.bg, 3) },
  plate: {},
  padX: 6,
  padY: 2,
  gap: 14,
  leader: { color: th.ink, width: th.stroke, dot: th.stroke * 2.2 },
});
