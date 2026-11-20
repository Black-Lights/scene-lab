/**
 * @file kit/beats.ts
 * @description Timing helpers on top of the core's beats (time.ts): a picture that runs through several scenes, and
 *   a thing that is lit over spans of time.
 *   useBeatTimes(): one scene component often draws a picture that the narration cuts into several scenes at sentence
 *   ends; each scene declares only the beats spoken in it. The function it returns answers for every beat of the
 *   picture: a beat this scene declares has its time; a beat an earlier scene declared (its name is listed in
 *   `done`, usually from the scene's props) is long past (PAST), so the picture opens settled; any other beat is
 *   still to come (Infinity). continuesPicture(done) tells a scene to draw its title and parts settled from the
 *   first frame.
 *   highlight(): 0..1, how lit a thing is at `t`, for parts that light on a spoken word and step back later.
 *   Pure functions of their inputs; `pace` multiplies the engine's durations (DUR), as a design's pace would.
 */
import { DUR } from '../motion';
import { prog, useBeats } from './time';

/** The time of a beat that an earlier scene of the same picture spoke: far before this scene. */
export const PAST = -1e6;

/** `at(name)` in scene seconds: a beat of this scene, PAST for a beat listed in `done`, Infinity for any other. */
export function useBeatTimes(done: string[] = []): (name: string) => number {
  const beats = useBeats() as Record<string, number>;
  return (name: string) => (name in beats ? beats[name] : done.includes(name) ? PAST : Infinity);
}

/** True when the scene continues a picture begun in an earlier scene (some beats are `done`). */
export function continuesPicture(done: string[] = []): boolean {
  return done.length > 0;
}

/** A span of scene seconds in which a thing is lit: from the first to the second (Infinity: it stays lit). */
export type LitSpan = [number, number];

/**
 * 0..1: how lit a thing is at `t`. It lights at `at` (undefined: from the start) in DUR.micro, and steps back at
 * `until` (undefined: never) in 0.78 of DUR.morph; every span of `again` lights it once more. `pace` multiplies
 * both durations.
 */
export function highlight(t: number, at?: number, until?: number, again: LitSpan[] = [], pace: number = 1): number {
  const settle = DUR.morph * pace * 0.78;
  const one = (a: number | undefined, u: number | undefined) =>
    (a === undefined ? 1 : prog(t, a, DUR.micro * pace, 'enter')) * (1 - (u === undefined ? 0 : prog(t, u, settle, 'move')));
  return Math.max(one(at, until), ...again.map(([a, u]) => one(a, u)));
}
