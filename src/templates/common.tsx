/**
 * @file common.tsx
 * @description Pieces every v0.2 template shares: the scene title (sentence case, top left, never a label above
 *   it), a picture frame, the focus colour of an item (in focus, or stepped back once the next one is spoken),
 *   and the reveal list for items with cues.
 */
import React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Img, interpolateColors, staticFile } from 'remotion';
import { fitText } from '@remotion/layout-utils';
import { AREA, fit, useTheme } from '../theme';
import type { Theme } from '../theme';
import { DUR, EASE, atOf, clamp01, prog } from '../motion';
import { Glyph } from '../draw';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Any = any;
export const txt = (it: Any): string => (typeof it === 'string' ? it : it?.text ?? it?.label ?? '');

/** Reveal times for a list (cue or stagger) and, per item, how far it has stepped back because a later one is spoken. */
export const useReveal = (items: Any[], dur: number, t: number) => {
  const ats = items.map((it, i) => atOf(it, i, items.length, dur));
  return items.map((_, i) => {
    const next = ats.slice(i + 1).find((a) => a > ats[i] + 0.05);
    return { at: ats[i], shown: prog(t, ats[i], DUR.enter), back: next === undefined ? 0 : prog(t, next, DUR.settle, EASE.move) };
  });
};

export const inkOf = (th: Theme, back: number, base?: string) => interpolateColors(clamp01(back), [0, 1], [base ?? th.ink, th.back]);

/** Enter style: fade and a short rise, eased; nothing overshoots. */
export const rise = (p: number, dy = 24): CSSProperties => ({ opacity: p, transform: `translateY(${(1 - p) * dy}px)` });

/** Largest font size (capped) at which `text` fits `width` in the theme's display face (@remotion/layout-utils). */
export const fitSize = (th: Theme, text: string, width: number, max: number, weight?: number) => {
  try {
    const { fontSize } = fitText({ text, withinWidth: width, fontFamily: th.font.display, fontWeight: String(weight ?? th.weight.display) });
    return Math.min(max, fontSize);
  } catch {
    return fit(text, max, Math.round(width / (max * 0.55)));
  }
};

export const SceneTitle = ({ text, t }: { text?: string; t: number }) => {
  const th = useTheme();
  if (!text) return null;
  return (
    <div style={{ position: 'absolute', left: AREA.side, top: AREA.top - 4, width: 1920 - 2 * AREA.side, ...rise(prog(t, -0.6, DUR.enter)),
      fontFamily: th.font.display, fontWeight: th.weight.display, fontSize: fitSize(th, text, 1500, 54), lineHeight: 1.15, color: th.ink }}>
      {text}
    </div>
  );
};

/** An icon, or a fetched picture ({src, credit} from make.py) in a small frame. */
export const Mark = ({ icon, image, size, color }: { icon?: Any; image?: Any; size: number; color?: string }) => {
  const th = useTheme();
  if (image?.src)
    return <Img src={staticFile(image.src)} style={{ width: size, height: size, objectFit: 'cover', borderRadius: th.radius * 0.6, border: `3px solid ${th.ink}`, flex: 'none' }} />;
  if (icon && typeof icon === 'object') return <Glyph icon={icon} size={size} color={color ?? th.ink} />;
  return null;
};

/** The look's plate: figure white with an ink keyline (plate), an outline (stage), paper (ground). */
export const plateStyle = (th: Theme, back = 0): CSSProperties =>
  th.look === 'stage'
    ? { background: 'transparent', border: `2px solid ${inkOf(th, back)}`, borderRadius: th.radius }
    : th.look === 'ground'
      ? { background: th.surface, borderRadius: th.radius }
      : { background: th.surface, border: `3px solid ${inkOf(th, back)}`, borderRadius: th.radius };

export const Plate = ({ style, children, back = 0 }: { style?: CSSProperties; children: ReactNode; back?: number }) => {
  const th = useTheme();
  return <div style={{ ...plateStyle(th, back), ...style }}>{children}</div>;
};
