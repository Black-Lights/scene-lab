/**
 * @file kit/capacity.tsx
 * @description The capacity bar (work package A2): a fixed outline whose whole width stands for `total` units (a
 *   tank's litres, a disk's bytes, a day's hours), with the parts that fill it as segments at true scale, from the
 *   left, each in its own colour. A part is never drawn under a few pixels wide, so a part of a few units can still
 *   be seen against a total of thousands. The total is written as a dimension: a thin line under the outline from
 *   end to end with end ticks, the number on it, and an optional note under the number. `callout` joins the first
 *   part to a larger drawing of it elsewhere: two thin lines from the two ends of that drawing's lower edge to the
 *   part's upper corners, so the size stays true and the eye still finds the part.
 *   capacityBarLayout() gives a scene the place of the outline, of every part and of the dimension.
 *   A pure function of its props, the theme and scene time `t`. Positions are in the parent's units.
 */
import React from 'react';
import { DUR } from '../motion';
import { useTheme } from '../theme';
import type { Theme } from '../theme';
import { paint } from './paint';
import { mixColour, prog } from './time';
import { MIN_TYPE, dataStyle, textStyle } from './type';

export type CapacityPart = { id: string;
  /** Its fill, a colour reference. */
  color: string;
  /** How many units of the total the part takes. */
  size: number };

export type CapacityBarProps = {
  /** Top-left corner of the outline, and its width. */
  x: number; y: number; w: number;
  /** Height of the outline (default CAPACITY_H). */
  h?: number;
  /** The total in units, and the same number as it is written ("131,072", "2 TB"). */
  total: number;
  number: string;
  /** A second line under the number, quieter. */
  note?: string;
  /** The parts, from the left. */
  parts: CapacityPart[];
  /** The lower edge of a larger drawing of the first part: its left end, its y and its width. */
  callout?: { x: number; y: number; w: number };
  /** When the outline and its parts arrive (default: from the start), and when the dimension does. */
  at?: number;
  numberAt?: number;
  dim?: number;
  t: number;
  /** Line width (default th.stroke) and the outline's width (the larger of the two). */
  stroke?: number; heavy?: number;
  pace?: number;
};

export type CapacityBarLayout = {
  outline: { x: number; y: number; w: number; h: number };
  /** One per part: its left edge and width, in the same units as x. */
  parts: { id: string; x: number; w: number }[];
  /** The dimension: the y of its line, the top of the number and of the note. */
  lineY: number; numberY: number; noteY: number;
  /** The whole height, from the top of the outline to the foot of the note (or of the number). */
  h: number;
};

/** Height of the outline, and the type size of the number. */
export const CAPACITY_H = 120;
export const CAPACITY_NUMBER = 54;

const DIM_GAP = 22;
const NOTE_GAP = 10;
const END_TICK = 22;
const NUMBER_PAD = 26;

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const toward = (th: Theme, hex: string, d: number) => mixColour(th.bg, hex, clamp(d));

type LayoutInput = Pick<CapacityBarProps, 'x' | 'y' | 'w' | 'h' | 'total' | 'parts' | 'note'>;

/** Where the outline, the parts and the dimension stand, for a line width and an outline width. */
export function capacityBarLayout({ x, y, w, h = CAPACITY_H, total, parts, note }: LayoutInput, stroke: number, heavy: number = stroke): CapacityBarLayout {
  const edge = Math.max(stroke, heavy);
  const inner = w - 2 * edge;
  const least = Math.max(3, stroke * 1.5);
  let px = x + edge;
  const out = parts.map((p) => {
    const pw = Math.min(Math.max(least, (inner * p.size) / Math.max(1, total)), Math.max(0, x + w - edge - px));
    const place = { id: p.id, x: px, w: pw };
    px += pw;
    return place;
  });
  const numberY = y + h + DIM_GAP;
  const lineY = numberY + CAPACITY_NUMBER / 2;
  const noteY = numberY + CAPACITY_NUMBER + NOTE_GAP;
  return { outline: { x, y, w, h }, parts: out, lineY, numberY, noteY,
    h: (note ? noteY + MIN_TYPE * 1.25 : numberY + CAPACITY_NUMBER) - y };
}

/** The capacity bar: outline, parts at true scale, the total as a dimension. */
export function CapacityBar(props: CapacityBarProps) {
  const { x, y, w, number, note, parts, callout, at, numberAt, dim = 1, t, pace = 1 } = props;
  const th = useTheme();
  const s = props.stroke ?? th.stroke;
  const heavy = props.heavy ?? s;
  const L = capacityBarLayout(props, s, heavy);
  const micro = DUR.micro * pace;
  const edge = Math.max(s, heavy);
  const thin = Math.max(1.5, s / 2);
  const shown = at === undefined ? 1 : prog(t, at, micro, 'enter');
  const counted = numberAt === undefined ? 1 : prog(t, numberAt, micro, 'enter');
  const drawn = at === undefined ? 1 : prog(t, at + micro, DUR.enter * pace * 1.4, 'move');
  if (shown <= 0) return null;
  const d = 0.4 + 0.6 * dim;
  // A thing arrives by lighting from the line tone to its own.
  const lightTo = (hex: string, p: number) => toward(th, mixColour(th.line, hex, p), d);
  const first = L.parts[0];
  const h = L.outline.h;
  const rule = lightTo(th.ink2, counted);
  return (
    <>
      <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, boxSizing: 'border-box',
        border: `${edge}px solid ${lightTo(th.ink, shown)}` }} />
      {L.parts.map((p, i) => (
        <div key={p.id} style={{ position: 'absolute', left: p.x, top: y + edge, width: p.w, height: h - 2 * edge,
          background: lightTo(paint(th, parts[i].color), shown) }} />
      ))}
      {callout && first && drawn > 0 ? (
        <svg width={1} height={1} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}>
          {[[callout.x + thin / 2, first.x + thin / 2], [callout.x + callout.w - thin / 2, first.x + first.w - thin / 2]].map(([fromX, toX], i) => {
            const len = Math.hypot(toX - fromX, y - callout.y);
            return <line key={i} x1={fromX} y1={callout.y} x2={toX} y2={y} stroke={toward(th, th.ink2, d)} strokeWidth={thin}
              strokeDasharray={len} strokeDashoffset={len * (1 - drawn)} />;
          })}
        </svg>
      ) : null}
      {counted > 0 ? (
        <>
          <div style={{ position: 'absolute', left: x, top: L.lineY - thin / 2, width: w, height: thin, background: rule }} />
          {[x, x + w - thin].map((ex) => (
            <div key={ex} style={{ position: 'absolute', left: ex, top: L.lineY - END_TICK / 2, width: thin, height: END_TICK, background: rule }} />
          ))}
          <div style={{ position: 'absolute', left: x + w / 2, top: L.numberY, height: CAPACITY_NUMBER, transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center', padding: `0 ${NUMBER_PAD}px`, background: th.bg, ...dataStyle(th, CAPACITY_NUMBER), lineHeight: 1,
            whiteSpace: 'pre', color: lightTo(th.ink, counted) }}>
            {number}
          </div>
          {note ? (
            <div style={{ position: 'absolute', left: x + w / 2, top: L.noteY, transform: 'translateX(-50%)', ...textStyle(th, 's'), lineHeight: 1.15,
              whiteSpace: 'pre', color: lightTo(th.ink2, counted) }}>
              {note}
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}
