/**
 * @file videos/_kit_world/scenes/Garden.tsx
 * @description Worked example of a 3D world: a small garden with a shed, a rain tank and a raised bed, declared
 *   once in the spec ("worlds.garden") and seen in scenes 1, 2 and 4. Everything is raw react-three-fiber
 *   geometry with matte (Lambert) materials, so the light rig shows each palette colour exactly on a face that
 *   looks up.
 *   - State: "tank" (a number, how full the tank is), "soil" (a colour) and the reserved "focus". A change the spec
 *     starts at the end of scene 1 finishes in scene 2, because every scene of the world shares one timeline.
 *   - Dimming: a thing out of focus mixes its colour toward the ground colour (w.dim), never its opacity.
 *   - Overlay: a Label on the tank and a Counter in a fixed box, both in layout pixels inside the content area.
 *     Their words come from the world's props; this file holds geometry and layout only.
 *   One stage per scene: consecutive scenes of the world are one mount, so the canvas survives the seam.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { AREA, Counter, Label, Stage, mixColour, paint, textStyle, useTheme, useWorld } from '@kit';
import type { Place, SceneProps, WorldState } from '@kit';

type Vec3 = [number, number, number];

/** The shed's roof: its thickness and how far it overhangs the walls, in world units. */
const ROOF = 0.12;
const EAVE = 0.15;

/** A box standing on y = base, centred on (x, z): three's position is the box centre. */
const Block = ({ pos, size, color }: { pos: Vec3; size: Vec3; color: string }) => (
  <mesh position={[pos[0], pos[1] + size[1] / 2, pos[2]]} castShadow receiveShadow>
    <boxGeometry args={size} />
    <meshLambertMaterial color={color} />
  </mesh>
);

/** A place's base and size as numbers, for geometry built on it. */
const box = (p: Place): { pos: Vec3; size: Vec3 } => ({ pos: [p.pos[0], p.pos[1], p.pos[2]], size: [p.size?.[0] ?? 1, p.size?.[1] ?? 1, p.size?.[2] ?? 1] });

/** The colour of a part of place `id`, stepped back toward the ground when the focus is elsewhere. */
const tone = (w: WorldState, bg: string, id: string, color: string) => mixColour(bg, color, w.dim(id));

const Shed = ({ w, bg }: { w: WorldState; bg: string }) => {
  const { pos, size } = box(w.places.shed);
  const th = useTheme();
  // the roof lies inside the place: the walls stop ROOF below its top and the roof overhangs by EAVE on each side,
  // so a label set against the place clears the roof (the place covers everything that is drawn)
  const walls: Vec3 = [size[0] - 2 * EAVE, size[1] - ROOF, size[2] - 2 * EAVE];
  const roof: Vec3 = [size[0], ROOF, size[2]];
  return (
    <group>
      <Block pos={pos} size={walls} color={tone(w, bg, 'shed', paint(th, 'brown'))} />
      <Block pos={[pos[0], pos[1] + walls[1], pos[2]]} size={roof} color={tone(w, bg, 'shed', paint(th, 'ink2'))} />
    </group>
  );
};

/** The tank, and a gauge on its front whose blue part is as high as the tank is full. */
const Tank = ({ w, bg }: { w: WorldState; bg: string }) => {
  const th = useTheme();
  const { pos, size } = box(w.places.tank);
  const r = size[0] / 2;
  const level = w.num('tank');
  const gauge = { h: size[1] * 0.8, w: 0.16, z: pos[2] + r + 0.02 };
  return (
    <group>
      <mesh position={[pos[0], pos[1] + size[1] / 2, pos[2]]} castShadow receiveShadow>
        <cylinderGeometry args={[r, r, size[1], 48]} />
        <meshLambertMaterial color={tone(w, bg, 'tank', paint(th, 'line'))} />
      </mesh>
      <Block pos={[pos[0], pos[1] + size[1] * 0.1, gauge.z]} size={[gauge.w, gauge.h, 0.04]} color={tone(w, bg, 'tank', paint(th, 'surface'))} />
      {/* a filled part of zero height would be a degenerate box: it starts one millimetre tall */}
      <Block pos={[pos[0], pos[1] + size[1] * 0.1, gauge.z + 0.01]} size={[gauge.w * 0.7, Math.max(0.001, gauge.h * level), 0.04]}
        color={tone(w, bg, 'tank', paint(th, 'blue'))} />
    </group>
  );
};

const Bed = ({ w, bg }: { w: WorldState; bg: string }) => {
  const th = useTheme();
  const { pos, size } = box(w.places.bed);
  const body: Vec3 = [size[0], size[1] * 0.8, size[2]];
  const soil: Vec3 = [size[0] - 0.2, 0.02, size[2] - 0.2];
  return (
    <group>
      <Block pos={pos} size={body} color={tone(w, bg, 'bed', paint(th, 'brown'))} />
      <Block pos={[pos[0], pos[1] + body[1], pos[2]]} size={soil} color={tone(w, bg, 'bed', w.color('soil'))} />
    </group>
  );
};

export default function Garden({ v }: SceneProps) {
  const th = useTheme();
  const w = useWorld();
  const words = w.props.words as { tank: string; volume: string };
  const litres = (w.props.litres as number) * w.num('tank');
  // HTML above the picture: a Label that follows the tank, and a Counter in a fixed box at the bottom left of
  // the content area, above the captions. The label is a state of the world too ("tag"): scene 4 opens with it off.
  const overlay = (
    <>
      {w.num('tag') > 0.5 ? <Label on="tank" text={words.tank} side="right" leader /> : null}
      <div style={{ position: 'absolute', left: AREA.side, top: 1080 - AREA.bottom - 120 }}>
        <div style={{ ...textStyle(th, 's'), color: th.ink2 }}>{words.volume}</div>
        <Counter value={litres} unit="L" size="l" />
      </div>
    </>
  );
  return (
    <AbsoluteFill>
      <Stage v={v} overlay={overlay}>
        <Shed w={w} bg={th.bg} />
        <Tank w={w} bg={th.bg} />
        <Bed w={w} bg={th.bg} />
      </Stage>
    </AbsoluteFill>
  );
}
