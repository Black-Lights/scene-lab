/**
 * @file kit/preload.ts
 * @description Assets at render time (architecture section 6.6): the preload gate. Assets are declared in the
 *   spec, make.py resolves each request into { src, kind, credit, ... }, and the engine loads every asset of a
 *   scene and of its world BEFORE the scene mounts, together with the video's typefaces. Scene and kit code
 *   then read an asset synchronously (w.asset(name).data): no loader, no Suspense and no delayRender in a
 *   scene, and so no frame in which something has not arrived yet. A loader that commits after the picture
 *   was drawn is exactly what left the v0.2 filmstrips blank.
 *   One cache entry per URL for the life of the page. A load that fails is an error of the scene: the gate
 *   throws it, and the scene's boundary draws the card and writes the report line.
 *   Loaders register by kind (registerLoader), so the asset work package adds models and HDRIs without
 *   touching this file. Pictures are built in. A kind with no loader is passed through with no `data`.
 *   The typefaces are part of the gate because text is measured for layout and drawn into textures: a width
 *   taken before a face has arrived is the width of a fallback face.
 */
import { Fragment, createElement, useLayoutEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { staticFile, useDelayRender } from 'remotion';
import { useTheme } from '../theme';

/** An asset as make.py resolved it. `data` is added here: a decoded image, a parsed model, whatever its loader returns. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Asset = { src?: string; kind?: string; credit?: string; data?: unknown; [k: string]: any };
/** Loads one asset from its URL. The returned value is kept for the life of the page and shared by every scene. */
export type Loader = (url: string, asset: Asset) => Promise<unknown>;

const picture: Loader = async (url) => {
  const img = new Image();
  img.src = url;
  await img.decode();
  return img;
};

const LOADERS: Record<string, Loader> = { photo: picture, illustration: picture, vector: picture, image: picture };

/** Called once, at module load, by the file that knows how to load a kind (model, hdri, video, ...). */
export const registerLoader = (kind: string, loader: Loader): void => {
  LOADERS[kind] = loader;
};

type Entry = { status: 'pending' | 'done' | 'error'; promise: Promise<void>; data: unknown; error: Error | null };
const cache = new Map<string, Entry>();

const urlOf = (src: string): string => (/^(https?:|data:|blob:|\/)/.test(src) ? src : staticFile(src));

const entryFor = (asset: Asset): Entry | null => {
  const load = asset.kind ? LOADERS[asset.kind] : undefined;
  if (!load || typeof asset.src !== 'string' || !asset.src) return null;
  const key = `${asset.kind}|${asset.src}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const e: Entry = { status: 'pending', promise: Promise.resolve(), data: undefined, error: null };
  let started: Promise<unknown>;
  try {
    started = Promise.resolve(load(urlOf(asset.src), asset));
  } catch (err) {
    started = Promise.reject(err);
  }
  e.promise = started.then(
    (data) => {
      e.status = 'done';
      e.data = data;
    },
    (err) => {
      e.status = 'error';
      e.error = new Error(`the asset ${asset.src} (${asset.kind}) could not be loaded: ${(err as Error)?.message ?? err}`);
    },
  );
  cache.set(key, e);
  return e;
};

/** An asset with what the gate loaded for it. Behind the gate this is always complete; it never waits. */
export const withData = <A extends Asset>(asset: A): A => {
  if (!asset || typeof asset !== 'object') return asset;
  const e = entryFor(asset);
  return e && e.status === 'done' ? { ...asset, data: e.data } : asset;
};

const bare = (family: string) => family.trim().replace(/^["']|["']$/g, '');
/** Families the gate stopped waiting for: system faces, which are never added to the document by the engine. */
const absent = new Set<string>();

/** True when every family has a loaded face in the document (src/fonts.ts and a design's own faces add them). */
export const fontsPresent = (families: string[]): boolean => {
  if (typeof document === 'undefined' || !document.fonts) return true;
  const have = new Set<string>();
  document.fonts.forEach((f) => {
    if (f.status === 'loaded') have.add(bare(f.family));
  });
  return families.every((f) => have.has(bare(f)) || absent.has(bare(f)));
};

const POLL_MS = 40;
const FONT_LIMIT = 250; // 10 s: a family that never arrives is a system face, whose metrics are already final
const LIMIT_MS = 120_000;

/**
 * Children are mounted only when every asset in `assets` and the theme's typefaces are in memory. Until then
 * the frame is held (120 s at most) and nothing is drawn. The engine puts this around every free and world
 * scene (src/custom.tsx); scene code never renders it.
 */
export const Preload = ({ assets, children }: { assets: Asset[]; children?: ReactNode }) => {
  const th = useTheme();
  const { delayRender, continueRender } = useDelayRender();
  const families = useMemo(() => [...new Set([th.font.text, th.font.display, th.font.data].filter(Boolean))], [th.font.text, th.font.display, th.font.data]);
  const entries = useMemo(() => assets.map(entryFor).filter((e): e is Entry => e !== null), [assets]);
  const settled = () => entries.every((e) => e.status !== 'pending') && fontsPresent(families);
  const [, again] = useState(0);
  const ready = settled();
  useLayoutEffect(() => {
    if (ready) return;
    // a plain label: make.py lifts every console line that carries the kit's error mark, and this is no error
    const hold = delayRender('kit preload: loading the assets and typefaces of a scene', { timeoutInMilliseconds: LIMIT_MS });
    let live = true;
    let n = 0;
    const look = () => live && again((x) => x + 1);
    Promise.all(entries.map((e) => e.promise)).then(look);
    // The engine adds a typeface to the document only after it has loaded, which fires no event: look again.
    const id = setInterval(() => {
      if (++n > FONT_LIMIT) families.forEach((f) => absent.add(bare(f))); // stop waiting for a face that is not coming
      if (fontsPresent(families)) look();
    }, POLL_MS);
    // let go in the commit that mounts the children, not before it
    return () => {
      live = false;
      clearInterval(id);
      continueRender(hold);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, entries, families]);
  if (!ready) return null;
  const bad = entries.find((e) => e.status === 'error');
  if (bad) throw bad.error;
  return createElement(Fragment, null, children);
};
