/**
 * @file kit/lanes.tsx
 * @description Lanes (work package A2): who does what over time. One lane per actor, time runs down, and an arrow is a
 *   message or a hand-over that travels from one lane to another. A lane is a band with a lifeline down its middle and a
 *   name head on top; the lanes stand spread over the width, so that a long chip fits between two lifelines. An arrow
 *   draws on from its sender's lifeline at `at`; its label stands above the line, and what it carries (a chip, a
 *   LedgerSlip) slides out of the sender's lifeline and rests on the middle of the line. An arrow whose `from` and `to`
 *   are one lane is a step on that lane: a loop that leaves the lifeline and comes back, with its label beside it. A
 *   lane box (a checkpoint, a filter) sits astride the edge of its lane that faces another lane: at the top, under the
 *   head, or on one or more arrows, which then pass behind it. With focus 'latest' an arrow steps back when a later one
 *   starts. lanesLayout() gives a scene the x of every lane and the y of every arrow, to pin a row or a note.
 *   Lifted from an earlier video's scene code, topic-free. A pure function of its props, the theme and `t`.
 */
import React from 'react';
import { DUR } from '../motion';
import { useTheme } from '../theme';
import type { Vec2 } from './camera';
import { inkAt, litOf, strongOf, toward } from './ink';
import { paint } from './paint';
import { Arrow2 } from './parts2d';
import { mix, mixColour, prog } from './time';
import { textStyle, useTextSize } from './type';

export type LaneBox = {
  id: string;
  name: string;
  /** The id of the lane this box faces: it sits astride the edge of its own lane on that side. */
  edge: string;
  /** The id of an arrow, or of several: the box stands on that arrow's line, once per arrow, and arrives with it (a
   *  station every such message crosses). Without it the box stands at the top of the edge. */
  on?: string | string[];
};

export type Lane = { id: string; name: string; boxes?: LaneBox[];
  /** A lane picked out: its head's outline (at `heavy`) and its lifeline take this colour. */
  color?: string };

export type LaneArrow = {
  id: string;
  /** Lane ids. The same id twice is a step on that lane. */
  from: string; to: string;
  /** Scene seconds at which it starts to draw on. */
  at: number;
  label?: string;
  /** The arrow's colour; default 'ink'. */
  color?: string;
  /** What the message carries, resting on the middle of the line: an element in normal flow (a Chip without x and y,
   *  a box with its own width), or a function of the arrow's dim (1 in focus, 0.3 stepped back). */
  carry?: React.ReactNode | ((dim: number) => React.ReactNode);
  /** Height of what the arrow carries, when it is taller than a chip: its label stands above it. */
  carryH?: number;
  /** Height of the arrow's row before the rows are spread over the lanes' height; default by what it holds. */
  row?: number;
};

export type LanesProps = {
  /** Top-left corner; the lanes are never placed inside a moved or scaled parent. */
  x: number; y: number; w: number; h: number;
  lanes: Lane[];
  arrows: LaneArrow[];
  /** 'latest' (default): an arrow steps back when a later one starts. 'all': nothing steps back. Or the ids in focus. */
  focus?: 'latest' | 'all' | string[];
  /** Width of a lane's band and head. */
  laneW?: number;
  t: number;
  /** The band of a lane (default the theme's lane tone, else 'surface'), the lifeline (default 'line'), the heads and
   *  boxes (fill 'surface', outline 'line'), and the tone a head takes while its lane sends (default the lit tone). */
  band?: string; lifeline?: string; headFill?: string; headEdge?: string; litColor?: string;
  /** While a lane sends an arrow in focus, its lifeline turns to ink and its head to the lit tone; default true. */
  lightActive?: boolean;
  /** Width of the lifelines and the arrows; default 1.5 x th.stroke. */
  heavy?: number;
  pace?: number;
};

export type LanesLayout = {
  laneW: number;
  /** The x of each lane's lifeline. */
  laneX: Record<string, number>;
  /** The side a lane's steps and their labels turn to: 1 right, -1 left (toward the middle of the picture). */
  side: Record<string, 1 | -1>;
  /** The y of each arrow's line; for a step, of the place where its loop leaves the lifeline. */
  arrowY: Record<string, number>;
  /** The x where an arrow's label and what it carries rest: half way between its two lifelines. */
  mid: Record<string, number>;
  /** The centre of each lane box; a box that stands on several arrows also has one entry `id@arrow` each. */
  box: Record<string, { x: number; y: number }>;
  /** The band of y that holds the arrows. */
  top: number; bottom: number;
};

/** Height of a lane's name head, default width of a lane, height of a lane box, and the size of a step's loop. */
export const LANE_HEAD = 64;
export const LANE_W = 280;
export const LANE_BOX_H = 56;
export const STEP_W = 64;
export const STEP_H = 44;

const W = 1920;
const H = 1080;
const ROW_PLAIN = 84;
const ROW_CARRY = 100;
const ROW_STEP = 100;
const LABEL_GAP = 12;
/** How far a label stands above the line of an arrow that carries something (half a chip and a little air). */
const CARRY_HALF = 34;

type LayoutInput = Pick<LanesProps, 'x' | 'y' | 'w' | 'h' | 'lanes' | 'arrows' | 'laneW'>;

/** Where everything stands, without the theme: the lanes' lifelines, the arrows' lines, the boxes. */
export function lanesLayout({ x, y, w, h, lanes, arrows, laneW = LANE_W }: LayoutInput): LanesLayout {
  const n = lanes.length;
  const laneX: Record<string, number> = {};
  const side: Record<string, 1 | -1> = {};
  lanes.forEach((l, i) => {
    laneX[l.id] = n > 1 ? x + laneW / 2 + (i * (w - laneW)) / (n - 1) : x + w / 2;
    side[l.id] = n > 1 && i > (n - 1) / 2 ? -1 : 1;
  });
  for (const a of arrows) {
    if (laneX[a.from] === undefined || laneX[a.to] === undefined) {
      throw new Error(`Lanes: arrow "${a.id}" names a lane that is not declared (lanes: ${lanes.map((l) => l.id).join(', ')})`);
    }
  }
  const boxes = lanes.flatMap((l) => (l.boxes ?? []).map((b) => ({ ...b, lane: l.id })));
  const headRoom = boxes.some((b) => !b.on) ? 14 + LANE_BOX_H + 10 : 14;
  const top = y + LANE_HEAD + headRoom;
  const bottom = y + h - 14;
  const heights = arrows.map((a) => a.row ?? (a.from === a.to ? ROW_STEP : a.carry ? ROW_CARRY : ROW_PLAIN));
  const k = (bottom - top) / (heights.reduce((s, v) => s + v, 0) || 1);
  const arrowY: Record<string, number> = {};
  const mid: Record<string, number> = {};
  let cy = top;
  arrows.forEach((a, i) => {
    const rh = heights[i] * k;
    const step = a.from === a.to;
    const anchor = !step && !a.carry && a.label ? 0.66 : 0.5;
    arrowY[a.id] = Math.round(cy + rh * anchor - (step ? STEP_H / 2 : 0));
    mid[a.id] = (laneX[a.from] + laneX[a.to]) / 2;
    cy += rh;
  });
  const box: Record<string, { x: number; y: number }> = {};
  for (const b of boxes) {
    const dir = (laneX[b.edge] ?? laneX[b.lane]) < laneX[b.lane] ? -1 : 1;
    const on = b.on === undefined ? [] : Array.isArray(b.on) ? b.on : [b.on];
    const bx = laneX[b.lane] + (dir * laneW) / 2;
    box[b.id] = { x: bx, y: on.length ? arrowY[on[0]] : y + LANE_HEAD + 14 + LANE_BOX_H / 2 };
    for (const a of on) box[`${b.id}@${a}`] = { x: bx, y: arrowY[a] };
  }
  return { laneW, laneX, side, arrowY, mid, box, top, bottom };
}

/** The first `dist` pixels of a path of straight pieces, the point reached, and the direction there. */
function along(pts: Vec2[], dist: number): { drawn: Vec2[]; tip: Vec2; dir: Vec2 } {
  const drawn: Vec2[] = [pts[0]];
  let tip: Vec2 = pts[0];
  let dir: Vec2 = [1, 0];
  let left = dist;
  for (let i = 0; i + 1 < pts.length && left > 0; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const d = Math.min(left, len);
    dir = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    tip = [a[0] + dir[0] * d, a[1] + dir[1] * d];
    drawn.push(tip);
    left -= d;
  }
  return { drawn, tip, dir };
}

/** A step on one lane: a loop that leaves the lifeline at (x, y), turns to `side` and comes back lower. */
function Step({ x, y, side, colour, stroke, p }: { x: number; y: number; side: 1 | -1; colour: string; stroke: number; p: number }) {
  if (p <= 0) return null;
  const pts: Vec2[] = [[x, y], [x + side * STEP_W, y], [x + side * STEP_W, y + STEP_H], [x, y + STEP_H]];
  const total = 2 * STEP_W + STEP_H;
  const headLen = stroke * 3.6;
  const line = along(pts, Math.max(0, total * p - headLen * 0.8));
  const { tip, dir } = along(pts, total * p);
  const half = headLen * 0.5;
  const base: Vec2 = [tip[0] - dir[0] * headLen, tip[1] - dir[1] * headLen];
  const tri: Vec2[] = [tip, [base[0] - dir[1] * half, base[1] + dir[0] * half], [base[0] + dir[1] * half, base[1] - dir[0] * half]];
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}>
      <polyline points={line.drawn.map((q) => q.join(',')).join(' ')} fill="none" stroke={colour} strokeWidth={stroke} strokeLinejoin="miter" />
      {total * p >= headLen ? <polygon points={tri.map((q) => q.join(',')).join(' ')} fill={colour} /> : null}
    </svg>
  );
}

/** The lanes with their heads, boxes and arrows. */
export function Lanes(props: LanesProps) {
  const { y, h, lanes, arrows, focus = 'latest', t, band: bandRef, lifeline = 'line', headFill = 'surface', headEdge = 'line', litColor,
    lightActive = true, heavy, pace = 1 } = props;
  const th = useTheme();
  const measure = useTextSize();
  const L = lanesLayout(props);
  const laneW = L.laneW;
  const life = heavy ?? th.stroke * 1.5;
  const band = paint(th, bandRef ?? th.lane ?? 'surface');
  const lifeBase = paint(th, lifeline);
  const fill = paint(th, headFill);
  const sheetEdge = paint(th, headEdge);
  const lit = litOf(th, fill, litColor);
  const travel = DUR.morph * pace;
  const settle = DUR.morph * pace * 0.78;
  const micro = DUR.micro * pace;
  const labelStyle = textStyle(th, 's');
  const corner = Math.min(th.radius, 16);

  /** 1 in focus, 0.3 stepped back. */
  const dimOf = (a: LaneArrow): number => {
    if (focus === 'all') return 1;
    if (Array.isArray(focus)) return focus.includes(a.id) ? 1 : 0.3;
    const later = arrows.filter((o) => o.at > a.at).map((o) => o.at);
    if (!later.length) return 1;
    return mix(1, 0.3, prog(t, Math.min(...later), settle, 'move'));
  };
  /** A lane is active while a message it sends is in focus. */
  const active = (id: string): number => Math.max(0, ...arrows.filter((a) => a.from === id)
    .map((a) => prog(t, a.at, micro, 'enter') * ((dimOf(a) - 0.3) / 0.7)));

  const boxes = lanes.flatMap((l) => l.boxes ?? []);

  return (
    <>
      {lanes.map((l) => {
        const cx = L.laneX[l.id];
        return (
          <React.Fragment key={l.id}>
            <div style={{ position: 'absolute', left: cx - laneW / 2, top: y + LANE_HEAD / 2, width: laneW, height: h - LANE_HEAD / 2,
              background: band }} />
            <div style={{ position: 'absolute', left: cx - life / 2, top: y + LANE_HEAD, width: life, height: h - LANE_HEAD,
              background: l.color !== undefined ? paint(th, l.color) : lightActive ? mixColour(lifeBase, th.ink, active(l.id)) : lifeBase }} />
          </React.Fragment>
        );
      })}

      {arrows.map((a) => {
        const d = dimOf(a);
        const ay = L.arrowY[a.id];
        if (a.from === a.to) {
          return <Step key={a.id} x={L.laneX[a.from]} y={ay} side={L.side[a.from]} stroke={life}
            colour={toward(th, paint(th, a.color ?? 'ink'), 0.4 + 0.6 * d)} p={prog(t, a.at, travel, 'move')} />;
        }
        const dir = L.laneX[a.to] > L.laneX[a.from] ? 1 : -1;
        return <Arrow2 key={a.id} from={[L.laneX[a.from] + (dir * life) / 2, ay]} to={[L.laneX[a.to] - (dir * life) / 2, ay]}
          color={a.color ?? 'ink'} at={a.at} t={t} stroke={life} dim={d} over={travel} pace={pace} />;
      })}

      {lanes.map((l) => (
        <div key={l.id} style={{ position: 'absolute', left: L.laneX[l.id] - laneW / 2, top: y, width: laneW, height: LANE_HEAD,
          boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: lightActive ? mixColour(fill, lit, active(l.id)) : fill,
          border: l.color !== undefined ? `${life}px solid ${paint(th, l.color)}` : `${th.stroke}px solid ${sheetEdge}`, borderRadius: corner,
          ...labelStyle, fontWeight: strongOf(th), lineHeight: 1, whiteSpace: 'pre', color: th.ink }}>
          {l.name}
        </div>
      ))}

      {boxes.flatMap((b) => {
        const bw = Math.ceil(measure(b.name, labelStyle).w) + 2 * 22 + 2 * th.stroke;
        const on = b.on === undefined ? [undefined] : Array.isArray(b.on) ? b.on : [b.on];
        return on.map((id) => {
          const at = L.box[id ? `${b.id}@${id}` : b.id];
          const arrow = id ? arrows.find((a) => a.id === id) : undefined;
          // A box on an arrow arrives with it and steps back with it.
          const shown = arrow ? prog(t, arrow.at, micro, 'enter') : 1;
          if (shown <= 0) return null;
          const d = arrow ? dimOf(arrow) : 1;
          return (
            <div key={b.id + (id ?? '')} style={{ position: 'absolute', left: at.x - bw / 2, top: at.y - LANE_BOX_H / 2, width: bw, height: LANE_BOX_H,
              boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', background: fill,
              border: `${th.stroke}px solid ${toward(th, toward(th, sheetEdge, 0.4 + 0.6 * d), shown)}`, borderRadius: corner, ...labelStyle,
              lineHeight: 1, whiteSpace: 'pre', color: toward(th, inkAt(th, d), shown) }}>
              {b.name}
            </div>
          );
        });
      })}

      {arrows.map((a) => {
        if (!a.label) return null;
        const d = dimOf(a);
        const shown = prog(t, a.at + micro, DUR.enter * pace, 'enter');
        if (shown <= 0) return null;
        const ay = L.arrowY[a.id];
        const colour = toward(th, inkAt(th, d), shown);
        if (a.from === a.to) {
          const s = L.side[a.from];
          return (
            <div key={a.id} style={{ position: 'absolute', left: L.laneX[a.from] + s * (STEP_W + life / 2 + 16), top: ay + STEP_H / 2,
              transform: `translate(${s > 0 ? '0' : '-100%'}, -50%)`, ...labelStyle, lineHeight: 1.15, whiteSpace: 'pre', color: colour }}>
              {a.label}
            </div>
          );
        }
        return (
          <div key={a.id} style={{ position: 'absolute', left: L.mid[a.id], top: ay - life / 2 - LABEL_GAP - (a.carry ? Math.max(CARRY_HALF, (a.carryH ?? 0) / 2 + 6) : 0),
            transform: 'translate(-50%, -100%)', ...labelStyle, lineHeight: 1.15, whiteSpace: 'pre', color: colour }}>
            {a.label}
          </div>
        );
      })}

      {arrows.map((a) => {
        if (!a.carry || a.from === a.to) return null;
        const g = prog(t, a.at, travel, 'move');
        if (g <= 0) return null;
        const fx = L.laneX[a.from];
        const tx = L.laneX[a.to];
        const dir = tx > fx ? 1 : -1;
        const lo = Math.min(fx, tx) + life / 2;
        const span = Math.abs(tx - fx) - life;
        // It slides out of the sender's lifeline: whatever is still behind that line is cut away.
        return (
          <div key={a.id} style={{ position: 'absolute', left: lo, top: L.arrowY[a.id], width: span, height: 0,
            clipPath: 'inset(-540px 0px -540px 0px)' }}>
            <div style={{ position: 'absolute', left: span / 2 - dir * (1 - g) * (span / 2), top: 0,
              transform: `translate(${-50 - dir * 50 * (1 - g)}%, -50%)`, whiteSpace: 'nowrap' }}>
              {typeof a.carry === 'function' ? a.carry(dimOf(a)) : a.carry}
            </div>
          </div>
        );
      })}
    </>
  );
}
