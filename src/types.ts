/**
 * @file types.ts
 * @description Shape of build/props.json, which make.py writes and the Explainer composition reads, and the
 *   shapes a world declares in the spec (v0.3: tracks, places, assets, props).
 * @see ../SPEC.md for the authoring side (spec.json); make.py turns spec.json into these props.
 */
export type Word = { w: string; s: number; e: number };
export type Caption = { s: number; e: number; words: Word[] };
// Visuals are loosely typed on purpose: templates read optional fields and fall back gracefully.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Visual = { type: string; [k: string]: any };
/** The cut into a scene: glide (camera pan inside a chapter), rise (chapter card), fade, none (continuity). */
export type Cut = { type: 'glide' | 'fade' | 'rise' | 'none'; s: number };
/** `n` is the scene's number in spec.json (1-based; chapter cards have none); `words` are its spoken words in scene seconds. */
export type Scene = { start: number; dur: number; heading?: string; visual: Visual; cut?: Cut; chapter?: number; kind?: string;
  n?: number; words?: Word[] };
/** A chapter: its title, its span on the timeline and its card (a short silent scene before its first scene). */
export type Chapter = { title: string; start: number; end: number; card?: { start: number; dur: number } };
export type Props = {
  title: string;
  fps: number;
  duration: number;
  audio?: string;
  scenes: Scene[];
  captions: Caption[];
  showCaptions?: boolean;
  credits?: string[];
  theme?: string;
  chapters?: Chapter[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  motif?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  glyphs?: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  design?: Record<string, any>;
  fonts?: { family: string; url: string; weight: string }[];
  /** Worlds declared once in the spec (v0.3): id -> { component, tracks, places, assets, props }. */
  worlds?: Record<string, WorldDecl>;
  /** Present only when the direction holds the video to 2D ("2d-only", or form "2d"): a 3D canvas is then an error. */
  only2d?: boolean;
  /**
   * Present only when the frame is a cell of a filmstrip (make.py --strip, src/Strip.tsx): the frames it shows and
   * how they are tiled. The engine reads it only to know it is drawing a small cell (the 3D canvas then draws at
   * half resolution, kit/canvas.tsx).
   */
  // `unknown` and not `any`: Strip.tsx narrows it to its own StripInfo, and `any` would swallow that type
  strip?: unknown;
};

/**
 * A named place. In 3D `pos` is the centre of its base and `size` is [x width, y height, z depth]; on a 2D board
 * `pos` is its top-left corner and `size` is [width, height]. A place without a size is a point.
 */
export type Place = { pos: number[]; size?: number[] };
/** What a state track may hold: a number, a vector, a colour reference or any other word, a list of ids, or nothing. */
export type TrackValue = number | number[] | string | string[] | boolean | null;
/** One world as the spec declares it. A free scene is the same thing with its own visual as the declaration. */
export type WorldDecl = {
  component?: string;
  tracks?: Record<string, TrackValue>;
  places?: Record<string, Place>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assets?: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props?: Record<string, any>;
};
