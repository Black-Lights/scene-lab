/**
 * @file kit/time.ts
 * @description Time for scene code (architecture section 6.1). Everything a scene shows is a pure function of
 *   scene time: useClock() gives the seconds since the scene's own start on the narration timeline, a named beat
 *   (useBeat) gives the moment make.py resolved from a spoken word, and tween() moves a value between keyframes.
 *   No clock, no randomness: the same frame always draws the same picture.
 *   Conventions: seconds everywhere; `t` is the first argument of every time helper; a time below zero is before
 *   the scene's first word (the scene is already on screen during the cut in); Infinity means "never".
 *   Scene code never holds a cue word: every time that depends on the narration is declared in the spec, where
 *   make.py can check it. useWords() and wordAt() are for text that follows the voice, never for timing a motion.
 */
import { DUR, EASE, clamp01, useClock } from '../motion';
import { useScene } from '../custom';
import type { Word } from '../types';

export { useClock };

/** 0 before `at`, 1 from it on. A time that is not a number (NaN) never comes. */
export const step = (t: number, at: number): number => (t >= at ? 1 : 0);

/** An easing: one of the engine's four names (enter, exit, move, linear), or a function for a special case. */
export type Ease = keyof typeof EASE | ((x: number) => number);

export const easeOf = (e?: Ease | string): ((x: number) => number) => {
  if (typeof e === 'function') return e;
  if (e === undefined || e === null) return EASE.move;
  const f = (EASE as Record<string, (x: number) => number>)[e];
  if (!f) throw new Error(`ease "${e}" is not one of ${Object.keys(EASE).join(', ')}`);
  return f;
};

/**
 * Eased 0..1 progress of a motion that starts at `at` seconds and lasts `dur`. Before `at` it is 0, after it 1.
 * A start at Infinity never happens. A length that is not a positive number (0, or NaN from two beats that were never
 * spoken) is an instant step at `at`, so the helper never returns NaN or sits part way for a whole scene.
 */
export const prog = (t: number, at: number, dur: number = DUR.enter, ease: Ease = 'enter'): number => {
  const f = easeOf(ease);
  if (!(dur > 0)) return f(step(t, at));
  return f(clamp01((t - at) / dur));
};


const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const rgb = (c: string): [number, number, number] | null => {
  const m = HEX.exec(c.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((x) => x + x).join('') : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

/** The channels of a hex colour, or an error that says how to get one: a name here would reach CSS or three.js,
 * which read "red" or "green" as their own named colours, not the theme's paints. */
const hexOf = (c: unknown): [number, number, number] => {
  const v = typeof c === 'string' ? rgb(c) : null;
  if (!v) throw new Error(`colour ${JSON.stringify(c)} is not hex: resolve a paint, role or token with paint(th, ref) or usePaint() first`);
  return v;
};

/**
 * A colour between two hex colours, mixed in linear light so the midpoint is not muddy. Returns #rrggbb.
 * Both inputs must be hex (#rgb or #rrggbb); anything else throws: resolve a name with paint() first.
 */
export const mixColour = (a: string, b: string, p: number): string => {
  const x = hexOf(a);
  const y = hexOf(b);
  const q = clamp01(p);
  const lin = (v: number) => Math.pow(v / 255, 2.2);
  const out = x.map((v, i) => Math.round(255 * Math.pow(lin(v) + (lin(y[i]) - lin(v)) * q, 1 / 2.2)));
  return '#' + out.map((v) => v.toString(16).padStart(2, '0')).join('');
};

export type Tweenable = number | number[] | string;

/**
 * A value between `a` and `b`, with `p` held to 0..1 (NaN counts as 0): numbers, vectors of numbers, or hex colours.
 * Two strings are colours and must be hex (a name throws, see mixColour); two values of different kinds switch at
 * the half.
 */
export function mix(a: number, b: number, p: number): number;
export function mix(a: string, b: string, p: number): string;
export function mix<V extends number[]>(a: V, b: number[], p: number): V;
export function mix(a: Tweenable, b: Tweenable, p: number): Tweenable {
  const q = clamp01(p);
  if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * q;
  if (Array.isArray(a) && Array.isArray(b)) return a.map((v, i) => v + ((b[i] ?? v) - v) * q);
  if (typeof a === 'string' && typeof b === 'string') return mixColour(a, b, q);
  return q < 0.5 ? a : b;
}

/** A keyframe: from `at` the value moves to `to`, arriving `over` seconds later. */
export type Key<T> = { at: number; to: T; over?: number; ease?: Ease };

/**
 * The value at time `t` of something that starts as `from` and follows `keys`. Each key starts from wherever the
 * value is at that moment, so a key that interrupts another stays continuous. A key at Infinity never happens.
 * Default duration: 0.9 s for numbers and vectors, 0.25 s for colours. Default ease: move. Colours must be hex.
 */
export function tween(t: number, from: number, keys: Key<number>[]): number;
export function tween(t: number, from: string, keys: Key<string>[]): string;
export function tween<V extends number[]>(t: number, from: V, keys: Key<number[]>[]): V;
export function tween(t: number, from: Tweenable, keys: Key<Tweenable>[]): Tweenable {
  // colours are checked before the first key comes, so a name fails on every frame, not only after its key
  if (typeof from === 'string') for (const c of [from, ...keys.map((k) => k.to)]) hexOf(c);
  let v = from;
  // a key at NaN (a beat that was never spoken, minus another) never happens, like one at Infinity
  const when = (k: Key<Tweenable>) => (Number.isNaN(k.at) ? Infinity : k.at);
  for (const k of [...keys].sort((x, y) => when(x) - when(y))) {
    if (!(t > when(k))) break;
    const over = k.over ?? (typeof k.to === 'string' ? DUR.micro : DUR.morph);
    // a length that is not a positive number (0, NaN) is an instant change
    const p = !(over > 0) ? 1 : easeOf(k.ease)(clamp01((t - k.at) / over));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    v = mix(v as any, k.to as any, p) as Tweenable;
  }
  return v;
}

const norm = (s: string) => s.toLowerCase().replace(/[^0-9a-z]+/g, '');

/**
 * Seconds (scene time) at which `phrase` starts being spoken, or null when it is not in `words`. The matching is
 * the cue grammar of the spec: letters and digits only, the words of the phrase in a row, a whole-word match
 * before a prefix match. `nth` picks a later occurrence (1 = the first). For text that follows the voice only.
 */
export const wordAt = (words: Word[], phrase: string, nth = 1): number | null => {
  const cue = phrase.split(/\s+/).map(norm).filter(Boolean);
  if (!cue.length) return null;
  const nw = words.map((w) => norm(w.w));
  const find = (hit: (spoken: string, c: string) => boolean): number | null => {
    let seen = 0;
    for (let i = 0; i + cue.length <= nw.length; i++)
      if (cue.every((c, j) => hit(nw[i + j], c)) && ++seen === nth) return words[i].s;
    return null;
  };
  return find((w, c) => w === c) ?? find((w, c) => w.startsWith(c));
};

/** This scene's spoken words with their times in scene seconds. */
export const useWords = (): Word[] => useScene().words;

/**
 * The spec's named beats for this scene, in scene seconds: "beats": {"open": "opens"} gives { open: 4.2 }.
 * make.py resolves the words. A beat whose words were not found is Infinity (make.py has already said so).
 */
export const useBeats = (): Record<string, number> => {
  const beats = useScene().scene.visual?.beats;
  const out: Record<string, number> = {};
  if (beats && typeof beats === 'object')
    for (const [k, b] of Object.entries(beats)) {
      const at = typeof b === 'number' ? b : (b as { at?: unknown } | null)?.at;
      out[k] = typeof at === 'number' ? at : Infinity;
    }
  return out;
};

/**
 * One named beat in scene seconds. A name the scene's spec does not declare is an error, because a misspelt beat
 * would otherwise never fire and nobody would know. A component shared by scenes that do not all declare the
 * beat passes `fallback` (often Infinity, "never"), which is used in place of the error.
 */
export const useBeat = (name: string, fallback?: number): number => {
  const beats = useBeats();
  if (name in beats) return beats[name];
  if (fallback !== undefined) return fallback;
  const known = Object.keys(beats);
  throw new Error(`beat "${name}" is not declared in this scene's "beats" (${known.length ? 'declared: ' + known.join(', ') : 'it declares none'})`);
};
