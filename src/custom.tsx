/**
 * @file custom.tsx
 * @description Scene code written per video (v0.3, docs/v0.3-architecture.md sections 4 and 6.8). A video folder
 *   may hold React components in videos/<slug>/scenes/*.tsx. A spec scene uses one with {"type": "custom",
 *   "component": "Name"}, or with {"type": "world", "world": "<id>"}, where the world's declaration names the
 *   component once. make.py (custom.py) writes the video's own Remotion entry, which registers those components
 *   here before the Root. This file is the runtime side: the registry, the two contexts every scene can read (its
 *   own place in the video, and the video's worlds), the error channel, and the template that draws a free or
 *   world scene behind the preload gate.
 *   A scene that is missing, fails to load or throws becomes a plain card for that frame only and is reported, so
 *   one broken scene shows on the contact sheet and in the report and never stops a render.
 *   Errors from inside a 3D canvas: react-three-fiber hands every error it catches to the browser's global error
 *   event, and Remotion stops a render on any such event. The kit records those errors (recordError) before they
 *   are dispatched, and the one window listener below cancels exactly the recorded ones; the DOM side then draws
 *   the card. Every other global error still stops the render, as it should.
 * @see ../custom.py (entry, lint, typecheck), kit/ (what scene code imports as @kit), kit/canvas.tsx
 */
import React, { createContext, useContext, useLayoutEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import type { Scene, Visual, Word, WorldDecl } from './types';
import { AREA, useTheme } from './theme';
import { Preload } from './kit/preload';
import type { Asset } from './kit/preload';

// ---------------------------------------------------------------- one engine (section 6.8)

/**
 * Two copies of this file in one page would mean two registries and two sets of contexts: a scene registered in
 * one copy is invisible to the other, and the 3D canvas would read the wrong theme or clock without any error.
 * That happens when a library or this folder is reached by two paths (remotion.config.ts pins them). So the
 * second copy stops at once. A hot reload in the studio evaluates the file again on purpose and is let through.
 */
const ONCE = '__explainerRuntime';
const hot = Boolean((import.meta as unknown as { webpackHot?: unknown }).webpackHot);
const g = globalThis as unknown as Record<string, unknown>;
if (g[ONCE] && !hot)
  throw new Error('[kit] src/custom.tsx is loaded twice in one page, so scenes and contexts would be split between two copies. ' +
    'Check the aliases in remotion.config.ts and that the repo is not reached through two paths.');
g[ONCE] = true;

// ---------------------------------------------------------------- errors that leave a 3D canvas

const recordedObjects = new WeakSet<object>();
const recordedValues = new Set<unknown>();

/**
 * Marks an error as handled by the kit: when react-three-fiber reports it as a global error event, the event is
 * cancelled, so Remotion does not stop the render. Called by the canvas host before the error is dispatched.
 */
export const recordError = (e: unknown): void => {
  if (e !== null && (typeof e === 'object' || typeof e === 'function')) recordedObjects.add(e as object);
  else recordedValues.add(e);
};

const recorded = (e: unknown): boolean =>
  e !== null && (typeof e === 'object' || typeof e === 'function') ? recordedObjects.has(e as object) : recordedValues.has(e);

if (typeof window !== 'undefined')
  window.addEventListener(
    'error',
    (ev: ErrorEvent) => {
      if (!recorded(ev.error)) return;
      // preventDefault keeps the browser from reporting the error as uncaught, which is what Remotion listens to
      ev.preventDefault();
      ev.stopImmediatePropagation();
    },
    true,
  );

// ---------------------------------------------------------------- the scene's place in the video

/** What every scene component receives: the same props a template gets. */
export type SceneProps = { v: Visual; dur: number; scene: Scene; index: number; prev: { v: Visual; dur: number } | null };

/** A scene's place in the video: itself, its index in props.scenes, all scenes, its words in scene time. */
export type SceneInfo = { scene: Scene; index: number; scenes: Scene[]; words: Word[]; dur: number };

const NO_SCENE: SceneInfo = { scene: { start: 0, dur: 0, visual: { type: 'none' } }, index: 0, scenes: [], words: [], dur: 0 };
export const SceneContext = createContext<SceneInfo>(NO_SCENE);
export const useScene = (): SceneInfo => useContext(SceneContext);

/**
 * What belongs to the whole video: the worlds the spec declares, the frame rate, and whether this frame is a cell
 * of a filmstrip. The frame rate is here because world time sits on the frame grid (kit/world.ts) and only the
 * engine knows the grid; `strip` lets the 3D canvas draw at half resolution in a small cell; `only2d` is set when
 * the direction holds the video to 2D, and the 3D canvas then refuses to draw (kit/canvas.tsx).
 */
export type VideoInfo = { worlds: Record<string, WorldDecl>; fps: number; strip: boolean; only2d: boolean };
export const VideoContext = createContext<VideoInfo>({ worlds: {}, fps: 30, strip: false, only2d: false });
export const useVideo = (): VideoInfo => useContext(VideoContext);

/**
 * Seconds before a scene's own start at which the cut into it sits, inside the silence between two voices.
 * Where the picture carries on (two scenes of one world), this is the seam: the earlier scene is on screen
 * until then and the later one from then.
 */
export const SEAM = 0.2;

/**
 * The <Stage>s a scene has mounted, in the order they mounted (kit/stage.tsx). A scene holds one: each is a WebGL
 * context, and a filmstrip mounts a scene eight times, so a second one is an error, not a slow render.
 */
export const StageSlot = createContext<Set<object> | null>(null);

// ---------------------------------------------------------------- the registry

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const REGISTRY: Record<string, React.ComponentType<any>> = {};
/** Scene files that threw while they loaded: their name and what they threw. */
const BROKEN: Record<string, unknown> = {};
const FAILED = '__sceneFileFailed';

/**
 * For the generated entry: the module of one scene file, or a marker that holds what the file threw while it
 * loaded. A scene file that throws at its top level then becomes one reported card instead of a dead video.
 */
export const loadScene = (load: () => unknown): unknown => {
  try {
    return load();
  } catch (e) {
    return { [FAILED]: e ?? new Error('the file threw nothing') };
  }
};

/** Called by a video's generated entry: { Name: module } for every file in its scenes/ folder. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const registerScenes = (mods: Record<string, any>) => {
  for (const [name, m] of Object.entries(mods)) {
    if (m && typeof m === 'object' && FAILED in m) {
      BROKEN[name] = m[FAILED];
      continue;
    }
    const C = m?.default ?? m?.[name];
    if (typeof C === 'function' || (C && typeof C === 'object')) REGISTRY[name] = C;
    else BROKEN[name] = new Error(`scenes/${name}.tsx has no default export`);
  }
};

/** The component a free or world visual is drawn by: its own `component`, or the one its world declares. */
export const componentOf = (v: Visual | undefined, worlds: Record<string, WorldDecl>): string =>
  String((v?.type === 'world' ? worlds[String(v?.world ?? '')]?.component : v?.component) ?? '');

// ---------------------------------------------------------------- the error channel

/** A message as it is shown and logged: kit code marks its own errors with "[kit]", and the channel adds that once. */
const plain = (e: unknown): string => String((e as Error)?.message ?? e).replace(/^\[kit\]\s*/, '').replace(/\s+/g, ' ').slice(0, 300);

const said = new Set<string>();
/**
 * The error channel (architecture section 3): one line per problem on the browser console, which make.py lifts
 * into its JSON report. `n` is the scene's number in spec.json. A line is written once per page, not once per
 * frame, so a scene that fails for ten seconds is one line and not three hundred.
 */
export const report = (n: number | string, component: string, message: unknown): void => {
  const line = `[kit] scene ${n} ${component || '?'}: ${plain(message)}`;
  if (said.has(line)) return;
  said.add(line);
  console.error(line);
};

/** The reporter for the scene around the caller, for kit code that draws a placeholder and carries on. */
export const useReport = (): ((message: unknown) => void) => {
  const { scene, index } = useScene();
  const { worlds } = useVideo();
  return (message) => report(scene.n ?? index + 1, componentOf(scene.visual, worlds), message);
};

// ---------------------------------------------------------------- the card

/** The plain card a scene falls back to: its title if it has one, and one line that says what is wrong. */
const Missing = ({ v, name, why }: { v: Visual; name: string; why: string }) => {
  const th = useTheme();
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: AREA.side, top: AREA.top, width: 1920 - 2 * AREA.side, fontFamily: th.font.display,
        fontWeight: th.weight.display, fontSize: 54, lineHeight: 1.15, color: th.ink }}>
        {typeof v?.title === 'string' ? v.title : ''}
      </div>
      {/* a message may hold a long unbroken run (a file path, a JSON pose): it breaks anywhere rather than leave the frame */}
      <div style={{ position: 'absolute', left: AREA.side, top: 420, width: 1920 - 2 * AREA.side, fontFamily: th.font.text, fontSize: 34,
        lineHeight: 1.35, color: th.ink2, overflowWrap: 'anywhere' }}>
        The scene "{name}" could not be drawn: {why}
      </div>
    </AbsoluteFill>
  );
};

/** A scene the spec asks for that has nothing to draw it with: the card, and one line on the error channel. */
const Absent = ({ p, name, why }: { p: SceneProps; name: string; why: string }) => {
  const n = p.scene?.n ?? p.index + 1;
  // a layout effect, so the line is written before the frame can be captured
  useLayoutEffect(() => report(n, name, why), [n, name, why]);
  return <Missing v={p.v} name={name} why={why} />;
};

type BoundaryProps = { frame: number; onError: (e: unknown) => void; fallback: (e: unknown) => ReactNode; children: ReactNode };
type BoundaryState = { error: unknown; frame: number };

/**
 * Catches a scene that throws. Every frame is judged on its own: the error is dropped as soon as the frame
 * changes, so a scene that fails only at one moment (a track read inside a branch, say) is a card for exactly
 * those frames. A renderer tab draws many frames in a row, so a boundary that kept its error would blank the
 * rest of the scene.
 */
class Boundary extends React.Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null, frame: this.props.frame };
  static getDerivedStateFromError(error: unknown) {
    return { error: error ?? new Error('the scene threw nothing') };
  }
  static getDerivedStateFromProps(props: BoundaryProps, state: BoundaryState) {
    return props.frame === state.frame ? null : { error: null, frame: props.frame };
  }
  componentDidCatch(error: unknown) {
    this.props.onError(error);
  }
  render() {
    return this.state.error ? this.props.fallback(this.state.error) : this.props.children;
  }
}

// ---------------------------------------------------------------- the template

const assetList = (x: unknown): Asset[] =>
  x && typeof x === 'object' ? Object.values(x as Record<string, unknown>).filter((a): a is Asset => !!a && typeof a === 'object') : [];

/**
 * Every asset a scene can read, for the preload gate: its own, and for a world scene, the world's and those of
 * every other scene of the same world. A run of world scenes is one mount (Explainer.tsx), so the gate must not
 * close again at a seam because the next scene of the run declares one more asset.
 */
const useSceneAssets = (v: Visual, worlds: Record<string, WorldDecl>): Asset[] => {
  const { scenes } = useScene();
  const id = v?.type === 'world' ? String(v.world ?? '') : null;
  return useMemo(() => {
    if (id === null) return assetList(v?.assets);
    const out = assetList(worlds[id]?.assets);
    for (const s of scenes) if (s.visual?.type === 'world' && s.visual.world === id) out.push(...assetList(s.visual.assets));
    return out;
  }, [id, id === null ? v : null, worlds, scenes]); // eslint-disable-line react-hooks/exhaustive-deps
};

/** The template for {"type": "custom"} and {"type": "world"}. */
export const CustomScene = (p: SceneProps) => {
  const frame = useCurrentFrame();
  const { worlds } = useVideo();
  const isWorld = p.v?.type === 'world';
  const id = String(p.v?.world ?? '');
  const name = componentOf(p.v, worlds);
  const n = p.scene?.n ?? p.index + 1;
  const assets = useSceneAssets(p.v, worlds);
  const stages = useMemo(() => new Set<object>(), []);
  if (isWorld && !worlds[id])
    return <Absent p={p} name={id || 'world'} why={id ? `the spec declares no world "${id}" under "worlds"` : 'the scene names no world'} />;
  if (!name)
    return <Absent p={p} name={isWorld ? id : 'custom'} why={isWorld ? `the world "${id}" names no component` : 'the scene names no component'} />;
  if (name in BROKEN) return <Absent p={p} name={name} why={`scenes/${name}.tsx threw while it loaded: ${plain(BROKEN[name])}`} />;
  const C = REGISTRY[name];
  if (!C) return <Absent p={p} name={name} why={`no file scenes/${name}.tsx`} />;
  return (
    <Boundary key={name} frame={frame} onError={(e) => report(n, name, e)} fallback={(e) => <Missing v={p.v} name={name} why={plain(e)} />}>
      <Preload assets={assets}>
        <StageSlot.Provider value={stages}>
          <C {...p} />
        </StageSlot.Provider>
      </Preload>
    </Boundary>
  );
};
