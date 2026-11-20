/**
 * @file kit/overlay.tsx
 * @description The overlay of a stage (architecture section 6.5): HTML above the picture, in layout pixels of
 *   the 1920x1080 frame. <Pin> puts any HTML at a place or a point; <Label> is a name with an optional second
 *   line and leader; <Counter> is a number that follows a value. Labels can also be given as data in the spec
 *   (`labels`), which is the usual way: make.py resolves their cues, and the stage lays them out through
 *   solveLabels (labels.ts) once per shot at the pose the camera rests on, then moves them between two shots
 *   with the camera's own progress, so a label never changes side in a single frame.
 *   These parts are HTML, so they belong in the `overlay` prop of a <Stage> or <Board>. Among the 3D children
 *   they would be handed to three.js, which cannot draw them: that is an error with a clear message here.
 *   Text never leaves the content area: a label is kept between the chapter bar and the captions.
 */
import React, { useContext, useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { DUR, clamp01, useClock } from '../motion';
import { SEAM, useScene } from '../custom';
import { useTheme } from '../theme';
import { labelLook, solveLabels, spotBeside } from './labels';
import type { LabelBox, LabelLook, LabelRect, Side } from './labels';
import { paint } from './paint';
import { InCanvas, StageRunContext, useStage } from './staging';
import type { OnStage } from './staging';
import { prog } from './time';
import { TYPE, dataStyle, useTextSize } from './type';
import type { Measure, TypeSize } from './type';
import { useWorldLine } from './world';
import type { WorldScene } from './world';

type Where = { on?: string; pos?: number[] };

/** The place or point a part is tied to, on the frame. Stops a part that was put among the 3D children. */
const useAnchor = (part: string, { on, pos }: Where): OnStage => {
  if (useContext(InCanvas))
    throw new Error(`<${part}> is HTML: put it in the "overlay" prop of the <Stage>, not among its 3D children`);
  const stage = useStage();
  if (typeof on === 'string') return stage.project(on);
  if (Array.isArray(pos)) return stage.project(pos);
  throw new Error(`<${part}> needs "on" (the name of a place) or "pos" (a point)`);
};

const clampInto = (x: number, y: number, w: number, h: number, area: LabelRect): [number, number] => [
  Math.max(area[0], Math.min(x, area[0] + area[2] - w)),
  Math.max(area[1], Math.min(y, area[1] + area[3] - h)),
];

export type PinProps = Where & {
  /** Which side of the place the content sits on; `center` puts its middle on the place's middle. */
  side?: Side | 'center';
  dx?: number;
  dy?: number;
  opacity?: number;
  children?: ReactNode;
};

/** Any HTML at a place or a point of the stage. It follows the camera; it is not kept inside the content area. */
export const Pin = ({ on, pos, side = 'center', dx = 0, dy = 0, opacity = 1, children }: PinProps) => {
  const a = useAnchor('Pin', { on, pos });
  if (!a.visible || opacity <= 0) return null;
  const [bx, by, bw, bh] = a.box;
  const [x, y, tx, ty] =
    side === 'right' ? [bx + bw, by + bh / 2, '0', '-50%']
      : side === 'left' ? [bx, by + bh / 2, '-100%', '-50%']
        : side === 'top' ? [bx + bw / 2, by, '-50%', '-100%']
          : side === 'bottom' ? [bx + bw / 2, by + bh, '-50%', '0']
            : [a.x, a.y, '-50%', '-50%'];
  return (
    <div style={{ position: 'absolute', left: (x as number) + dx, top: (y as number) + dy, transform: `translate(${tx}, ${ty})`, opacity }}>
      {children}
    </div>
  );
};

/** The size of a label in its look: the wider of its two lines plus the plate's padding. */
const sizeOf = (look: LabelLook, measure: Measure, text: string, sub?: string): { w: number; h: number } => {
  const a = measure(text, look.text);
  const b = sub ? measure(sub, look.sub) : { w: 0, h: 0 };
  return { w: Math.ceil(Math.max(a.w, b.w)) + 2 * look.padX, h: Math.ceil(a.h + b.h) + 2 * look.padY };
};

/** One label drawn at its spot: the plate with its lines, and the leader to the thing it names. */
const LabelView = ({ look, text, sub, x, y, w, h, to, opacity, leader }: {
  look: LabelLook; text: string; sub?: string; x: number; y: number; w: number; h: number; to: { x: number; y: number }; opacity: number; leader?: boolean;
}) => {
  // the leader leaves the label at the point of its edge that is nearest to the thing
  const [ex, ey] = [Math.max(x, Math.min(to.x, x + w)), Math.max(y, Math.min(to.y, y + h))];
  const far = Math.hypot(to.x - ex, to.y - ey) > look.leader.dot * 2;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, opacity }}>
      {leader && far ? (
        <svg width={1920} height={1080} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
          <line x1={ex} y1={ey} x2={to.x} y2={to.y} stroke={look.leader.color} strokeWidth={look.leader.width} strokeLinecap="round" />
          <circle cx={to.x} cy={to.y} r={look.leader.dot} fill={look.leader.color} />
        </svg>
      ) : null}
      <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, boxSizing: 'border-box', padding: `${look.padY}px ${look.padX}px`,
        whiteSpace: 'nowrap', ...look.plate }}>
        <div style={look.text}>{text}</div>
        {sub ? <div style={look.sub}>{sub}</div> : null}
      </div>
    </div>
  );
};

/** How much of a label shows at scene time t: it fades in from `at` and out from `until`. */
const shownAt = (t: number, at: number, until: number): number =>
  Math.min(at === -Infinity ? 1 : prog(t, at, DUR.enter), until === Infinity ? 1 : 1 - prog(t, until, DUR.exit, 'exit'));

export type LabelProps = Where & {
  text: string;
  sub?: string;
  size?: TypeSize;
  side?: Side;
  /** Scene seconds at which the label appears and goes (a beat, usually). Without them it is always there. */
  at?: number;
  until?: number;
  /** Draw a line from the label to the middle of the thing it names. */
  leader?: boolean;
  dx?: number;
  dy?: number;
};

/** A name beside a place or a point, written in code. It takes the side it is given; no other label is avoided. */
export const Label = ({ on, pos, text, sub, size = 'm', side = 'top', at = -Infinity, until = Infinity, leader, dx = 0, dy = 0 }: LabelProps) => {
  const a = useAnchor('Label', { on, pos });
  const stage = useStage();
  const th = useTheme();
  const t = useClock();
  const measure = useTextSize();
  const opacity = shownAt(t, at, until);
  if (!a.visible || opacity <= 0) return null;
  const look = labelLook(th, size);
  const { w, h } = sizeOf(look, measure, text, sub);
  const spot = spotBeside(a.box, w, h, side, look.gap);
  const [x, y] = clampInto(spot.x + dx, spot.y + dy, w, h, stage.area as LabelRect);
  return <LabelView look={look} text={text} sub={sub} x={x} y={y} w={w} h={h} to={a} opacity={opacity} leader={leader} />;
};

export type CounterProps = {
  value: number;
  decimals?: number;
  unit?: string;
  size?: TypeSize | number;
  /** A colour reference: a paint, a role, a token or a hex value. Default: ink. */
  color?: string;
  style?: CSSProperties;
};

/**
 * A number that follows a value, in the data face with tabular figures, so it counts without jittering.
 * It is inline: put it in a <Pin>, in a line of text, or in a positioned box. Give it a value that changes
 * for a reason (a track of the world, a tween on a beat); a number that counts up only to look alive is noise.
 */
export const Counter = ({ value, decimals = 0, unit, size = 'm', color, style }: CounterProps) => {
  const th = useTheme();
  const base = dataStyle(th, size);
  const d = Math.max(0, Math.min(6, Math.round(decimals)));
  const v = Number.isFinite(value) ? value : 0;
  // a value that rounds to zero is written without a minus sign
  const text = (Math.abs(v) < 0.5 * Math.pow(10, -d) ? 0 : v).toFixed(d);
  const px = base.fontSize as number;
  // The data face is monospaced, so its decimal point takes a whole digit's width and "2.8" reads as "2 . 8".
  // The point gets a narrower box of its own; the digits keep their tabular width, so the number still does not jitter.
  // The point's own advance is measured in the face (a proportional data face has a narrow one already) and its
  // glyph is centred in a box at most 0.3 em wide.
  const measure = useTextSize();
  const [whole, frac] = text.split('.');
  const dot = frac !== undefined ? measure('.', { ...base, ...style }).w : 0;
  const box = Math.min(dot, px * 0.3);
  return (
    <span style={{ ...base, display: 'inline-block', color: color ? paint(th, color) : th.ink, ...style }}>
      {whole}
      {frac !== undefined ? (
        <>
          <span style={{ display: 'inline-block', width: box, whiteSpace: 'nowrap' }}>
            <span style={{ marginLeft: (box - dot) / 2 }}>.</span>
          </span>
          {frac}
        </>
      ) : null}
      {unit ? <span style={{ fontFamily: th.font.text, fontSize: Math.min(px, Math.max(TYPE.s, px * 0.62)), marginLeft: '0.22em' }}>{unit}</span> : null}
    </span>
  );
};

// ---------------------------------------------------------------- labels given as data

/** A label as the spec gives it, after make.py: loosely typed, checked where it is read. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;
type Item = { key: string; id: string; ref: string | number[]; text: string; sub?: string; size: TypeSize; side?: Side; leader: boolean;
  at: number; until: number };
type Layout = Record<string, { dx: number; dy: number; shown: number }>;

const SIDES = ['top', 'right', 'bottom', 'left'];

/** The name two scenes share for "the same label": its id, or the place it is on, or its text. */
const nameOf = (l: Raw, i: number): string => String(l?.id ?? (typeof l?.on === 'string' ? l.on : l?.text ?? i));

const timed = (l: Raw) => typeof l?.at === 'number' || l?.cue !== undefined;

/** Scene time of the seam into the next scene: the last moment this scene is on screen when the picture carries on. */
const seamOf = (here: WorldScene, next: WorldScene | undefined, dur: number): number => (next ? next.origin - here.origin - SEAM : dur);

/**
 * When each label of a scene is on screen. A label with a cue appears on its word. A label without one is
 * there from the start. Across the seam between two scenes of one world the picture carries on, so a label
 * both scenes declare stays as it is, a label only the second one declares fades in from t = 0, and a label
 * only the first one declares is gone before the seam.
 */
const useItems = (labels: Raw[]): Item[] => {
  const { line, here } = useWorldLine();
  const { dur } = useScene();
  return useMemo(() => {
    const at = line.scenes.indexOf(here);
    const prev = here.follows ? line.scenes[at - 1] : undefined;
    const next = line.scenes[at + 1]?.follows ? line.scenes[at + 1] : undefined;
    const listOf = (s?: WorldScene): Raw[] => (Array.isArray(s?.scene.visual?.labels) ? s!.scene.visual.labels : []);
    const seam = seamOf(here, next, dur);
    const before = prev ? seamOf(prev, here, prev.scene.dur) : 0;
    // a label of the scene before that is still on screen at the seam, and one of the scene after that opens with it
    const carriedIn = new Set(listOf(prev).filter((l) => !(typeof l?.over === 'number' && (typeof l.at === 'number' ? l.at : 0) + l.over < before)
      && !(l?.cue !== undefined && typeof l.at !== 'number')).map(nameOf));
    const carriedOut = new Set(listOf(next).filter((l) => !timed(l)).map(nameOf));
    return labels.map((l, i): Item => {
      const n = here.scene.n ?? here.index + 1;
      if (typeof l?.text !== 'string') throw new Error(`scene ${n}: label ${i + 1} has no "text"`);
      const ref = typeof l.on === 'string' ? l.on : Array.isArray(l.pos) ? (l.pos as number[]) : null;
      if (ref === null) throw new Error(`scene ${n}: the label "${l.text}" needs "on" (a place) or "pos" (a point)`);
      if (l.side !== undefined && !SIDES.includes(l.side)) throw new Error(`scene ${n}: the label "${l.text}" has side "${l.side}"; use one of ${SIDES.join(', ')}`);
      if (l.size !== undefined && !(l.size in TYPE)) throw new Error(`scene ${n}: the label "${l.text}" has size "${l.size}"; use s, m or l`);
      const id = nameOf(l, i);
      const from = typeof l.at === 'number' ? l.at : l.cue !== undefined ? Infinity : prev && !carriedIn.has(id) ? 0 : -Infinity;
      const until = typeof l.over === 'number' ? Math.max(from, 0) + l.over : next && !carriedOut.has(id) ? seam - DUR.exit - 0.05 : Infinity;
      return { key: `${i}:${id}`, id, ref, text: l.text, sub: typeof l.sub === 'string' ? l.sub : undefined, size: (l.size ?? 'm') as TypeSize,
        side: l.side as Side | undefined, leader: l.leader === true, at: from, until };
    });
  }, [labels, line, here, dur]);
};

const Labels = ({ labels }: { labels: Raw[] }) => {
  const stage = useStage();
  const run = useContext(StageRunContext);
  const th = useTheme();
  const t = useClock();
  const measure = useTextSize();
  const items = useItems(labels);
  const area = stage.area as LabelRect;
  const sized = items.map((l) => {
    const look = labelLook(th, l.size);
    return { ...l, look, ...sizeOf(look, measure, l.text, l.sub) };
  });
  const gap = labelLook(th, 'm').gap;
  // One layout per shot, solved at the pose the camera rests on. Kept while the shots, places and type stay the same.
  const solved = useMemo(() => new Map<number, Layout>(), [run?.stamp, items, measure, th.id, area.join(',')]);
  const layoutAt = (i: number): Layout => {
    const hit = solved.get(i);
    if (hit) return hit;
    const seen = sized.map((l) => ({ l, a: run ? run.projectAt(i, l.ref) : stage.project(l.ref) }));
    const boxes: LabelBox[] = seen.filter((s) => s.a.visible).map(({ l, a }) => ({ id: l.key, x: a.x, y: a.y, box: a.box, w: l.w, h: l.h, side: l.side, at: l.at, until: l.until }));
    const spots = solveLabels(boxes, area, gap);
    const out: Layout = {};
    for (const { l, a } of seen) {
      const s = spots[l.key];
      out[l.key] = s && a.visible ? { dx: s.x - a.x, dy: s.y - a.y, shown: s.hidden ? 0 : 1 } : { dx: -l.w / 2, dy: -l.h - gap, shown: 0 };
    }
    solved.set(i, out);
    return out;
  };
  const mixLayout = (a: Layout, b: Layout, p: number): Layout => {
    const out: Layout = {};
    for (const k of Object.keys(b)) {
      const [x, y] = [a[k] ?? b[k], b[k]];
      out[k] = { dx: x.dx + (y.dx - x.dx) * p, dy: x.dy + (y.dy - x.dy) * p, shown: x.shown + (y.shown - x.shown) * p };
    }
    return out;
  };
  const layout = run ? run.follow(layoutAt, mixLayout) : layoutAt(-1);
  return (
    <>
      {sized.map((l) => {
        const a = stage.project(l.ref);
        const spot = layout[l.key];
        const opacity = clamp01(shownAt(t, l.at, l.until) * (spot?.shown ?? 0));
        if (!a.visible || !spot || opacity <= 0) return null;
        const [x, y] = clampInto(a.x + spot.dx, a.y + spot.dy, l.w, l.h, area);
        return <LabelView key={l.key} look={l.look} text={l.text} sub={l.sub} x={x} y={y} w={l.w} h={l.h} to={a} opacity={opacity} leader={l.leader} />;
      })}
    </>
  );
};

/** The labels of a scene's spec, drawn by the stage itself. Scene code never renders this. */
export const DataLabels = ({ labels }: { labels?: unknown }) => {
  if (labels === undefined || labels === null) return null;
  if (!Array.isArray(labels)) throw new Error('"labels" is a list, [{ "on": "place", "text": "...", "cue": "..." }]');
  return labels.length ? <Labels labels={labels as Raw[]} /> : null;
};
