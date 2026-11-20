/**
 * @file kit/parts2d.tsx
 * @description Small drawn 2D parts for free scenes and boards (work package A2, architecture section 6.7): the
 *   sheet (a panel with an optional name tab), the chip, the tag, a text label that can wrap, the hatch, a brace or
 *   square bracket that draws on, an arrow that draws on (Arrow2), a strike-through, a stamp, a countdown ring, a
 *   tick-and-cross glyph, a badge, a circled letter, and FadeIn (a part that arrives at a time).
 *   Every part is a pure function of its props, the theme and scene time `t` (passed in where it moves): no clock,
 *   no randomness. Colours are colour references (paint(): a hex value, a paint, a role or a token) with defaults
 *   from the theme's tokens; strokes and corners default to th.stroke and th.radius. Positions are layout pixels
 *   (board units on a Board); a part is `position: absolute` at its own (x, y), so it can also stand inside a Sheet,
 *   whose children count from the sheet's top-left corner.
 *   `dim` is 1 in focus and 0.3 stepped back (w.dim(id) gives it): a colour steps back by mixing toward the ground,
 *   text toward the theme's `back` ink, never by opacity. `pace` multiplies the engine's durations (DUR) for a design
 *   that moves slower or faster; it defaults to 1. A part appears by its colour leaving the ground, or by being
 *   drawn on; nothing scales or bounces.
 *   The author's page: docs/kit/parts.md. The demo: videos/_kit_parts.
 */
import React from 'react';
import { DUR } from '../motion';
import { useTheme } from '../theme';
import type { Theme } from '../theme';
import type { Vec2 } from './camera';
import { contrast, paint } from './paint';
import { mix, mixColour, prog } from './time';
import { MIN_TYPE, dataStyle, textStyle, useTextSize, wrapToWidth } from './type';
import type { TypeSize } from './type';

const W = 1920;
const H = 1080;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
/** A colour stepped back toward the ground: d = 1 the colour itself, 0 the ground. */
const toward = (th: Theme, hex: string, d: number) => mixColour(th.bg, hex, clamp(d));
/** Text ink by focus: the full ink at dim 1, the back ink at dim 0.3. */
const inkAt = (th: Theme, d: number) => mixColour(th.back, th.ink, clamp((d - 0.3) / 0.7));
/** The fill a lit thing takes when the theme names none: the surface a little toward the ink. */
const litOf = (th: Theme) => (th.lit ? paint(th, th.lit) : mixColour(paint(th, 'surface'), paint(th, 'ink'), 0.12));

/** Height of the name tab that stands on a Sheet's top edge: the tab reaches this far above the sheet's y. */
export const SHEET_TAB = 46;
/** Height of a Chip at the smallest type size (MIN_TYPE); a larger `size` scales it. */
export const CHIP_H = 46;

/** A full-frame SVG layer for parts that are lines; its coordinates are its parent's. */
function Layer({ children }: { children: React.ReactNode }) {
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}
      style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}>
      {children}
    </svg>
  );
}

// --- FadeIn ------------------------------------------------------------------------------------------------------

export type FadeInProps = {
  /** Scene seconds at which the children arrive. Without it they are there from the start. */
  at?: number;
  t: number;
  /** Pixels the children settle by while they arrive; default 6, 0 for none. */
  rise?: number;
  pace?: number;
  children: React.ReactNode;
};

/**
 * Children that arrive at `at`: they come out of the ground in DUR.micro and settle a few pixels, and are not drawn
 * before. The children keep their own coordinates (the wrapper has no size and no offset).
 */
export function FadeIn({ at, t, rise = 6, pace = 1, children }: FadeInProps) {
  if (at === undefined) return <>{children}</>;
  const p = prog(t, at, DUR.micro * pace, 'enter');
  if (p <= 0) return null;
  if (p >= 1) return <>{children}</>;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, opacity: p, transform: `translateY(${((1 - p) * rise).toFixed(2)}px)` }}>
      {children}
    </div>
  );
}

// --- The hatch ---------------------------------------------------------------------------------------------------

/** How a hatch looks: pitch and line width in pixels, angle in degrees, and the line colour on a given fill. */
export type HatchLook = { pitch?: number; width?: number; angle?: number; line?: (fill: string) => string };

const HATCH = { pitch: 12, width: 2, angle: 45 };

/** The default line of a hatch on a fill: half way from the fill to whichever of ink and ground stands out on it. */
const hatchLine = (th: Theme, fill: string): string => {
  const ink = paint(th, 'ink');
  const bg = paint(th, 'bg');
  return mixColour(fill, contrast(ink, fill) >= contrast(bg, fill) ? ink : bg, 0.5);
};

/** The id of a hatch pattern of one line colour and look. Equal ids hold equal patterns, so they may repeat. */
export function hatchId(color: string, look: HatchLook = {}): string {
  const { pitch = HATCH.pitch, width = HATCH.width, angle = HATCH.angle } = look;
  return `hatch-${pitch}-${width}-${angle}-${color.replace('#', '')}`.replace(/\./g, '_');
}

/** `url(#id)`, for a `fill`. */
export function hatchFill(id: string): string {
  return `url(#${id})`;
}

export type HatchDefsProps = { id: string; color: string; pitch?: number; width?: number; angle?: number };

/** The SVG pattern of a hatch, to put inside an <svg>; fill a shape with hatchFill(id). */
export function HatchDefs({ id, color, pitch = HATCH.pitch, width = HATCH.width, angle = HATCH.angle }: HatchDefsProps) {
  const th = useTheme();
  return (
    <defs>
      <pattern id={id} width={pitch} height={pitch} patternUnits="userSpaceOnUse" patternTransform={`rotate(${angle})`}>
        <rect x={0} y={0} width={width} height={pitch} fill={paint(th, color)} />
      </pattern>
    </defs>
  );
}

export type HatchProps = {
  /** The colour under the hatch. */
  fill: string;
  /** 0..1, the share of the hatch line: 1 full, lower is quieter (under long text). */
  strength?: number;
  look?: HatchLook;
};

/** The hatch alone, filling its positioned parent: diagonal lines over `fill`. */
export function Hatch({ fill, strength = 1, look = {} }: HatchProps) {
  const th = useTheme();
  const f = paint(th, fill);
  const colour = mixColour(f, look.line ? look.line(f) : hatchLine(th, f), strength);
  const id = hatchId(colour, look);
  return (
    <svg width="100%" height="100%" style={{ position: 'absolute', left: 0, top: 0 }}>
      <HatchDefs id={id} color={colour} pitch={look.pitch} width={look.width} angle={look.angle} />
      <rect x={0} y={0} width="100%" height="100%" fill={hatchFill(id)} />
    </svg>
  );
}

/**
 * A text style for text that stands on a hatch: a solid ring of the fill colour round every glyph, so the lines
 * stop short of the letters and never read as a strike through a word. Hard offsets, no blur.
 */
export function knockOut(fill: string, r: number = 3): React.CSSProperties {
  const ring: string[] = [];
  for (const k of [r, r * 0.5]) {
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      ring.push(`${(Math.cos(a) * k).toFixed(2)}px ${(Math.sin(a) * k).toFixed(2)}px 0 ${fill}`);
    }
  }
  return { textShadow: ring.join(', ') };
}

export type HatchedRectProps = { x: number; y: number; w: number; h: number;
  /** The fill under the hatch. */
  color: string;
  dim?: number; radius?: number; strength?: number; hatch?: HatchLook };

/** A rectangle in a fill with the hatch over it. */
export function HatchedRect({ x, y, w, h, color, dim = 1, radius = 0, strength = 1, hatch }: HatchedRectProps) {
  const th = useTheme();
  const fill = toward(th, paint(th, color), 0.4 + 0.6 * dim);
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, background: fill, borderRadius: radius, overflow: 'hidden' }}>
      <Hatch fill={fill} strength={strength} look={hatch} />
    </div>
  );
}

// --- The sheet ---------------------------------------------------------------------------------------------------

export type SheetProps = {
  x: number; y: number; w: number; h: number;
  /** Fill and outline; defaults 'surface' and 'line'. */
  fill?: string; edge?: string;
  /** Outline width (default th.stroke) and corner radius (default th.radius, at most 16). */
  stroke?: number; radius?: number;
  /** An SVG dash pattern for the outline ("10 7"), and its line ends. */
  dash?: string; cap?: 'butt' | 'round';
  /** Only the outline: the ground shows through. */
  hollow?: boolean;
  /** A name on a tab on the top edge, at the left, in the data face. The tab reaches SHEET_TAB above y. */
  name?: string;
  /** The ink of the name (default the theme's ink): name one when the fill is far from the ground. */
  ink?: string;
  /** A second sheet behind, offset: a pile. */
  pile?: boolean;
  dim?: number;
  children?: React.ReactNode;
};

/** A sheet: a panel with an outline, an optional name tab and children placed from its top-left corner. */
export function Sheet({ x, y, w, h, fill: fillRef = 'surface', edge: edgeRef = 'line', stroke, radius, dash, cap = 'butt',
  hollow = false, name, ink, pile = false, dim = 1, children }: SheetProps) {
  const th = useTheme();
  const measure = useTextSize();
  const s = stroke ?? th.stroke;
  const filled = !hollow;
  const fill = paint(th, fillRef);
  const edge = toward(th, paint(th, edgeRef), 0.4 + 0.6 * dim);
  const tabStyle = dataStyle(th, MIN_TYPE);
  const tabW = name ? Math.ceil(measure(name, tabStyle).w) + 2 * 18 + 2 * s : 0;
  const r = radius ?? Math.min(th.radius, 16);
  const off = 6;
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: h }}>
      <svg width={w} height={h} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        {pile ? (
          <rect x={off + s / 2} y={off + s / 2} width={w - s} height={h - s} rx={r} fill={fill} stroke={edge} strokeWidth={s} />
        ) : null}
        {name ? (
          <rect x={s / 2} y={-SHEET_TAB + s / 2} width={tabW - s} height={SHEET_TAB + r + s} rx={r}
            fill={filled ? fill : th.bg} stroke={edge} strokeWidth={s} strokeDasharray={dash} strokeLinecap={cap} />
        ) : null}
        <rect x={s / 2} y={s / 2} width={w - s} height={h - s} rx={r} fill={filled ? fill : 'none'} stroke={edge}
          strokeWidth={s} strokeDasharray={dash} strokeLinecap={cap} />
        {name && filled ? <rect x={s} y={0} width={tabW - 2 * s} height={s + r} fill={fill} /> : null}
      </svg>
      {name ? (
        <div style={{ position: 'absolute', left: s + 18, top: -SHEET_TAB + s, height: SHEET_TAB - s, display: 'flex',
          alignItems: 'center', ...tabStyle, lineHeight: 1, whiteSpace: 'pre',
          color: ink ? mixColour(fill, paint(th, ink), 0.4 + 0.6 * dim) : inkAt(th, dim) }}>
          {name}
        </div>
      ) : null}
      {children}
    </div>
  );
}

// --- Chips, tags, text -------------------------------------------------------------------------------------------

export type ChipProps = {
  text: string;
  /** A second text after the first, quieter: an id, a unit, a count. */
  sub?: string;
  /** Top-left corner. Without x and y the chip flows inline. */
  x?: number; y?: number;
  /** Type size in pixels, never under MIN_TYPE; the chip's height scales with it. */
  size?: number;
  /** A fixed width, the text centred. */
  w?: number;
  /** The fill (default 'surface'). */
  color?: string;
  /** A solid chip is its colour and steps back with the fill; otherwise it is an outline chip on a sheet tone. */
  solid?: boolean;
  /** Text colour. Solid: default the ink or ground that reads best on the fill. Outline: default the ink by focus. */
  ink?: string;
  /** Outline colour. Solid: default the fill itself. Outline: default 'line'. */
  edge?: string;
  /** 0..1: the chip is being named: its outline thickens to `heavy` in `litEdge` (default ink), and an outline chip
   *  fills with `litFill` (default the theme's lit tone). */
  lit?: number;
  litFill?: string; litEdge?: string;
  stroke?: number; heavy?: number; radius?: number;
  /** Diagonal lines over the fill (true, or a HatchLook); the text gets knockOut(). */
  hatch?: boolean | HatchLook;
  dim?: number;
};

/** A chip in the data face: a short code, a field, a name with an id. */
export function Chip({ text, sub, x, y, size, w, color = 'surface', solid = false, ink: inkRef, edge: edgeRef, lit = 0,
  litFill, litEdge = 'ink', stroke, heavy, radius, hatch = false, dim = 1 }: ChipProps) {
  const th = useTheme();
  const px = Math.max(MIN_TYPE, size ?? MIN_TYPE);
  const h = Math.round(px * (CHIP_H / MIN_TYPE));
  const base = paint(th, color);
  const l = clamp(lit);
  const s = stroke ?? th.stroke;
  const sh = heavy ?? th.stroke * 1.5;
  const fill = solid ? toward(th, base, 0.58 + 0.42 * dim) : mixColour(base, litFill ? paint(th, litFill) : litOf(th), l);
  let ink: string;
  if (solid) {
    const bg = paint(th, 'bg');
    const dark = paint(th, 'ink');
    ink = inkRef ? paint(th, inkRef) : contrast(dark, fill) >= contrast(bg, fill) ? dark : bg;
  } else {
    ink = inkRef ? toward(th, paint(th, inkRef), 0.4 + 0.6 * dim) : mixColour(inkAt(th, dim), th.ink, l);
  }
  const restEdge = solid && edgeRef === undefined ? fill : toward(th, paint(th, edgeRef ?? 'line'), 0.4 + 0.6 * dim);
  const edge = l > 0 ? mixColour(restEdge, paint(th, litEdge), l) : restEdge;
  const edgeW = mix(s, Math.max(s, sh), l);
  const placed = x !== undefined && y !== undefined;
  const hatchLook = hatch === true ? {} : hatch || undefined;
  return (
    <span style={{ position: placed ? 'absolute' : 'relative', left: placed ? x : undefined, top: placed ? y : undefined,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: Math.round(px * 0.5), boxSizing: 'border-box',
      height: h, width: w, padding: `0 ${Math.round(px * 0.5)}px`, borderRadius: Math.min(radius ?? th.radius, h / 2), background: fill,
      border: `${edgeW}px solid ${edge}`, ...dataStyle(th, px), lineHeight: 1, color: ink, whiteSpace: 'pre', overflow: 'hidden',
      verticalAlign: 'middle' }}>
      {hatchLook ? <Hatch fill={fill} look={hatchLook} /> : null}
      <span style={{ position: 'relative', ...(hatchLook ? knockOut(fill) : {}) }}>{text}</span>
      {sub ? <span style={{ position: 'relative', color: mixColour(fill, ink, 0.7), ...(hatchLook ? knockOut(fill) : {}) }}>{sub}</span> : null}
    </span>
  );
}

export type TagProps = {
  x: number; y: number; text: string; dim?: number;
  /** Default 'back': a tag is quiet. */
  color?: string;
  /** 0..1, the share of the way from the ground to its colour: an appearance without opacity. */
  shown?: number;
};

/** A small note in the data face (a source, a status, "illustrative"). Its lower right corner is at (x, y). */
export function Tag({ x, y, text, dim = 1, color = 'back', shown = 1 }: TagProps) {
  const th = useTheme();
  if (shown <= 0) return null;
  const colour = toward(th, toward(th, paint(th, color), 0.4 + 0.6 * dim), clamp(shown));
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: 'translate(-100%, -100%)', boxSizing: 'border-box',
      ...dataStyle(th, MIN_TYPE), lineHeight: 1, whiteSpace: 'pre', color: colour }}>
      {text}
    </div>
  );
}

export type TextProps = {
  x: number; y: number; text: string;
  size?: TypeSize;
  /** Default 'ink'. Stepped back (dim < 1) the text takes the back ink by focus instead. */
  color?: string;
  dim?: number;
  /** Which point of the text sits at x: its left edge, its middle or its right edge. */
  anchor?: 'start' | 'middle' | 'end';
  /** 0..1, the share of the way from the ground to its colour: an appearance without opacity. */
  shown?: number;
  strong?: boolean;
  /** A width in layout pixels: the text wraps at spaces to fit it (wrapToWidth gives the lines). */
  w?: number;
};

/** A label in the text face, top edge at y; line height 1.15 times the size. A newline breaks a line. */
export function Text({ x, y, text, size = 's', color = 'ink', dim = 1, anchor = 'start', shown = 1, strong = false, w }: TextProps) {
  const th = useTheme();
  const measure = useTextSize();
  const shift = anchor === 'middle' ? '-50%' : anchor === 'end' ? '-100%' : '0';
  const colour = toward(th, dim >= 1 ? paint(th, color) : inkAt(th, dim), clamp(shown));
  const style = textStyle(th, size);
  const weight = strong ? th.weight?.strong ?? 700 : style.fontWeight;
  const body = w === undefined ? text : wrapToWidth(measure, text, { ...style, fontWeight: weight }, w).join('\n');
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: `translateX(${shift})`, ...style,
      fontWeight: weight, lineHeight: 1.15, whiteSpace: 'pre', color: colour,
      ...(w === undefined ? {} : { textAlign: anchor === 'start' ? 'left' : anchor === 'end' ? 'right' : 'center' }) }}>
      {body}
    </div>
  );
}

// --- Lines that draw on ------------------------------------------------------------------------------------------

export type BraceProps = {
  /** The start of the span, on the edge of the thing the brace marks. */
  x: number; y: number;
  len: number;
  /** The side of the thing the brace lies on. `top` and `bottom` span x, `left` and `right` span y. */
  side: 'top' | 'bottom' | 'left' | 'right';
  /** `curly` (default) or `square`, a bracket. */
  shape?: 'curly' | 'square';
  /** Text beyond the brace, in the text face, in the ink by focus. */
  label?: string;
  /** Scene seconds at which it starts to draw on. */
  at: number;
  t: number;
  color?: string; stroke?: number;
  /** How far the brace stands out from the edge; default 16. */
  arm?: number;
  dim?: number;
  pace?: number;
};

/** A brace or a square bracket that draws on at `at` over 0.7 s, with its label beyond it. */
export function Brace({ x, y, len, side, shape = 'curly', label, at, t, color = 'ink', stroke, arm = 16, dim = 1, pace = 1 }: BraceProps) {
  const th = useTheme();
  const s = stroke ?? th.stroke;
  const p = prog(t, at, DUR.enter * pace * 1.4, 'move');
  const pl = prog(t, at + DUR.micro * pace, DUR.enter * pace, 'enter');
  if (p <= 0) return null;
  const colour = toward(th, paint(th, color), 0.4 + 0.6 * dim);
  const flat = side === 'top' || side === 'bottom';
  const out = side === 'bottom' || side === 'right' ? 1 : -1;
  const gap = 10;
  const size = textStyle(th, 's');
  let line: React.ReactNode;
  if (shape === 'square') {
    const a = s / 2;
    const pts: Vec2[] = flat
      ? [[x + a, y], [x + a, y + out * arm], [x + len - a, y + out * arm], [x + len - a, y]]
      : [[x, y + a], [x + out * arm, y + a], [x + out * arm, y + len - a], [x, y + len - a]];
    const total = len + 2 * arm;
    line = <polyline points={pts.map((q) => q.join(',')).join(' ')} fill="none" stroke={colour} strokeWidth={s}
      strokeLinejoin="miter" strokeDasharray={total} strokeDashoffset={total * (1 - p)} />;
  } else {
    // In the brace's own frame: u along the span, v away from the edge. The ends touch the edge, the tip is at arm.
    const P = (u: number, v: number) => (flat ? `${x + u},${y + out * v}` : `${x + out * v},${y + u}`);
    const half = arm / 2;
    const r = Math.min(len / 4, arm);
    const m = len / 2;
    const d = `M ${P(0, 0)} Q ${P(0, half)} ${P(r, half)} L ${P(m - r, half)} Q ${P(m, half)} ${P(m, arm)} `
      + `Q ${P(m, half)} ${P(m + r, half)} L ${P(len - r, half)} Q ${P(len, half)} ${P(len, 0)}`;
    line = <path d={d} fill="none" stroke={colour} strokeWidth={s} strokeLinejoin="round" strokeLinecap="round"
      pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />;
  }
  return (
    <>
      <Layer>{line}</Layer>
      {label ? (
        <div style={{ position: 'absolute', ...size, lineHeight: 1.15, whiteSpace: 'pre', color: toward(th, inkAt(th, dim), pl),
          left: flat ? x + len / 2 : x + out * (arm + s / 2 + gap),
          top: flat ? y + out * (arm + s / 2 + gap) : y + len / 2,
          transform: flat ? `translate(-50%, ${out > 0 ? '0' : '-100%'})` : `translate(${out > 0 ? '0' : '-100%'}, -50%)` }}>
          {label}
        </div>
      ) : null}
    </>
  );
}

export type Arrow2Props = {
  from: Vec2; to: Vec2;
  at: number; t: number;
  color?: string; stroke?: number;
  /** A dashed line; `dash` gives the pattern ("10 7"), default three and two strokes. */
  dashed?: boolean; dash?: string;
  head?: boolean;
  /** A right angle: `hv` runs level first, `vh` runs upright first. Without it the arrow is straight. */
  elbow?: 'hv' | 'vh';
  dim?: number;
  /** Seconds the arrow takes to draw on; default DUR.morph (0.9) times pace. */
  over?: number;
  pace?: number;
};

/** A straight or right-angled arrow that draws on from `from`; its head travels with the tip. */
export function Arrow2({ from, to, at, t, color = 'ink', stroke, dashed = false, dash, head = true, elbow, dim = 1, over, pace = 1 }: Arrow2Props) {
  const th = useTheme();
  const p = prog(t, at, over ?? DUR.morph * pace, 'move');
  if (p <= 0) return null;
  const s = stroke ?? th.stroke;
  const colour = toward(th, paint(th, color), 0.4 + 0.6 * dim);
  const pts: Vec2[] = elbow === 'hv' ? [from, [to[0], from[1]], to] : elbow === 'vh' ? [from, [from[0], to[1]], to] : [from, to];
  const lens = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]));
  const total = lens.reduce((n, l) => n + l, 0);
  const headLen = head ? s * 3.6 : 0;
  // The line stops short of the tip by most of the head, so its butt end never shows beside the point.
  let left = Math.max(0, total * p - headLen * 0.8);
  const drawn: Vec2[] = [pts[0]];
  let dir: Vec2 = [1, 0];
  let tipLeft = total * p;
  let tip: Vec2 = pts[0];
  for (let i = 0; i < lens.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const l = lens[i] || 1;
    const u: Vec2 = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
    if (left > 0) {
      const d = Math.min(left, lens[i]);
      drawn.push([a[0] + u[0] * d, a[1] + u[1] * d]);
      left -= d;
    }
    if (tipLeft > 0) {
      const d = Math.min(tipLeft, lens[i]);
      tip = [a[0] + u[0] * d, a[1] + u[1] * d];
      dir = u;
      tipLeft -= d;
    }
  }
  const n: Vec2 = [-dir[1], dir[0]];
  const half = headLen * 0.5;
  const base: Vec2 = [tip[0] - dir[0] * headLen, tip[1] - dir[1] * headLen];
  const tri = [tip, [base[0] + n[0] * half, base[1] + n[1] * half], [base[0] - n[0] * half, base[1] - n[1] * half]];
  return (
    <Layer>
      <polyline points={drawn.map((q) => q.join(',')).join(' ')} fill="none" stroke={colour} strokeWidth={s}
        strokeLinejoin="miter" strokeDasharray={dash ?? (dashed ? `${3 * s} ${2 * s}` : undefined)} />
      {head && total * p >= headLen ? <polygon points={tri.map((q) => q.join(',')).join(' ')} fill={colour} /> : null}
    </Layer>
  );
}

export type StrikeProps = { x: number; y: number; len: number; at: number; t: number; color?: string; stroke?: number; dim?: number; pace?: number };

/** A strike-through that draws on from (x, y) to the right in DUR.enter. */
export function Strike({ x, y, len, at, t, color = 'ink', stroke, dim = 1, pace = 1 }: StrikeProps) {
  const th = useTheme();
  const p = prog(t, at, DUR.enter * pace, 'move');
  if (p <= 0) return null;
  return (
    <Layer>
      <line x1={x} y1={y} x2={x + len * p} y2={y} stroke={toward(th, paint(th, color), 0.4 + 0.6 * dim)} strokeWidth={stroke ?? th.stroke} />
    </Layer>
  );
}

// --- Marks -------------------------------------------------------------------------------------------------------

export type StampProps = {
  x: number; y: number; text: string; at: number; t: number;
  /** Default 'warn'. */
  color?: string;
  /** Degrees the stamp is turned; default -4. */
  tilt?: number;
  /** A second, thinner frame inside the first; default true. */
  double?: boolean;
  stroke?: number; radius?: number; pace?: number;
};

/** A stamp centred on (x, y) that lands at `at`: its word in a frame, turned a little. */
export function Stamp({ x, y, text, at, t, color = 'warn', tilt = -4, double = true, stroke, radius, pace = 1 }: StampProps) {
  const th = useTheme();
  const p = prog(t, at, DUR.micro * pace, 'enter');
  if (p <= 0) return null;
  const s = stroke ?? th.stroke;
  const r = radius ?? Math.min(th.radius, 10);
  const c = paint(th, color);
  return (
    <div style={{ position: 'absolute', left: x, top: y, opacity: p,
      transform: `translate(-50%, -50%) translateY(${(1 - p) * -8}px) rotate(${tilt}deg)` }}>
      <div style={{ border: `${s}px solid ${c}`, borderRadius: r, padding: double ? 5 : 0 }}>
        <div style={{ border: double ? `${Math.max(1.5, s / 2)}px solid ${c}` : undefined, borderRadius: Math.max(0, r - 4),
          padding: '6px 22px', ...textStyle(th, 's'), fontWeight: th.weight?.strong ?? 700, lineHeight: 1.15, whiteSpace: 'pre', color: c }}>
          {text}
        </div>
      </div>
    </div>
  );
}

export type CountdownProps = {
  /** The centre. */
  x: number; y: number;
  at: number;
  /** Seconds the ring takes to empty. */
  over: number;
  t: number;
  /** A short text in the ring ('?', a number); default none. */
  mark?: string;
  /** Scene seconds at which the ring and its mark leave. */
  until?: number;
  /** Radius, default 50. */
  r?: number;
  color?: string; stroke?: number; pace?: number;
};

/** A ring that empties clockwise from the top over `over` seconds: a pause, a timer. */
export function Countdown({ x, y, at, over, t, mark = '', until = Infinity, r = 50, color = 'ink', stroke, pace = 1 }: CountdownProps) {
  const th = useTheme();
  const p = prog(t, at, DUR.micro * pace, 'enter') * (1 - prog(t, until, DUR.micro * pace, 'exit'));
  if (p <= 0) return null;
  const s = stroke ?? th.stroke;
  const round = 2 * Math.PI * r;
  const left = 1 - clamp((t - at) / Math.max(0.001, over));
  const colour = toward(th, paint(th, color), p);
  return (
    <>
      <Layer>
        <circle cx={x} cy={y} r={r} fill="none" stroke={colour} strokeWidth={s} strokeDasharray={`${round * left} ${round}`}
          transform={`rotate(-90 ${x} ${y})`} />
      </Layer>
      <div style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%, -50%)', ...textStyle(th, 'l'), lineHeight: 1, color: colour }}>
        {mark}
      </div>
    </>
  );
}

export type TickCrossProps = {
  x: number; y: number;
  /** Height; the glyph is 2.3 times as wide. */
  size: number;
  /** The colour it stands on, for the hollow of the tick; default the ground. */
  on?: string;
  color?: string; stroke?: number; dim?: number;
};

/** A hollow tick beside a cross: "it passed, and it is wrong". Top-left corner at (x, y). */
export function TickCross({ x, y, size, on, color = 'ink', stroke, dim = 1 }: TickCrossProps) {
  const th = useTheme();
  const ink = toward(th, paint(th, color), 0.4 + 0.6 * dim);
  const wide = size * 0.24;
  const rim = Math.max(2, (stroke ?? th.stroke) * 0.8);
  const k = (px: number, py: number) => `${px * size},${py * size}`;
  const tick = `${k(0.14, 0.56)} ${k(0.38, 0.8)} ${k(0.88, 0.2)}`;
  const ox = size * 1.3;
  return (
    <svg width={size * 2.3} height={size} style={{ position: 'absolute', left: x, top: y, overflow: 'visible' }}>
      <polyline points={tick} fill="none" stroke={ink} strokeWidth={wide} strokeLinejoin="miter" />
      <polyline points={tick} fill="none" stroke={on ? paint(th, on) : th.bg} strokeWidth={wide - 2 * rim} strokeLinejoin="miter" />
      <line x1={ox + size * 0.18} y1={size * 0.18} x2={ox + size * 0.82} y2={size * 0.82} stroke={ink} strokeWidth={wide * 0.6} />
      <line x1={ox + size * 0.82} y1={size * 0.18} x2={ox + size * 0.18} y2={size * 0.82} stroke={ink} strokeWidth={wide * 0.6} />
    </svg>
  );
}

export type BadgeProps = { x: number; y: number; text: string | number; dim?: number;
  /** Inverted: ink fill, ground text. */
  lit?: boolean;
  /** Fill; default the theme's lane tone, else 'surface'. */
  color?: string; radius?: number };

/** A badge centred on (x, y), 42 px high: a number or a short code in the data face. */
export function Badge({ x, y, text, dim = 1, lit = false, color, radius }: BadgeProps) {
  const th = useTheme();
  const h = 42;
  const fill = lit ? th.ink : toward(th, paint(th, color ?? th.lane ?? 'surface'), 0.4 + 0.6 * dim);
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%, -50%)', boxSizing: 'border-box', minWidth: h,
      height: h, padding: '0 9px', display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: Math.min(radius ?? th.radius, h / 2), background: fill, ...dataStyle(th, MIN_TYPE), lineHeight: 1,
      color: lit ? th.bg : inkAt(th, dim) }}>
      {String(text)}
    </div>
  );
}

export type CircledProps = { x: number; y: number;
  /** One or two characters: a letter, a digit. */
  text: string;
  dim?: number;
  /** Filled: true or false, or 0..1 for one that fills over time. */
  lit?: boolean | number;
  /** The colour it stands on, for the mix while it fills; default 'surface'. */
  on?: string;
  /** Diameter, default 46. */
  size?: number;
  stroke?: number };

/** A letter or digit in a ring, centred on (x, y); filled while it is lit. */
export function Circled({ x, y, text, dim = 1, lit = false, on = 'surface', size = 46, stroke }: CircledProps) {
  const th = useTheme();
  const ink = inkAt(th, dim);
  const l = typeof lit === 'number' ? clamp(lit) : lit ? 1 : 0;
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%, -50%)', boxSizing: 'border-box', width: size,
      height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: size / 2,
      border: `${stroke ?? th.stroke}px solid ${ink}`, background: l > 0 ? mixColour(paint(th, on), ink, l) : undefined, ...textStyle(th, 's'),
      fontSize: MIN_TYPE, fontWeight: th.weight?.strong ?? 700, lineHeight: 1, color: mixColour(ink, th.bg, l) }}>
      {text}
    </div>
  );
}
