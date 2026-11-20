/**
 * @file videos/_kit_core/scenes/Slabs.tsx
 * @description Smoke test of the core on its 3D path: a free scene with a <Stage>, places and a shot from the
 *   spec, raw react-three-fiber meshes, and labels given as data. Two checks of section 6.8 live here:
 *   - Light and colour: three slabs of matte (Lambert) material under the studio rig. Their tops must read their
 *     own colour within 2 levels in a PNG still (white #FFFFFF, grey #808080 and the theme's blue); the slab
 *     colours are listed in the spec's props so a script can test the picture against the same numbers.
 *   - One engine: <OneEngine> sits inside the canvas and compares what it reads (the theme, the scene, the clock,
 *     world time) with the values read outside it. If a library upgrade breaks the context bridge, it throws,
 *     the scene becomes the plain card and make.py exits with an error.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { SceneTitle, Stage, paint, useClock, useScene, useTheme, useWorld } from '@kit';
import type { Place, SceneInfo, SceneProps, Theme } from '@kit';

type Outside = { th: Theme; scene: SceneInfo; t: number; T: number };

/** Inside the canvas: every value must be the very one the scene reads outside it (identity, not equality). */
const OneEngine = ({ outside }: { outside: Outside }) => {
  const th = useTheme();
  const scene = useScene();
  const t = useClock();
  const { T } = useWorld();
  const wrong = [th !== outside.th && 'the theme', scene !== outside.scene && 'the scene', t !== outside.t && 'the clock',
    T !== outside.T && 'world time'].filter(Boolean);
  if (wrong.length) throw new Error(`one engine: ${wrong.join(', ')} inside the canvas differ from outside it, so the context bridge is broken`);
  return null;
};

/** A slab standing on its place: three's position is the box centre, a place's pos is the centre of its base. */
const Slab = ({ place, color }: { place: Place; color: string }) => {
  const [x, y, z] = place.pos;
  const [w, h, d] = place.size ?? [1, 1, 1];
  return (
    <mesh position={[x, y + h / 2, z]} castShadow receiveShadow>
      <boxGeometry args={[w, h, d]} />
      <meshLambertMaterial color={color} />
    </mesh>
  );
};

export default function Slabs({ v }: SceneProps) {
  const th = useTheme();
  const t = useClock();
  const scene = useScene();
  const w = useWorld();
  const slabs = w.props.slabs as { on: string; color: string }[];
  return (
    <AbsoluteFill>
      <Stage v={v}>
        {slabs.map((s) => (
          <Slab key={s.on} place={w.places[s.on]} color={paint(th, s.color)} />
        ))}
        <OneEngine outside={{ th, scene, t, T: w.T }} />
      </Stage>
      <SceneTitle text={v.title} t={t} />
    </AbsoluteFill>
  );
}
