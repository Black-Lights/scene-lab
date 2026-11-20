/**
 * @file kit/staging.ts
 * @description What the two stages and the overlay share (architecture sections 6.3 to 6.5): the frame of
 *   reference (the stage's rectangle and the content area inside it), the context that useStage() reads, and
 *   the camera run: the shots of every scene of the world on world time, folded into the pose of this frame.
 *   Internal to the kit: scene code uses <Stage>, <Board>, useStage() and the overlay parts, never this file.
 *   It exists as its own file so that stage.tsx, board.tsx and overlay.tsx can all build on it without
 *   importing each other in a circle.
 */
import { createContext, useContext, useMemo } from 'react';
import { AREA } from '../theme';
import { DUR } from '../motion';
import type { Place, Visual } from '../types';
import { foldShots, shotEntries } from './camera';
import type { Entry, Projected, Rect, SceneShots, Shot, View } from './camera';
import { easeOf } from './time';
import { useWorldLine } from './world';

/** The layout space: every HTML, SVG and overlay coordinate is a pixel of this frame, whatever the render scale. */
export const FRAME: Rect = [0, 0, 1920, 1080];
/** The content area as a rectangle: under the chapter bar, above the captions, inside the side margins. */
export const CONTENT: Rect = [AREA.side, AREA.top, FRAME[2] - 2 * AREA.side, FRAME[3] - AREA.top - AREA.bottom];

const overlap = (a: Rect, b: Rect): Rect => {
  const [x0, y0] = [Math.max(a[0], b[0]), Math.max(a[1], b[1])];
  const [x1, y1] = [Math.min(a[0] + a[2], b[0] + b[2]), Math.min(a[1] + a[3], b[1] + b[3])];
  return x1 > x0 && y1 > y0 ? [x0, y0, x1 - x0, y1 - y0] : a;
};

/**
 * A stage's rectangle as the camera sees it. The subject is fitted into the part of the rectangle that lies
 * in the content area; a stage that sits wholly outside it (a strip along the bottom, say) uses all of itself.
 */
export const viewOf = (rect?: number[]): View => {
  if (rect !== undefined && !(Array.isArray(rect) && rect.length === 4 && rect.every((n) => typeof n === 'number') && rect[2] > 0 && rect[3] > 0))
    throw new Error(`a stage's "rect" is [x, y, w, h] in layout pixels, not ${JSON.stringify(rect)}`);
  const [x, y, w, h] = (rect ?? FRAME) as Rect;
  const a = overlap([x, y, w, h], CONTENT);
  return { x, y, w, h, area: [a[0] - x, a[1] - y, a[2], a[3]] };
};

/** A point or a place on the frame: where its middle lands, and the rectangle the place covers ([x, y, w, h]). */
export type OnStage = Projected & { box: Rect };

/** What useStage() gives the overlay and the children of a stage. */
export type StageState = {
  kind: 'stage' | 'board';
  /** The camera at this frame: { target, az, el, dist, fov, shift } on a Stage, { x, y, zoom } on a Board. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pose: any;
  /** Where a place (by name) or a point (in the stage's own units) is on the frame, in layout pixels. */
  project: (pointOrPlace: string | number[]) => OnStage;
  places: Record<string, Place>;
  /** The stage's rectangle on the frame. */
  rect: Rect;
  /** The part of the frame that text over this stage stays inside: the content area, cut to the stage. */
  area: Rect;
};

export const StageContext = createContext<StageState | null>(null);

export const useStage = (): StageState => {
  const s = useContext(StageContext);
  if (!s) throw new Error('useStage() and the overlay parts (Pin, Label) need a <Stage> or a <Board> around them');
  return s;
};

/** True for everything inside a Stage's 3D canvas, where HTML cannot be drawn. */
export const InCanvas = createContext(false);

/** For parts that must move in step with the camera (labels given as data): the same run of shots the pose follows. */
export type StageRun = {
  /** How many shots there are; `goal(-1)` is the state before the first of them. */
  count: number;
  /** Changes whenever the shots, the places or the stage's rectangle change: a key for anything cached per shot. */
  stamp: unknown;
  /** A place or point on the frame as shot `i` shows it once the camera has come to rest (-1: before any shot). */
  projectAt: (i: number, ref: string | number[]) => OnStage;
  /** The value of this frame of anything that has one state per shot, mixed exactly as the camera is. */
  follow: <V>(goal: (i: number) => V, mix: (a: V, b: V, p: number) => V) => V;
};

export const StageRunContext = createContext<StageRun | null>(null);

const shotsOf = (v: Visual | undefined, n: number | string): Shot[] => {
  const shots = v?.shots;
  if (shots === undefined || shots === null) return [];
  if (!Array.isArray(shots)) throw new Error(`scene ${n}: "shots" is a list, [{ "frame": [...], "cue": "..." }]`);
  return shots as Shot[];
};

/**
 * The camera of one stage at this frame. `v` is the visual the stage was given: when it is the scene's own
 * visual, the camera runs over the shots of every scene of the world, on world time, so a move can cross the
 * seam between two scenes; any other object (a second stage with its own list of shots) is a run of its own.
 * `rest(shot)` is the pose a shot settles on; `mix` moves between two poses; `turn` applies an orbit; `carry(shot,
 * before)` fills in what a shot leaves out from the pose the camera rests on before it (on a stage: the angle).
 */
export const useShots = <P>(v: Visual | undefined, o: { rest: (shot: Shot) => P; mix: (a: P, b: P, p: number) => P; turn?: (pose: P, degrees: number) => P;
  carry?: (shot: Shot, before: P) => Shot; stamp: unknown }): { pose: P; entries: Entry<Shot>[]; atRest: (i: number) => P; follow: StageRun['follow'] } => {
  const { line, here, T } = useWorldLine();
  const own = v === undefined || v === here.scene.visual;
  const entries = useMemo(() => {
    const scenes: SceneShots<Shot>[] = own
      ? line.scenes.map((s) => ({ origin: s.origin, follows: s.follows, shots: shotsOf(s.scene.visual, s.scene.n ?? s.index + 1) }))
      : [{ origin: here.origin, follows: false, shots: shotsOf(v, here.scene.n ?? here.index + 1) }];
    return shotEntries(scenes, DUR.camera);
  }, [line, here, own, v]);
  const atRest = useMemo(() => {
    const first = o.rest({ preset: 'establish' });
    // in time order, so a shot that names no angle keeps the one the camera already has
    const goals: P[] = [];
    entries.forEach((e, i) => goals.push(o.rest(o.carry ? o.carry(e.shot, i ? goals[i - 1] : first) : e.shot)));
    return (i: number) => (i < 0 ? first : goals[i]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, o.stamp]);
  const pose = foldShots(entries, T, atRest(-1),
    (i, held) => (o.turn && typeof entries[i].shot.orbit === 'number' ? o.turn(atRest(i), entries[i].shot.orbit! * held) : atRest(i)), o.mix, easeOf).value;
  const follow: StageRun['follow'] = (goal, mix) => foldShots(entries, T, goal(-1), (i) => goal(i), mix, easeOf).value;
  return { pose, entries, atRest, follow };
};
