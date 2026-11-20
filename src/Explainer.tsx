/**
 * @file Explainer.tsx
 * @description The whole video: a static ground, the scenes in a TransitionSeries (cuts land in the silence
 *   between two scenes' narration, so voice and picture stay in sync), chapter cards, a progress bar that shows
 *   the chapters, burned-in captions and the narration track.
 *   Timing: make.py gives every scene its narration-timeline start and length and the cut into it
 *   (scene.cut = {type, s}). A cut of s seconds is centred 0.2 s before the scene's start, so the next scene
 *   mounts a little early; ClockOffset tells the template, so its cue times stay exact.
 *   Scene code (v0.3): every scene gets SceneContext (its words and neighbours) and the video gets VideoContext
 *   (the worlds the spec declares). A `custom` or `world` scene is drawn by the video's own component (custom.tsx).
 *   World runs (architecture section 6.8): consecutive scenes of one world, joined without a cut, are ONE Sequence
 *   and so one mount. A wrapper gives every frame the scene it belongs to (its words, beats and clock), so the
 *   component, its WebGL context, its compiled shaders and its geometry survive the seam between two scenes.
 *   Layers: the chrome (chapter bar, captions) is drawn above every scene of every kind, with a halo of the ground
 *   colour (Progress.tsx, Captions.tsx), so a picture that reaches under it never hides it.
 * @see templates/ (every template), transitions.tsx, Progress.tsx, Captions.tsx
 */
import React, { useMemo } from 'react';
import type { ReactNode } from 'react';
import * as R from 'remotion';
import { AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import type { Props, Scene } from './types';
import { TEMPLATES } from './templates';
import { Captions } from './Captions';
import { Progress } from './Progress';
import { DEFAULT_THEME, THEMES, ThemeContext } from './theme';
import type { Theme } from './theme';
import { loadFont } from '@remotion/fonts';
import { ClockOffset } from './motion';
import { glide, rise } from './transitions';
import { GlyphContext } from './glyphs';
import { CustomScene, SEAM, SceneContext, VideoContext } from './custom';
import './fonts';

// Remotion renamed <Audio> to <Html5Audio> in some 4.0.x releases; use whichever this version exports.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Narration = ((R as any).Html5Audio ?? (R as any).Audio) as (p: { src: string }) => React.ReactElement;

const SHIFT = SEAM; // seconds: cuts sit this far before the next scene's start, inside the silence between voices

const SceneView = ({ s, i, all }: { s: Scene; i: number; all: Scene[] }) => {
  const type = s.visual?.type;
  // a world scene has no template of its own: its declaration names the component (custom.tsx)
  const T = type === 'world' || type === 'custom' ? CustomScene : TEMPLATES[type] ?? TEMPLATES.points;
  const p = all[i - 1];
  const prev = p && p.visual?.type === type && s.cut?.type === 'none' ? { v: p.visual, dur: p.dur } : null;
  // every scene can read its words and its neighbours (kit/time.ts, kit/world.ts)
  const info = useMemo(() => ({ scene: s, index: i, scenes: all, words: s.words ?? [], dur: s.dur }), [s, i, all]);
  return (
    <SceneContext.Provider value={info}>
      <T v={s.visual} dur={s.dur} index={i} prev={prev} scene={s} />
    </SceneContext.Provider>
  );
};

/** The world a scene is a view of, or null. */
const worldOf = (s: Scene): string | null => (s.visual?.type === 'world' && typeof s.visual.world === 'string' ? s.visual.world : null);

/**
 * A run of scenes of one world inside one Sequence. `first` is the Sequence's first frame on the video and
 * `seams[j]` the video frame from which scene `ks[j]` is on screen. Every frame is given to the scene it belongs
 * to, with that scene's clock; the element tree keeps its shape, so React keeps every instance mounted.
 */
const WorldRun = ({ ks, all, first, seams }: { ks: number[]; all: Scene[]; first: number; seams: number[] }) => {
  const frame = first + useCurrentFrame();
  const { fps } = useVideoConfig();
  let j = 0;
  while (j + 1 < ks.length && frame >= seams[j + 1]) j++;
  const s = all[ks[j]];
  return (
    <ClockOffset.Provider value={(Math.round(s.start * fps) - first) / fps}>
      <SceneView s={s} i={ks[j]} all={all} />
    </ClockOffset.Provider>
  );
};

/** A video may redesign any token for its topic (spec "design", F-005): merged over its theme, one level deep. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const merge = (base: Theme, over?: Record<string, any>): Theme => {
  if (!over) return base;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: any = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = v && typeof v === 'object' && !Array.isArray(v) ? { ...(out[k] || {}), ...v } : v;
  return out as Theme;
};

/** Typefaces a video's design asks for beyond the built-in ones: fetched by make.py from Fontsource into public/fonts. */
const loaded = new Set<string>();
const useVideoFonts = (fonts?: { family: string; url: string; weight: string }[]) => {
  for (const f of fonts || []) {
    const k = `${f.family}|${f.weight}`;
    if (loaded.has(k)) continue;
    loaded.add(k);
    loadFont({ family: f.family, url: staticFile(f.url), weight: f.weight, format: 'woff2' }).catch((e) => {
      throw new Error(`font ${f.family} failed to load: ${e}`);
    });
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const presentation = (type: string): any => (type === 'glide' ? glide() : type === 'rise' ? rise() : fade());

export const Explainer = (p: Props) => {
  const { fps } = useVideoConfig();
  const th = merge(THEMES[p.theme || DEFAULT_THEME] ?? THEMES[DEFAULT_THEME], p.design);
  useVideoFonts(p.fonts);
  const video = useMemo(() => ({ worlds: p.worlds ?? {}, fps, strip: Boolean(p.strip), only2d: Boolean(p.only2d) }),
    [p.worlds, fps, p.strip, p.only2d]);
  const scenes = p.scenes;
  const n = scenes.length;
  const totalF = Math.max(1, Math.ceil(p.duration * fps));
  const Tf = scenes.map((s, k) => (k === 0 || !s.cut || s.cut.type === 'none' ? 0 : Math.max(2, Math.round(s.cut.s * fps))));
  const cf = scenes.map((s) => Math.round(s.start * fps) - Math.round(SHIFT * fps));
  const Vf = scenes.map((_, k) => (k === 0 ? 0 : cf[k] - Math.floor(Tf[k] / 2)));
  const Ef = scenes.map((_, k) => (k === n - 1 ? totalF : cf[k + 1] + (Tf[k + 1] - Math.floor(Tf[k + 1] / 2))));
  // Runs: a scene joins the run before it when both are views of one world and nothing cuts between them.
  const runs: number[][] = [];
  scenes.forEach((s, k) => {
    const w = worldOf(s);
    const last = runs[runs.length - 1];
    if (k > 0 && last && w !== null && w === worldOf(scenes[k - 1]) && Tf[k] === 0) last.push(k);
    else runs.push([k]);
  });
  const items: ReactNode[] = [];
  for (const ks of runs) {
    const [k0, k1] = [ks[0], ks[ks.length - 1]];
    if (Tf[k0] > 0)
      items.push(<TransitionSeries.Transition key={`t${k0}`} presentation={presentation(scenes[k0].cut!.type)} timing={linearTiming({ durationInFrames: Tf[k0] })} />);
    items.push(
      <TransitionSeries.Sequence key={`s${k0}`} durationInFrames={Math.max(1, Ef[k1] - Vf[k0])}>
        {ks.length > 1 ? (
          <WorldRun ks={ks} all={scenes} first={Vf[k0]} seams={ks.map((k) => Vf[k])} />
        ) : (
          <ClockOffset.Provider value={(Math.round(scenes[k0].start * fps) - Vf[k0]) / fps}>
            <SceneView s={scenes[k0]} i={k0} all={scenes} />
          </ClockOffset.Provider>
        )}
      </TransitionSeries.Sequence>,
    );
  }
  return (
    <ThemeContext.Provider value={th}>
      <VideoContext.Provider value={video}>
      <GlyphContext.Provider value={p.glyphs || {}}>
      <AbsoluteFill style={{ background: th.bg, color: th.ink, fontFamily: th.font.text }}>
        {p.audio ? <Narration src={staticFile(p.audio)} /> : null}
        {/* The scenes are one isolated layer and the chrome a layer above it: whatever a scene draws, and whatever
            z-index its own code uses, the chapter bar and the captions stay on top. */}
        <AbsoluteFill style={{ isolation: 'isolate', zIndex: 0 }}>
          <TransitionSeries>{items}</TransitionSeries>
        </AbsoluteFill>
        <AbsoluteFill style={{ zIndex: 1, pointerEvents: 'none' }}>
          <Progress chapters={p.chapters || []} scenes={scenes} duration={p.duration} />
          {p.showCaptions !== false ? <Captions caps={p.captions || []} /> : null}
        </AbsoluteFill>
      </AbsoluteFill>
      </GlyphContext.Provider>
      </VideoContext.Provider>
    </ThemeContext.Provider>
  );
};
