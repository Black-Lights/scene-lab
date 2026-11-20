/**
 * @file motion.ts
 * @description The one motion language every template uses (written down in docs/design.md, "Motion language").
 *   Eased curves only, no springs with overshoot, nothing infinite. Every motion starts on a narration cue and
 *   settles into a still frame while the narration explains it.
 *   Determinism: everything derives from useCurrentFrame(); no wall clock, no Math.random.
 */
import { createContext, useContext } from 'react';
import { Easing, useCurrentFrame, useVideoConfig } from 'remotion';

/** Curves (Material 3 emphasized family, docs/research/motion.md). */
export const EASE = {
  enter: Easing.bezier(0.05, 0.7, 0.1, 1), // things arriving: fast start, long gentle settle
  exit: Easing.bezier(0.3, 0, 0.8, 0.15), // things leaving: slow start, quick finish
  move: Easing.bezier(0.2, 0, 0, 1), // a thing changing place or shape, a camera move, a payload travelling
  linear: (x: number) => x, // real dynamics only (a stroke being drawn at pen speed)
};

/** Durations in seconds. Video runs about 1.5x UI timings, because the viewer did not trigger the motion. */
export const DUR = {
  micro: 0.25, // a colour or emphasis change
  enter: 0.5,
  exit: 0.35,
  draw: 0.7, // a line or arrow drawing on
  travel: 0.9, // a payload moving along its arrow
  morph: 0.9, // one shape becoming the next, a layout change
  camera: 1.3, // camera glide between parts of the canvas
  settle: 0.7, // an earlier item stepping back when the next one is spoken
  stagger: 0.08, // between items revealed together
  hold: 1.5, // minimum stillness after a reveal
};

/** Holds x to 0..1. NaN gives 0 (a motion whose time is unknown has not started), never NaN. */
export const clamp01 = (x: number) => (x > 0 ? (x < 1 ? x : 1) : 0);
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** Eased 0..1 progress of a motion that starts at `at` seconds and lasts `dur`. */
export const prog = (t: number, at: number, dur: number, ease: (x: number) => number = EASE.enter) =>
  ease(clamp01((t - at) / Math.max(1e-6, dur)));

/**
 * Seconds of scene time before the scene's Sequence starts (transitions start a scene a little early).
 * Templates read scene time through useClock(), so cue times from make.py stay exact.
 */
export const ClockOffset = createContext(0);

/** Scene time in seconds: 0 is the scene's own start on the narration timeline. Negative during the cut in. */
export const useClock = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps - useContext(ClockOffset);
};

/**
 * Focus for item i of a list revealed at times `ats` (sorted by reveal order): `shown` is its entrance,
 * `back` how far it has stepped back because a later item is now being spoken about (never fully: it stays readable).
 */
export const focusOf = (i: number, ats: number[], t: number) => {
  const shown = prog(t, ats[i], DUR.enter);
  const next = ats.slice(i + 1).find((a) => a > ats[i] + 0.05);
  const back = next === undefined ? 0 : prog(t, next, DUR.settle, EASE.move);
  return { shown, back };
};

/** Default reveal time for item i of n when the spec gave no cue: spread over the first 70% of the scene. */
export const stagger = (i: number, n: number, dur: number, first = 0.3) =>
  first + Math.min(i * 0.12, Math.max(0, dur * 0.3)) * (n > 1 ? 1 : 0);

/** An item's reveal time: its cue (resolved by make.py into `at`) or the default stagger. */
export const atOf = (it: unknown, i: number, n: number, dur: number) => {
  const a = (it as { at?: unknown })?.at;
  return typeof a === 'number' ? Math.max(0, a) : stagger(i, n, dur);
};
