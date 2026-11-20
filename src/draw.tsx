/**
 * @file draw.tsx
 * @description Drawing primitives shared by the templates: icon glyphs (inline SVG from Iconify, resolved by
 *   make.py), paint swatches, arrows that draw on, and a payload that travels along a straight path.
 *   All geometry is in the 1920x1080 layout space; the master render scales it 2x, so strokes stay crisp.
 */
import React from 'react';
import type { CSSProperties } from 'react';
import { evolvePath } from '@remotion/paths';
import { EASE, clamp01 } from './motion';

export type IconData = { body: string; width: number; height: number; id?: string; fallback?: boolean };

/**
 * An Iconify icon drawn in currentColor. `size` is the box height in px; width follows the icon's ratio.
 * Works in HTML and, with x/y (top-left corner), nested inside an <svg>.
 */
export const Glyph = ({ icon, size, color, style, x, y }: {
  icon?: IconData | null; size: number; color?: string; style?: CSSProperties; x?: number; y?: number;
}) => {
  if (!icon || typeof icon !== 'object' || !icon.body) return null;
  const w = (size * icon.width) / icon.height;
  return (
    <svg
      x={x}
      y={y}
      viewBox={`0 0 ${icon.width} ${icon.height}`}
      width={w}
      height={size}
      style={{ color, flex: 'none', display: 'block', overflow: 'visible', ...style }}
      dangerouslySetInnerHTML={{ __html: icon.body }}
    />
  );
};

/** Straight arrow from (x1,y) to (x2,y) that draws on with progress p (0..1). Filled head = a message sent. */
export const HArrow = ({ x1, x2, y, p, color, width, dashed, head = 14 }: {
  x1: number; x2: number; y: number; p: number; color: string; width: number; dashed?: boolean; head?: number;
}) => {
  const dir = Math.sign(x2 - x1) || 1;
  const end = x2 - dir * head * 0.9;
  const tip = x1 + (end - x1) * clamp01(p); // the line grows from the sender: works for solid and dashed strokes
  const headOn = clamp01((p - 0.85) / 0.15);
  if (p <= 0) return null;
  return (
    <g>
      <path d={`M ${x1} ${y} L ${tip} ${y}`} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round"
        strokeDasharray={dashed ? `${width * 3.2} ${width * 2.6}` : undefined} />
      <path
        d={`M ${x2} ${y} L ${x2 - dir * head * 1.5} ${y - head * 0.75} L ${x2 - dir * head * 1.5} ${y + head * 0.75} Z`}
        fill={color}
        opacity={headOn}
      />
    </g>
  );
};

/** Any SVG path drawing on with progress p (0..1): @remotion/paths evolvePath, for curves and polylines. */
export const DrawPath = ({ d, p, color, width, dashed, style }: {
  d: string; p: number; color: string; width: number; dashed?: boolean; style?: CSSProperties;
}) => {
  if (p <= 0 || !d) return null;
  const ev = evolvePath(clamp01(p), d);
  return (
    <path d={d} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" strokeLinejoin="round"
      strokeDasharray={dashed ? `${width * 3.2} ${width * 2.6}` : ev.strokeDasharray}
      strokeDashoffset={dashed ? 0 : ev.strokeDashoffset}
      opacity={dashed ? clamp01(p * 1.5) : 1} style={style} />
  );
};

/** Where an eased travel along [x1, x2] is at time progress s (0..1), and the inverse (for "when does it pass x"). */
export const travelX = (x1: number, x2: number, s: number) => x1 + (x2 - x1) * EASE.move(clamp01(s));
export const passTime = (x1: number, x2: number, x: number) => {
  const f = (x - x1) / (x2 - x1);
  let lo = 0, hi = 1;
  for (let k = 0; k < 30; k++) {
    const mid = (lo + hi) / 2;
    if (EASE.move(mid) < f) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};
