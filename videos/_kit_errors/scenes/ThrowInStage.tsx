/**
 * @file videos/_kit_errors/scenes/ThrowInStage.tsx
 * @description Error case 2 of 5: a throw among the 3D children of a <Stage>, inside the canvas. A colour the
 *   theme does not have is an error. react-three-fiber would report it as a global error event, which stops a
 *   render; the canvas host records it, cancels that event and hands the error out to the DOM side, where the
 *   scene's boundary draws the plain card.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Stage, paint, useTheme, useWorld } from '@kit';
import type { SceneProps } from '@kit';

const Cube = () => {
  const th = useTheme();
  const w = useWorld();
  const [x, y, z] = w.places.cube.pos;
  return (
    <mesh position={[x, y + 0.5, z]}>
      <boxGeometry args={[1, 1, 1]} />
      {/* "purple" is not a paint of this theme: paint() throws */}
      <meshLambertMaterial color={paint(th, 'purple')} />
    </mesh>
  );
};

export default function ThrowInStage({ v }: SceneProps) {
  return (
    <AbsoluteFill>
      <Stage v={v}>
        <Cube />
      </Stage>
    </AbsoluteFill>
  );
}
