/**
 * @file kit/paint.ts
 * @description Colour for scene code (architecture sections 1 and 6.1). A colour is never written into a scene
 *   as a value: it is a reference, resolved against the video's design. A reference is a hex string, a paint
 *   name of the theme (yellow, red, blue, ...), a role name (a, b, c, warn), a theme token (ink, ink2, back,
 *   line, surface, bg) or `lit`, the focus band (the theme's own, else the surface mixed toward the ink, as the kit's
 *   parts draw it). An unknown name is an error, never a quiet default: a misspelt colour that fell back to
 *   ink would look deliberate and nobody would find it.
 */
import { useMemo } from 'react';
import { useTheme } from '../theme';
import type { Theme } from '../theme';
import { mixColour } from './time';

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const TOKENS = ['ink', 'ink2', 'back', 'line', 'surface', 'bg'] as const;
const ROLES = ['a', 'b', 'c', 'warn'] as const;

/** #abc and #AABBCC both become #aabbcc, so two spellings of one colour compare and mix alike. */
const tidy = (hex: string): string => {
  const m = HEX.exec(hex.trim());
  return m ? '#' + (m[1].length === 3 ? m[1].split('').map((x) => x + x).join('') : m[1]).toLowerCase() : hex;
};

/** The hex colour a reference stands for in this theme, as #rrggbb. Throws for a name the theme does not have. */
export const paint = (th: Theme, ref: string): string => {
  if (typeof ref === 'string') {
    const r = ref.trim();
    if (HEX.test(r)) return tidy(r);
    // a paint name first: a video may repaint a role name on purpose (its design's "paint" block)
    const named = th.paint?.[r] ?? ((ROLES as readonly string[]).includes(r) ? (th.roles as Record<string, string>)[r] : undefined);
    if (typeof named === 'string') return tidy(named);
    if ((TOKENS as readonly string[]).includes(r)) return tidy((th as unknown as Record<string, string>)[r]);
    // only the stage theme has a band of its own; the fallback is the one parts2d and TextCard draw
    if (r === 'lit') return th.lit ? paint(th, th.lit) : mixColour(paint(th, 'surface'), paint(th, 'ink'), 0.12);
  }
  throw new Error(`colour ${JSON.stringify(ref)} is not a hex value, a paint (${Object.keys(th.paint ?? {}).join(', ')}), ` +
    `a role (${ROLES.join(', ')}) or a token (${TOKENS.join(', ')}, lit)`);
};

/** paint() bound to the video's theme: `const c = usePaint(); c('warn')`. A plain function, usable in loops. */
export const usePaint = (): ((ref: string) => string) => {
  const th = useTheme();
  return useMemo(() => (ref: string) => paint(th, ref), [th]);
};

/** Relative luminance (WCAG) of a `#rrggbb` colour. */
const luminance = (hex: string): number => {
  const lin = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(1) + 0.7152 * lin(3) + 0.0722 * lin(5);
};

/**
 * The contrast ratio (WCAG, 1 to 21) of two `#rrggbb` colours: 4.5 is the floor for small text, 3 for large text
 * and lines. Pass resolved colours (paint() first). Example: the ink that reads best on a fill,
 * `contrast(th.ink, fill) >= contrast(th.bg, fill) ? th.ink : th.bg`.
 */
export const contrast = (a: string, b: string): number => {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};
