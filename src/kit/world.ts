/**
 * @file kit/world.ts
 * @description World state (architecture section 6.2). A world is declared once in the spec: its component, the
 *   first value of every state track, its named places, its assets and free props. Scenes of the world change
 *   the tracks with `set` entries. All entries of every scene of the world sit on ONE timeline, at the scene's
 *   start plus the entry's own time, so a change that begins at the end of one scene finishes in the next and a
 *   later scene finds the state the earlier ones left. Each entry moves a value from wherever it is.
 *   useWorld() gives a scene the state at this frame as plain reader functions (usable in loops): w.num(key),
 *   w.vec(key), w.color(key), w.get(key), w.state(key) and w.dim(id). A free scene (`custom`) is a world of one
 *   scene: its own visual holds the tracks, places, assets and props.
 *   Reading a track the world does not declare throws. A misspelt key that quietly read as 0 would look like a
 *   state, and nobody would find it. The one track that needs no declaration is `focus`.
 *   World time sits on the frame grid: a scene's t = 0 is its start rounded to a whole frame, exactly where the
 *   engine puts it, so the last frame of one scene and the first of the next are one frame apart in world time
 *   and the seam between two scenes of a world is exact.
 */
import { useMemo } from 'react';
import { DUR, clamp01, useClock } from '../motion';
import { useScene, useVideo } from '../custom';
import type { SceneInfo, VideoInfo } from '../custom';
import { useTheme } from '../theme';
import type { Place, Scene, TrackValue, Visual, WorldDecl } from '../types';
import { easeOf, mixColour } from './time';
import { paint } from './paint';
import { withData } from './preload';
import type { Asset } from './preload';

/** One scene of a world on the video's timeline. */
export type WorldScene = { index: number; scene: Scene; origin: number; follows: boolean };

type Change = { T: number; to: TrackValue; over?: number; ease?: string; key: string; order: number; open: boolean };

/** A world with everything that does not depend on the frame: its scenes and every change, in time order. */
export type WorldLine = {
  id: string;
  free: boolean;
  decl: WorldDecl;
  scenes: WorldScene[];
  changes: Change[];
  forKey: Map<string, Change[]>;
};

/** How long before a scene's own start its opening state is in force: longer than any cut into the scene. */
const OPENING = 1;
const FOCUS = 'focus';

/** A scene's t = 0 on the video, in seconds, on the frame grid (Explainer.tsx places it with the same rounding). */
export const originOf = (scene: Scene, fps: number): number => Math.round(scene.start * fps) / fps;

const worldIdOf = (v: Visual | undefined): string | null => (v?.type === 'world' && typeof v.world === 'string' ? v.world : null);

const names = (xs: string[]) => (xs.length ? xs.join(', ') : 'none');

/** The declared track a concrete key belongs to: itself, or the closest family ("cell.*" holds "cell.cold.3"). */
const declaredAs = (tracks: Record<string, TrackValue>, key: string): string | null => {
  if (key in tracks) return key;
  let best: string | null = null;
  for (const k of Object.keys(tracks))
    if (k.endsWith('.*') && key.startsWith(k.slice(0, -1)) && (!best || k.length > best.length)) best = k;
  return best;
};

/** True when a `set` key may be written: a declared track, a member of a declared family, or a part of a family. */
const settable = (tracks: Record<string, TrackValue>, key: string): boolean => {
  if (key === FOCUS || declaredAs(tracks, key)) return true;
  if (!key.endsWith('.*')) return false;
  const stem = key.slice(0, -1); // "cell.cold." for "cell.cold.*"
  return Object.keys(tracks).some((k) => k.startsWith(stem));
};

const build = (id: string, free: boolean, decl: WorldDecl, scenes: WorldScene[]): WorldLine => {
  const tracks = decl.tracks ?? {};
  const changes: Change[] = [];
  let order = 0;
  for (const ws of scenes) {
    const list = ws.scene.visual?.set;
    if (list === undefined || list === null) continue;
    const n = ws.scene.n ?? ws.index + 1;
    if (!Array.isArray(list)) throw new Error(`scene ${n}: "set" is a list of changes, [{ "key": ..., "to": ... }]`);
    for (const e of list) {
      const keys: string[] = Array.isArray(e?.keys) ? e.keys : typeof e?.key === 'string' ? [e.key] : [];
      if (!keys.length) throw new Error(`scene ${n}: a "set" entry needs "key" or "keys"`);
      if (!('to' in e)) throw new Error(`scene ${n}: the "set" entry for ${keys.join(', ')} has no "to"`);
      for (const k of keys)
        if (!settable(tracks, k))
          throw new Error(`scene ${n}: "set" names the track "${k}", which ${free ? 'the scene' : `the world "${id}"`} does not declare (tracks: ${names(Object.keys(tracks))})`);
      let T: number;
      let open = false;
      if (typeof e.at === 'number') T = ws.origin + e.at;
      else if (e.cue !== undefined) continue; // make.py did not find the words: the change never happens
      else if (ws.follows) T = ws.origin; // the picture carries on from the scene before: a change from t = 0
      else [T, open] = [ws.origin - OPENING, true]; // the state the scene opens in, before its first frame
      keys.forEach((key, i) => changes.push({ T: T + i * (typeof e.stagger === 'number' && !open ? e.stagger : 0), to: e.to as TrackValue,
        over: open ? 0 : typeof e.over === 'number' ? e.over : undefined, ease: e.ease, key, order: order++, open }));
    }
  }
  changes.sort((a, b) => a.T - b.T || a.order - b.order);
  return { id, free, decl, scenes, changes, forKey: new Map() };
};

const cache = new WeakMap<Scene[], Map<string, WorldLine>>();

/** The world the scene belongs to, built once per video: a declared world, or the scene itself when it is free. */
export const worldLine = (info: SceneInfo, video: VideoInfo): WorldLine => {
  const id = worldIdOf(info.scene.visual);
  const key = id ?? `scene.${info.index}`;
  let byId = cache.get(info.scenes);
  if (!byId) cache.set(info.scenes, (byId = new Map()));
  const hit = byId.get(key);
  if (hit) return hit;
  let line: WorldLine;
  if (id === null) {
    const v = info.scene.visual ?? { type: 'none' };
    line = build(key, true, { tracks: v.tracks, places: v.places, assets: v.assets, props: v.props },
      [{ index: info.index, scene: info.scene, origin: originOf(info.scene, video.fps), follows: false }]);
  } else {
    const decl = video.worlds[id];
    if (!decl) throw new Error(`the spec declares no world "${id}" under "worlds" (worlds: ${names(Object.keys(video.worlds))})`);
    const scenes: WorldScene[] = [];
    info.scenes.forEach((scene, index) => {
      if (worldIdOf(scene.visual) === id)
        scenes.push({ index, scene, origin: originOf(scene, video.fps), follows: index > 0 && worldIdOf(info.scenes[index - 1].visual) === id });
    });
    line = build(id, false, decl, scenes);
  }
  byId.set(key, line);
  return line;
};

/** The changes that touch one concrete key, in time order: its own, and those written to a family it is in. */
const changesFor = (line: WorldLine, key: string): Change[] => {
  let hit = line.forKey.get(key);
  if (!hit) {
    hit = line.changes.filter((c) => c.key === key || (c.key.endsWith('.*') && key.startsWith(c.key.slice(0, -1))));
    line.forKey.set(key, hit);
  }
  return hit;
};

const firstValue = (line: WorldLine, key: string): TrackValue => {
  const tracks = line.decl.tracks ?? {};
  const as = declaredAs(tracks, key);
  if (as !== null) return tracks[as];
  if (key === FOCUS) return null;
  throw new Error(`track "${key}" is not declared in ${line.free ? 'this scene\'s "tracks"' : `the world "${line.id}"`} (tracks: ${names(Object.keys(tracks))})`);
};

/** Default length of a change: 0.9 s for numbers and vectors (a thing moving), 0.25 s for colours, words and focus. */
const lengthOf = (c: Change): number => c.over ?? (typeof c.to === 'number' || (Array.isArray(c.to) && typeof c.to[0] === 'number') ? DUR.morph : DUR.micro);

const progress = (c: Change, T: number): number => {
  const over = lengthOf(c);
  return over <= 0 ? 1 : easeOf(c.ease)(clamp01((T - c.T) / over));
};

/** A track's value at world time T: its first value, then every change that has begun, each from wherever it is. */
const fold = <V>(line: WorldLine, key: string, T: number, read: (v: TrackValue) => V, mix: (a: V, b: V, p: number) => V): V => {
  let v = read(firstValue(line, key));
  for (const c of changesFor(line, key)) {
    if (c.T > T) break;
    v = mix(v, read(c.to), progress(c, T));
  }
  return v;
};

/** True when `id` is the thing a focus names, or a part of it: focus "cell.cold" holds "cell.cold.3". */
const inFocus = (focus: TrackValue, id: string): boolean => {
  const ids = Array.isArray(focus) ? focus.map(String) : typeof focus === 'string' && focus ? [focus] : [];
  return !ids.length || ids.some((f) => id === f || id.startsWith(f + '.'));
};

/** How far a thing steps back when the focus is on something else. */
export const DIMMED = 0.3;

export type WorldState = {
  /** The world's id in the spec; a free scene is "scene.<index>". */
  id: string;
  /** World time: seconds on the video's own timeline. State and camera run on it. */
  T: number;
  /** Scene time: seconds since this scene's start. */
  t: number;
  /** Seconds since this unbroken run of scenes of the world began: for things that keep running across a seam. */
  run: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props: Record<string, any>;
  places: Record<string, Place>;
  /** A declared asset, as make.py resolved it, with what the preload gate loaded: { src, kind, credit, data }. Throws for a name that is not declared. */
  asset: (name: string) => Asset;
  num: (key: string) => number;
  vec: (key: string) => number[];
  /** A colour track as #rrggbb: every value is resolved through paint() and mixed in linear light. */
  color: (key: string) => string;
  /** Any track: numbers and vectors mixed, everything else switching half way through its change. */
  get: (key: string) => TrackValue;
  /** For values that cannot be mixed (a word, a picture): draw `from` and `to` and cross-fade them with `p`. */
  state: (key: string) => { from: TrackValue; to: TrackValue; p: number };
  /** 1 when `id` is in focus or nothing is, 0.3 otherwise, cross-faded. Ids match by dot prefix. */
  dim: (id: string) => number;
};

/** The assets a scene can read: its world's, then its own (a free scene has only its own). */
const assetsOf = (line: WorldLine, v: Visual | undefined): Record<string, Asset> => ({ ...(line.free ? {} : line.decl.assets), ...v?.assets });

const assetIn = (assets: Record<string, Asset>, name: string): Asset => {
  if (!(name in assets)) throw new Error(`asset "${name}" is not declared (assets: ${names(Object.keys(assets))})`);
  return withData(assets[name]);
};

/** The world this scene is a view of, the frame-independent part: its scenes and where this one sits among them. */
export const useWorldLine = (): { line: WorldLine; here: WorldScene; T: number; t: number } => {
  const info = useScene();
  const video = useVideo();
  const t = useClock();
  const line = worldLine(info, video);
  const here = line.scenes.find((s) => s.index === info.index) ?? line.scenes[0];
  return { line, here, T: here.origin + t, t };
};

/** The state of the world at this frame. Also works in a free scene that declares its own "tracks". */
export const useWorld = (): WorldState => {
  const { line, here, T, t } = useWorldLine();
  const th = useTheme();
  const v = here.scene.visual;
  return useMemo<WorldState>(() => {
    const where = (key: string, got: unknown, want: string) =>
      new Error(`track "${key}" holds ${JSON.stringify(got)}, which is not ${want}`);
    const number = (key: string) => (x: TrackValue): number => {
      if (typeof x !== 'number') throw where(key, x, 'a number');
      return x;
    };
    const vector = (key: string) => (x: TrackValue): number[] => {
      if (!Array.isArray(x) || x.some((n) => typeof n !== 'number')) throw where(key, x, 'a list of numbers');
      return x as number[];
    };
    const colour = (key: string) => (x: TrackValue): string => {
      if (typeof x !== 'string') throw where(key, x, 'a colour');
      return paint(th, x);
    };
    let first = here;
    while (first.follows) {
      const before = line.scenes.find((s) => s.index === first.index - 1);
      if (!before) break;
      first = before;
    }
    const assets = assetsOf(line, v);
    return {
      id: line.id,
      T,
      t,
      run: T - first.origin,
      props: { ...(line.free ? {} : line.decl.props), ...v?.props },
      places: line.decl.places ?? {},
      asset: (name) => assetIn(assets, name),
      num: (key) => fold(line, key, T, number(key), (a, b, p) => a + (b - a) * p),
      vec: (key) => fold(line, key, T, vector(key), (a, b, p) => a.map((x, i) => x + ((b[i] ?? x) - x) * p)),
      color: (key) => fold(line, key, T, colour(key), mixColour),
      get: (key) =>
        fold<TrackValue>(line, key, T, (x) => x, (a, b, p) => {
          if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * p;
          if (Array.isArray(a) && Array.isArray(b) && typeof a[0] === 'number' && typeof b[0] === 'number')
            return (a as number[]).map((x, i) => x + (((b as number[])[i] ?? x) - x) * p);
          return p < 0.5 ? a : b;
        }),
      state: (key) => {
        let [from, to, p]: [TrackValue, TrackValue, number] = [firstValue(line, key), firstValue(line, key), 1];
        for (const c of changesFor(line, key)) {
          if (c.T > T) break;
          [from, to, p] = [to, c.to, progress(c, T)];
        }
        return { from, to, p };
      },
      dim: (id) => fold<number>(line, FOCUS, T, (f) => (inFocus(f, id) ? 1 : DIMMED), (a, b, p) => a + (b - a) * p),
    };
  }, [line, here, T, t, th, v]);
};

/**
 * A declared asset of this scene or its world: { src, kind, credit, data }, where `data` is what the preload gate
 * loaded (a decoded picture, a parsed model). Synchronous: the gate has loaded every declared asset before the
 * scene mounts, so there is nothing to wait for. Throws for a name the spec does not declare.
 */
export const useAsset = (name: string): Asset => {
  const { line, here } = useWorldLine();
  return assetIn(assetsOf(line, here.scene.visual), name);
};
