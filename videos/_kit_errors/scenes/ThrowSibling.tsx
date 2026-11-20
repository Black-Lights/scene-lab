/**
 * @file videos/_kit_errors/scenes/ThrowSibling.tsx
 * @description Error case 3 of 5: a <Stage> whose sibling after it throws in the first frames of the scene,
 *   while the canvas is still being created. The boundary unmounts the half-built stage, which must let go of the
 *   frame it was holding, so the render goes on: the card shows while the scene cuts in, and the stage draws
 *   from t = 0 on.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { AREA, Stage, paint, textStyle, useClock, useTheme, useWorld } from '@kit';
import type { SceneProps } from '@kit';

/** A caption under the stage that needs the scene to have begun: before t = 0 it has nothing to show, and throws. */
const Caption = () => {
  const th = useTheme();
  const t = useClock();
  const w = useWorld();
  // one message for every frame it fails in, so the report holds one line
  if (t < 0) throw new Error('the caption has nothing to show before the scene begins');
  return <div style={{ position: 'absolute', left: AREA.side, top: 760, ...textStyle(th, 'm') }}>{w.props.caption as string}</div>;
};

export default function ThrowSibling({ v }: SceneProps) {
  const th = useTheme();
  const w = useWorld();
  const [x, y, z] = w.places.cube.pos;
  return (
    <AbsoluteFill>
      <Stage v={v}>
        <mesh position={[x, y + 0.5, z]} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshLambertMaterial color={paint(th, 'line')} />
        </mesh>
      </Stage>
      <Caption />
    </AbsoluteFill>
  );
}
