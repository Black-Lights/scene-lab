/**
 * @file Captions.tsx
 * @description Burned-in captions from Kokoro's word timings (make.py groups words into lines). A whole phrase at a
 *   time, cut on and off like broadcast subtitles: no word-by-word highlight. Lives in the bottom band that
 *   templates never use (AREA.bottom). Per look: plate = ink text on the ground, left-aligned like a figure caption;
 *   stage = an opaque plate centred (the subtitle convention); ground = a full-width ink band, with a small paint
 *   chip before every paint word so the caption carries the same colour role as the drawing.
 *   Captions are drawn above every scene (Explainer.tsx). The plate look's captions have no plate, so they carry a
 *   halo of the ground colour: invisible on the bare ground, it keeps them readable over a picture that reaches the
 *   bottom of the frame.
 */
import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { Caption } from './types';
import { halo, useTheme } from './theme';

const COLOUR_WORDS = new Set(['yellow', 'red', 'blue', 'orange', 'green', 'brown', 'purple', 'pink', 'grey', 'violet', 'cyan']);

export const Captions = ({ caps }: { caps: Caption[] }) => {
  const th = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  let cur: Caption | undefined;
  for (const c of caps) {
    if (c.s <= t) cur = c;
    else break;
  }
  const k = th.caption;
  const band = k.align === 'band';
  const words = cur && t <= cur.e + 0.5 ? cur.words : [];
  const chip = (w: string) => {
    const key = w.toLowerCase().replace(/[^a-z]/g, '');
    // a chip only before real colour words: a design may name its content colours after roles ("agent", "server")
    const c = band && COLOUR_WORDS.has(key) ? th.paint[key] : undefined;
    return c ? <span style={{ display: 'inline-block', width: 30, height: 30, background: c, borderRadius: 3, border: `2px solid ${k.ink}`, marginRight: 10, verticalAlign: '-3px' }} /> : null;
  };
  const text = words.map((w, i) => (
    <span key={i}>
      {chip(w.w)}
      {w.w}
      {i < words.length - 1 ? ' ' : ''}
    </span>
  ));
  const font = k.font ?? th.font.text;
  if (band)
    return (
      <div style={{ position: 'absolute', left: 0, right: 0, top: 870, bottom: 0, background: k.plate, display: 'flex', alignItems: 'center',
        padding: '0 120px', fontFamily: font, fontSize: k.size, fontWeight: th.weight.text, lineHeight: 1.36, color: k.ink }}>
        {words.length ? <div style={{ maxWidth: 1680 }}>{text}</div> : null}
      </div>
    );
  if (!words.length) return null;
  if (k.align === 'left')
    return (
      <div style={{ position: 'absolute', left: 96, width: 1500, bottom: 58, fontFamily: font, fontSize: k.size, fontWeight: th.weight.text,
        lineHeight: 1.25, color: k.ink, textShadow: halo(th.bg) }}>
        {text}
      </div>
    );
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 44, display: 'flex', justifyContent: 'center' }}>
      <div style={{ maxWidth: 1560, padding: '10px 24px 12px', borderRadius: k.radius, background: k.plate, fontFamily: font, fontSize: k.size,
        fontWeight: th.weight.text, lineHeight: 1.28, color: k.ink }}>
        {text}
      </div>
    </div>
  );
};
