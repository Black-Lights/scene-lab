/**
 * @file analogy.tsx
 * @description `analogy`: the real thing on the left, what it is like on the right, and a connector that draws
 *   between them when the analogy is named. With matching "items" on both sides, each pair is linked by its own
 *   line on its cue (the mapping beat: analogy part beside real part), so the two sides visibly connect.
 */
import React from 'react';
import { fit, useTheme } from '../theme';
import { DUR, EASE, atOf, prog, useClock } from '../motion';
import { DrawPath } from '../draw';
import { Any, Mark, SceneTitle, inkOf, plateStyle, rise, txt } from './common';

export const Analogy = ({ v, dur }: { v: Any; dur: number }) => {
  const th = useTheme();
  const t = useClock();
  const L = v.left || {};
  const R = v.right || {};
  const tL = typeof L.at === 'number' ? L.at : 0.2;
  const tR = typeof R.at === 'number' ? R.at : Math.min(dur * 0.4, 3);
  const li: Any[] = L.items || [];
  const ri: Any[] = R.items || [];
  const pairs = Math.min(li.length, ri.length);
  const pairAt = Array.from({ length: pairs }, (_, k) => (typeof ri[k]?.at === 'number' ? ri[k].at : atOf(ri[k], k, pairs, dur) + tR));
  const top = pairs ? (v.title ? 220 : 170) : 330; // without matched parts the two plates sit mid-frame
  const plateW = 700;
  const xL = 110;
  const xR = 1920 - 110 - plateW;
  const headH = 210;
  const rowY = (k: number) => top + headH + 60 + k * 86;
  const side = (s: Any, x: number, at: number, items: Any[], key: string) => (
    <div key={key} style={{ position: 'absolute', left: x, top, width: plateW, ...rise(prog(t, at, DUR.enter)) }}>
      <div style={{ ...plateStyle(th), height: headH, display: 'flex', alignItems: 'center', gap: 34, padding: '0 40px' }}>
        <Mark icon={s.icon} image={s.image} size={120} />
        <div>
          <div style={{ fontFamily: th.font.display, fontWeight: th.weight.display, fontSize: fit(s.label, 50, 18), color: th.ink, lineHeight: 1.12 }}>{s.label}</div>
          {s.sub ? <div style={{ fontSize: fit(s.sub, 32, 34), color: th.ink2, marginTop: 10, lineHeight: 1.25 }}>{s.sub}</div> : null}
        </div>
      </div>
    </div>
  );
  const link = prog(t, tR, DUR.draw, EASE.move);
  const midY = top + headH / 2;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <SceneTitle text={v.title} t={t} />
      {side(L, xL, tL, li, 'L')}
      {side(R, xR, tR, ri, 'R')}
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <DrawPath d={`M ${xL + plateW + 6} ${midY} L ${xR - 6} ${midY}`} p={link} color={th.ink} width={3} />
        <text x={960} y={midY - 22} textAnchor="middle" fontSize={32} fontFamily={th.font.text} fontWeight={th.weight.strong} fill={th.ink2}
          opacity={prog(t, tR + 0.3, DUR.enter)}>{v.link ?? 'is like'}</text>
        {Array.from({ length: pairs }, (_, k) => {
          const at = pairAt[k];
          const next = pairAt.slice(k + 1).find((a) => a > at + 0.05);
          const ink = inkOf(th, next === undefined ? 0 : prog(t, next, DUR.settle, EASE.move));
          const y = rowY(k);
          const e = prog(t, at - 0.15, DUR.enter);
          return (
            <g key={k}>
              <g opacity={e}>
                <text x={xL + plateW - 24} y={y + 11} textAnchor="end" fontSize={fit(txt(li[k]), 34, 30)} fontFamily={th.font.text} fontWeight={th.weight.strong} fill={ink}>
                  {txt(li[k])}
                </text>
                <text x={xR + 24} y={y + 11} fontSize={fit(txt(ri[k]), 34, 30)} fontFamily={th.font.text} fontWeight={th.weight.strong} fill={ink}>{txt(ri[k])}</text>
              </g>
              <DrawPath d={`M ${xL + plateW + 6} ${y} L ${xR - 6} ${y}`} p={prog(t, at, DUR.draw, EASE.move)} color={ink} width={2} dashed />
            </g>
          );
        })}
      </svg>
    </div>
  );
};
