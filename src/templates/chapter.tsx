/**
 * @file chapter.tsx
 * @description `chapter`: the short silent card make.py puts before the first scene of every chapter (a scene
 *   with a heading). The title itself is drawn by Progress.tsx, because it flies from this card into the
 *   progress bar; this template draws the rule under it and the meta line under the rule (never above the title).
 */
import React from 'react';
import { useTheme } from '../theme';
import { CARD } from '../Progress';
import { DUR, EASE, prog, useClock } from '../motion';
import { useGlyphs } from '../glyphs';
import { Glyph } from '../draw';

const WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

export const Chapter = ({ v }: { v: { title?: string; n?: number; of?: number } }) => {
  const th = useTheme();
  const t = useClock();
  const g = useGlyphs();
  const e = prog(t, 0.1, DUR.draw, EASE.move);
  const w = Math.min(1500, (v.title?.length ?? 8) * CARD.size * 0.5);
  const y = CARD.y + CARD.size * 1.3;
  const meta = v.n && v.of ? `Chapter ${WORDS[v.n] ?? v.n} of ${WORDS[v.of] ?? v.of}` : '';
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        {e > 0 ? <line x1={CARD.x} x2={CARD.x + w * e} y1={y} y2={y} stroke={th.ink} strokeWidth={3} strokeLinecap="round" /> : null}
        {g.motif ? <Glyph icon={g.motif} size={64} color={th.ink} x={1920 - 110 - 64} y={CARD.y + 8} style={{ opacity: prog(t, 0.2, DUR.enter) }} /> : null}
      </svg>
      {meta ? (
        <div style={{ position: 'absolute', left: CARD.x, top: y + 26, fontSize: 34, fontWeight: th.weight.text, color: th.ink2, opacity: prog(t, 0.35, DUR.enter) }}>
          {meta}
        </div>
      ) : null}
    </div>
  );
};
