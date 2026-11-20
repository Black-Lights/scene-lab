/**
 * @file videos/_kit_errors/scenes/ThrowLater.tsx
 * @description Error case 4 of 5: a scene that draws correctly for its first second and then throws. It shows one
 *   item of a list per second, and the list in its spec has one item only. The boundary judges every frame on its
 *   own, so the frames before the error keep their picture and only the later ones become the card.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { AREA, textStyle, useClock, useTheme, useWorld } from '@kit';
import type { SceneProps } from '@kit';

export default function ThrowLater(_: SceneProps) {
  const th = useTheme();
  const t = useClock();
  const w = useWorld();
  const items = w.props.items as { text: string }[];
  // from t = 1 s this reads past the end of the list
  const item = items[Math.max(0, Math.floor(t))];
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: AREA.side, top: 420, ...textStyle(th, 'l') }}>{item.text}</div>
    </AbsoluteFill>
  );
}
