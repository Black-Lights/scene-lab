/**
 * @file Progress.tsx
 * @description The progress bar shows the chapters: one segment per chapter, filled up to now, and the current
 *   chapter's name in its own segment. At a chapter card the title is drawn large, then flies into that name
 *   slot (a shared element across the cut), so the bar says where you are without a heading on every scene.
 *   Per look: plate = an engineering dimension line (name in a gap of its segment), stage = a filled track with
 *   the name under it, ground = filled versus hollow segments with the chapter number and name under them.
 *   The bar is drawn above every scene (Explainer.tsx) and carries a halo of the ground colour around its name and
 *   its lines: invisible on the bare ground, it keeps the bar readable when a scene's picture (a 3D stage seen up
 *   close, a photo) reaches under it.
 */
import React from 'react';
import { interpolateColors, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Chapter, Scene } from './types';
import { halo, useTheme } from './theme';
import type { Theme } from './theme';
import { DUR, EASE, clamp01, lerp, prog } from './motion';
import { measureText } from '@remotion/layout-utils';

export const CARD = { x: 110, y: 420, size: 96 };

/** A halo for a drawing: four sharp shadows in the ground colour, chained, so every line gets a rim of ground. */
const rim = (bg: string, r = 3) => [[r, 0], [-r, 0], [0, r], [0, -r]].map(([x, y]) => `drop-shadow(${x}px ${y}px 0 ${bg})`).join(' ');

type Seg = { title: string; start: number; end: number; card?: Chapter['card']; n: number; sx: number; ex: number };

const BAR = (th: Theme) =>
  th.look === 'ground' ? { y: 24, x0: 120, x1: 1800, gap: 8, name: 30 } : th.look === 'stage' ? { y: 40, x0: 96, x1: 1824, gap: 10, name: 28 } : { y: 48, x0: 96, x1: 1824, gap: 10, name: 28 };

/** Top-left of the current chapter's name, per look. */
const nameSlot = (th: Theme, g: Seg, label: string) => {
  const b = BAR(th);
  let w = label.length * b.name * 0.6;
  try {
    w = measureText({ text: label, fontFamily: th.font.display, fontSize: b.name, fontWeight: String(th.weight.strong) }).width;
  } catch {
    // the estimate above stands in if the face is not measurable yet
  }
  if (th.chrome?.progress === 'corner') return { x: 1920 - 64 - w, y: 60, w };
  if (th.look === 'plate') return { x: g.sx + 20, y: b.y - b.name * 0.62, w };
  return { x: Math.min(g.sx, b.x1 - w), y: b.y + 16, w };
};

export const Progress = ({ chapters, scenes, duration }: { chapters: Chapter[]; scenes: Scene[]; duration: number }) => {
  const th = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  void scenes;
  const b = BAR(th);
  const raw: Omit<Seg, 'sx' | 'ex'>[] = [];
  if (chapters.length && chapters[0].start > 0.5) raw.push({ title: '', start: 0, end: chapters[0].start, n: 0 });
  chapters.forEach((c, i) => raw.push({ ...c, n: i + 1 }));
  if (!raw.length) raw.push({ title: '', start: 0, end: duration, n: 0 });
  const span = b.x1 - b.x0 - b.gap * (raw.length - 1);
  let x = b.x0;
  const geo: Seg[] = raw.map((s) => {
    const w = Math.max(8, (span * (s.end - s.start)) / duration);
    const g = { ...s, sx: x, ex: x + w };
    x += w + b.gap;
    return g;
  });
  const cur = Math.max(0, geo.findIndex((g) => t >= g.start && t < g.end));
  const label = (g: Seg) => (th.look === 'ground' && g.n ? `${g.n}  ${g.title}` : g.title);

  // a chapter card's title flies into the bar
  let flying: React.ReactElement | null = null;
  let hide = -1;
  geo.forEach((g, k) => {
    if (!g.card || !g.title) return;
    const flyAt = g.card.start + g.card.dur - 0.45;
    const until = flyAt + DUR.morph;
    if (t < g.card.start - 0.2 || t > until) return;
    const slot = nameSlot(th, g, label(g));
    const e = prog(t, g.card.start - 0.1, DUR.enter);
    const f = prog(t, flyAt, DUR.morph, EASE.move);
    const sc = lerp(1, b.name / CARD.size, f);
    flying = (
      <div key={`fly${k}`} style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', whiteSpace: 'nowrap',
        transform: `translate(${lerp(CARD.x, slot.x, f)}px, ${lerp(CARD.y, slot.y, f) + (1 - e) * 40}px) scale(${sc})`, opacity: e,
        fontFamily: th.font.display, fontWeight: th.weight.display, fontSize: CARD.size, lineHeight: 1,
        color: interpolateColors(f, [0, 1], [th.look === 'ground' ? th.surface : th.ink, th.ink]) }}>
        {label(g)}
      </div>
    );
    hide = k;
  });

  const lines: React.ReactElement[] = [];
  geo.forEach((g, k) => {
    const done = clamp01((t - g.start) / Math.max(0.01, g.end - g.start));
    const fx = g.sx + (g.ex - g.sx) * done;
    const showName = k === cur && !!g.title;
    const slot = nameSlot(th, g, label(g));
    if (th.look === 'plate') {
      // dimension line: extension ticks at both ends, the name breaks the line
      const gapL = showName ? slot.x - 12 : g.ex;
      const gapR = showName ? Math.min(g.ex, slot.x + slot.w + 12) : g.ex;
      const seg = (a: number, z: number, w: number, c: string, key: string) =>
        z > a ? <line key={key} x1={a} x2={z} y1={b.y} y2={b.y} stroke={c} strokeWidth={w} /> : null;
      lines.push(
        <g key={k}>
          <line x1={g.sx} x2={g.sx} y1={b.y - 8} y2={b.y + 8} stroke={th.ink} strokeWidth={2} />
          <line x1={g.ex} x2={g.ex} y1={b.y - 8} y2={b.y + 8} stroke={th.ink} strokeWidth={2} />
          {seg(g.sx, Math.min(gapL, g.ex), 2, th.line, 'a')}
          {seg(gapR, g.ex, 2, th.line, 'b')}
          {seg(g.sx, Math.min(fx, gapL), 4, th.ink, 'c')}
          {fx > gapR ? seg(gapR, fx, 4, th.ink, 'd') : null}
        </g>,
      );
    } else if (th.look === 'stage') {
      lines.push(
        <g key={k}>
          <rect x={g.sx} y={b.y - 3} width={g.ex - g.sx} height={6} rx={3} fill="#2E4239" />
          {done > 0 ? <rect x={g.sx} y={b.y - 3} width={Math.max(0.5, fx - g.sx)} height={6} rx={3} fill={th.ink} /> : null}
        </g>,
      );
    } else {
      lines.push(
        <g key={k}>
          <rect x={g.sx + 1} y={b.y - 3} width={g.ex - g.sx - 2} height={6} fill="none" stroke={th.ink} strokeWidth={2} />
          {done > 0 ? <rect x={g.sx} y={b.y - 4} width={Math.max(0.5, fx - g.sx)} height={8} fill={th.ink} /> : null}
        </g>,
      );
    }
  });
  const c = geo[cur];
  if (th.chrome?.progress === 'corner') {
    // a compact index in the top-right corner: chapter n of N, its name, and the whole video's progress as a line
    const named = geo.filter((g) => g.title);
    const ci = named.indexOf(c);
    const all = clamp01(t / Math.max(1, duration));
    return (
      <>
        <div style={{ position: 'absolute', right: 64, top: 34, textAlign: 'right', fontFamily: th.font.display, color: th.ink, lineHeight: 1.2, textShadow: halo(th.bg) }}>
          {c?.title && hide !== cur ? (
            <>
              <div style={{ fontSize: 22, color: th.ink2, fontVariantNumeric: 'tabular-nums' }}>{ci + 1} / {named.length}</div>
              <div style={{ fontSize: 30, fontWeight: th.weight.strong }}>{c.title}</div>
            </>
          ) : null}
          <svg width={260} height={10} style={{ display: 'block', marginLeft: 'auto', marginTop: 8, overflow: 'visible', filter: rim(th.bg) }}>
            <line x1={0} x2={260} y1={5} y2={5} stroke={th.line} strokeWidth={3} strokeLinecap="round" />
            <line x1={0} x2={Math.max(0.5, 260 * all)} y1={5} y2={5} stroke={th.ink} strokeWidth={3} strokeLinecap="round" />
          </svg>
        </div>
        {flying}
      </>
    );
  }
  return (
    <>
      <svg width={1920} height={110} style={{ position: 'absolute', left: 0, top: 0, filter: rim(th.bg) }}>{lines}</svg>
      {c?.title && hide !== cur ? (
        <div style={{ position: 'absolute', left: nameSlot(th, c, label(c)).x, top: nameSlot(th, c, label(c)).y, whiteSpace: 'nowrap',
          fontFamily: th.font.display, fontWeight: th.weight.strong, fontSize: b.name, lineHeight: 1.2, color: th.ink, textShadow: halo(th.bg) }}>
          {label(c)}
        </div>
      ) : null}
      {flying}
    </>
  );
};
