/**
 * @file Strip.tsx
 * @description Filmstrip of one scene for cheap motion review (make.py --strip N): the real video, frozen at
 *   8 chosen frames and tiled 2 x 4 in one still, each cell labelled with its time in the scene. make.py picks
 *   the frames around the scene's cue times, so frames land mid-motion as well as at rest.
 * @see Root.tsx (registers the "Strip" composition), ../make.py (strip_times)
 */
import React from 'react';
import { AbsoluteFill, Freeze } from 'remotion';
import { Explainer } from './Explainer';
import type { Props } from './types';

export type StripInfo = { frames: number[]; labels: string[]; cols: number; cellW: number; width: number; height: number };
export const STRIP_GAP = 10;
export const STRIP_LABEL = 34;

export const Strip = (p: Props & { strip?: StripInfo }) => {
  const st = p.strip;
  if (!st) return null;
  const cellH = Math.round((st.cellW * 9) / 16);
  const s = st.cellW / 1920;
  return (
    <AbsoluteFill style={{ background: '#1b1b1b', fontFamily: 'Segoe UI, sans-serif' }}>
      {st.frames.map((f, i) => {
        const col = i % st.cols;
        const row = Math.floor(i / st.cols);
        const left = STRIP_GAP + col * (st.cellW + STRIP_GAP);
        const top = STRIP_GAP + row * (cellH + STRIP_LABEL + STRIP_GAP);
        return (
          <div key={i} style={{ position: 'absolute', left, top, width: st.cellW }}>
            <div style={{ width: st.cellW, height: cellH, overflow: 'hidden', position: 'relative' }}>
              <div style={{ width: 1920, height: 1080, transform: `scale(${s})`, transformOrigin: '0 0' }}>
                <Freeze frame={f}>
                  <Explainer {...p} />
                </Freeze>
              </div>
            </div>
            <div style={{ height: STRIP_LABEL, lineHeight: `${STRIP_LABEL}px`, fontSize: 20, color: '#d8d8d8' }}>
              {i + 1}. {st.labels[i]}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
