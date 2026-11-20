/**
 * @file videos/moon-phases-2d/scenes/MoonFace.tsx
 * @description The opening picture: the Moon as we see it in the evening sky, over one cycle. One large disc whose
 *   lit part follows the "phase" track (0 new, 0.5 full, 1 new again), moved by the spec on the spoken words, and
 *   under it the eight phases in a row with the current one ringed. The unlit part is drawn only as a faint disc,
 *   as earthshine shows it, so the ball is there while its light is not.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { SceneTitle, paint, useClock, useTheme, useWorld } from '@kit';
import type { SceneProps } from '@kit';
import { litPath } from './lib/moon';

const BIG = { x: 960, y: 470, r: 200 };
const ROW = { y: 790, r: 24, gap: 110 };

export default function MoonFace({ v }: SceneProps) {
  const th = useTheme();
  const t = useClock();
  const w = useWorld();
  const phase = w.num('phase'); // 0..1 over one cycle
  const lit = paint(th, 'moonlit');
  const faint = paint(th, 'earthshine');
  const now = Math.round(((phase % 1) + 1) % 1 * 8) % 8; // the phase in the row nearest to the big disc
  return (
    <AbsoluteFill>
      <SceneTitle text={v.title} t={t} />
      <svg width={1920} height={1080} style={{ position: 'absolute', left: 0, top: 0 }}>
        <circle cx={BIG.x} cy={BIG.y} r={BIG.r} fill={faint} />
        <path d={litPath(BIG.x, BIG.y, BIG.r, phase * 360)} fill={lit} />
        {Array.from({ length: 8 }, (_, i) => {
          const x = BIG.x + (i - 3.5) * ROW.gap;
          return (
            <g key={i}>
              <circle cx={x} cy={ROW.y} r={ROW.r} fill={faint} />
              <path d={litPath(x, ROW.y, ROW.r, i * 45)} fill={lit} />
              {i === now ? (
                <circle cx={x} cy={ROW.y} r={ROW.r + 10} fill="none" stroke={th.ink2} strokeWidth={th.stroke * 1.5} />
              ) : null}
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
}
