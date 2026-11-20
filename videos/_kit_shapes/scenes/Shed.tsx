/**
 * @file videos/_kit_shapes/scenes/Shed.tsx
 * @description Worked example of the kit's 3D shapes and materials (docs/kit/shapes.md) on an everyday subject: a
 *   garden shed. The shed is a Room with a door in its front wall and a roof that lifts away (track "lid") so the
 *   camera can look in; a stone path is laid up to the door as a Slab in coloured parts (track "path"); a planter is a
 *   Box with its Edges drawn; a lamp inside is a Box with a Glow material (track "lamp"); and a bin that is only planned
 *   is a Box with a Ghost material. Every shape stands on its place from the spec (pos = centre of the base), so the
 *   camera frames what is drawn. Colours are paints and tokens of the theme; words come from ../data/shed.json.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Box, Edges, Ghost, Glow, Room, SceneTitle, Slab, Stage, mixColour, paint, useClock, useTheme, useWorld } from '@kit';
import type { Place, SceneProps, Vec3 } from '@kit';
import words from '../data/shed.json';

const base = (p: Place): Vec3 => [p.pos[0], p.pos[1], p.pos[2] ?? 0];
const size = (p: Place): Vec3 => [p.size?.[0] ?? 1, p.size?.[1] ?? 1, p.size?.[2] ?? 1];

export default function Shed({ v }: SceneProps) {
  const th = useTheme();
  const t = useClock();
  const w = useWorld();
  const shed = w.places.shed;
  const [sw, sh, sd] = size(shed);
  const lamp = w.num('lamp');
  const wood = paint(th, 'brown');
  return (
    <AbsoluteFill>
      <Stage v={v} rect={[0, 180, 1920, 900]}>
        <Room pos={base(shed)} shape={{ w: sw, h: sh, d: sd, k: 0.1, opening: { w: 0.8, h: 1.5, y: 0 } }} shadow
          wall={wood} inside={mixColour(wood, paint(th, 'bg'), 0.5)} floor={mixColour(paint(th, 'surface'), wood, 0.25)}
          edge="ink" line="line" beam={0.03} roof={0.05} lid={w.num('lid')} glow={{ color: 'yellow', k: lamp * 0.4 }} />
        <Slab start={[0, 0, base(shed)[2] + sd / 2 + 0.05]} len={size(w.places.path)[2]} w={0.7} k={0.03} shown={w.num('path')}
          parts={words.stones.map((c, i) => ({ color: c, share: i % 2 ? 1 : 1.4 }))} />
        <Box pos={base(w.places.planter)} size={size(w.places.planter)} color="green" shadow />
        <Edges pos={base(w.places.planter)} size={size(w.places.planter)} color="ink" k={0.025} />
        <Box pos={base(w.places.lamp)} size={size(w.places.lamp)} color="yellow">
          <Glow color={mixColour(paint(th, 'surface'), paint(th, 'yellow'), 0.3 + 0.7 * lamp)} glow="yellow" k={lamp} />
        </Box>
        <Box pos={base(w.places.bin)} size={size(w.places.bin)} color="green">
          <Ghost color="green" opacity={0.3} />
        </Box>
      </Stage>
      <SceneTitle text={v.title} t={t} />
    </AbsoluteFill>
  );
}
