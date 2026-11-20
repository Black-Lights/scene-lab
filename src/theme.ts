/**
 * @file theme.ts
 * @description Design tokens. Every template reads colours, type and strokes from useTheme(), never literals,
 *   so a direction is one object here. The background is static on purpose: moving pixels cost file size and
 *   page parts cap at 2.85 MB. Directions and their reasons: docs/design.md.
 */
import { createContext, useContext } from 'react';
import themes from './themes.json';

export type Theme = {
  id: string;
  dark: boolean;
  bg: string; // static ground
  surface: string; // note boxes, plates
  ink: string; // text and strokes in focus
  ink2: string; // secondary text, still AA on bg
  back: string; // an item that has stepped back (passes 3:1 for large text)
  line: string; // lifelines, axes, rules (non-text)
  roles: { a: string; b: string; c: string; warn: string }; // fixed party colours for the whole video
  paint: Record<string, string>; // named content colours (yellow, red, blue, orange, green, brown, ...)
  font: { text: string; display: string; data: string };
  weight: { text: number; strong: number; display: number };
  stroke: number; // base stroke at 1080p
  radius: number;
  caption: { plate: string; ink: string; upcoming: string; size: number; radius: number; font?: string; align?: string };
  icons: string[]; // Iconify prefixes, first is the house set
  iconSuffix?: string;
  look: string; // which direction's signature components to use
  lane?: string; // the shared or public zone (an eavesdropper lane, a bus, a street)
  onLane?: string; // ink on the lane
  lit?: string; // focus band (stage look)
  chrome?: { progress?: string }; // per-video chrome variants (F-006): progress "bar" (the look's own) or "corner"
};

/** Token sets live in themes.json so make.py can read the same file (icon set per theme). */
export const THEMES = themes.themes as unknown as Record<string, Theme>;
export const DEFAULT_THEME: string = themes.default;
export const ThemeContext = createContext<Theme | null>(null);
export const useTheme = (): Theme => {
  const t = useContext(ThemeContext);
  return t ?? THEMES[DEFAULT_THEME] ?? Object.values(THEMES)[0];
};

/** Shrink a font size for long text so it never overflows its box (the rule: zero overlap). */
export const fit = (text: string | undefined, base: number, chars: number) => {
  const n = (text || '').length;
  return n <= chars ? base : Math.max(base * 0.45, base * Math.sqrt(chars / n));
};

/** Content area in px at 1080p: under the progress bar, above the caption band (captions never cover content). */
export const AREA = { top: 110, bottom: 210, side: 110 };

/**
 * A halo: the ground colour all around the letters, sharp, the way a map sets a name over a drawing. On the bare
 * ground it is invisible; over a picture that reaches under the text (a 3D stage, a photo) it keeps the text readable.
 */
export const halo = (colour: string, r = 3): string =>
  [[-r, 0], [r, 0], [0, -r], [0, r], [-r, -r], [r, -r], [-r, r], [r, r]].map(([x, y]) => `${x * (x && y ? 0.7 : 1)}px ${y * (x && y ? 0.7 : 1)}px 0 ${colour}`).join(', ');

/** Resolve a colour reference: a hex value, a paint name, or a role name. */
export const colour = (th: Theme, ref: unknown, fallback?: string): string => {
  if (typeof ref !== 'string' || !ref) return fallback ?? th.ink;
  if (ref.startsWith('#') || ref.startsWith('rgb')) return ref;
  return th.paint[ref] ?? (th.roles as Record<string, string>)[ref] ?? fallback ?? th.ink;
};
