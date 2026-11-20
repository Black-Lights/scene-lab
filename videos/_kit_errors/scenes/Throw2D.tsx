/**
 * @file videos/_kit_errors/scenes/Throw2D.tsx
 * @description Error case 1 of 5: a 2D scene that throws on every frame. It reads a track its spec does not
 *   declare, a real mistake: the kit throws rather than read a quiet 0, the scene's boundary draws the plain card
 *   for each frame, and the error channel writes one line for the report.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { AREA, Counter, useWorld } from '@kit';
import type { SceneProps } from '@kit';

export default function Throw2D(_: SceneProps) {
  const w = useWorld();
  // the spec declares "level" only, so this read throws
  const speed = w.num('speed');
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: AREA.side, top: 400 }}>
        <Counter value={speed} size="l" />
      </div>
    </AbsoluteFill>
  );
}
