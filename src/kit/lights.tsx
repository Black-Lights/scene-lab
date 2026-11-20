/**
 * @file kit/lights.tsx
 * @description The light rig, the ground and the fog of a <Stage> (architecture sections 6.4, 6.7 and 6.8).
 *   REFINED BY WORK PACKAGE A1 (3D looks and labels): the three looks may change, the rules below may not.
 *   The contract A1 keeps, because stage.tsx calls it: <Lights look bounds pose />, <Ground ground bounds /> and
 *   <Fog fog bounds dist />, where `bounds` is the box and sphere around the stage's places and `pose` is the
 *   camera at this frame.
 *   Colour rule (6.8): the canvas is `flat` (no tone mapping) with sRGB output, and every look is normalised so
 *   that a matte surface facing straight up shows its palette colour exactly. In three.js a lit matte surface
 *   reflects albedo * E / pi, where E is the light reaching it, so for a face whose normal is +Y the key's
 *   intensity times its cosine, plus the fill's, plus the sky term of the hemisphere light, must sum to pi.
 *   Every light is white for the same reason: a tinted light would shift every palette colour. Sides facing
 *   away from the key are darker; that shading is what shows the form. The sum is exact for a Lambert surface
 *   (meshLambertMaterial, or a physical material with specularIntensity 0): a standard material keeps four
 *   percent of the light for its specular lobe and so reads about three levels darker.
 *   Shadow rule (6.8): one key light casts shadows on a 4096 map. Its camera is fitted to the union of the places
 *   (once per world, since the places do not move), refitted around the target for a very close shot, and
 *   snapped to its own texel grid, so a shadow edge never crawls while the camera moves.
 *   The canvas itself is transparent: the ground colour of the video shows through, so the 3D picture sits on
 *   exactly the same colour as the 2D scenes, and the `shadow` ground only darkens it where a shadow falls.
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useTheme } from '../theme';
import type { Bounds, Pose } from './camera';
import { paint } from './paint';

export type Light = 'studio' | 'day' | 'flat';
/** shadow: only the shadows show; solid: a lit floor; none; or a floor of a given colour and size. */
export type GroundSpec = 'shadow' | 'solid' | 'none' | { color?: string; size?: number };
export type FogSpec = boolean | { color?: string; near?: number; far?: number };

const LOOKS: Light[] = ['studio', 'day', 'flat'];

/**
 * Per look: the share of the up-facing light that each source gives (key, fill and sky add up to 1) and where the
 * key and the fill come from. The key comes from the upper front left of the world, the fill from the back right.
 */
const RIG: Record<Light, { key: number; fill: number; sky: number; shadow: boolean; keyDir: number[]; fillDir: number[]; ground: number }> = {
  studio: { key: 0.62, fill: 0.08, sky: 0.3, shadow: true, keyDir: [-0.5, 1, 0.6], fillDir: [1, 0.8, -1.2], ground: 0.45 },
  day: { key: 0.76, fill: 0.04, sky: 0.2, shadow: true, keyDir: [-0.7, 1, 0.35], fillDir: [1, 0.6, -1], ground: 0.35 },
  flat: { key: 0.25, fill: 0.05, sky: 0.7, shadow: false, keyDir: [-0.3, 1, 0.5], fillDir: [1, 0.8, -1], ground: 0.75 },
};

/** The shadow map's side in texels (6.8). */
export const SHADOW_MAP = 4096;

const unit = (v: number[]) => new THREE.Vector3(v[0], v[1], v[2]).normalize();
const WHITE = new THREE.Color(1, 1, 1);
const BLACK = new THREE.Color(0, 0, 0);

/**
 * The sphere the key's shadow camera holds: the places, or for a very close shot a smaller sphere around the
 * target. The close radius goes in halvings of the full one, so it changes in a few steps and not every frame.
 */
const shadowSphere = (bounds: Bounds, pose?: Pose): { centre: THREE.Vector3; radius: number } => {
  const full = { centre: new THREE.Vector3(...bounds.centre), radius: bounds.radius * 1.05 };
  if (!pose) return full;
  const seen = pose.dist * Math.tan((pose.fov * Math.PI) / 360) * 3; // a generous half-height of what the shot shows
  if (!(seen > 0) || seen * 2 >= full.radius) return full;
  const halvings = Math.min(4, Math.floor(Math.log2(full.radius / seen)));
  return { centre: new THREE.Vector3(...pose.target), radius: full.radius / Math.pow(2, halvings) };
};

export const Lights = ({ look = 'studio', bounds, pose }: { look?: Light; bounds: Bounds; pose?: Pose }) => {
  if (!LOOKS.includes(look)) throw new Error(`a stage's "light" is one of ${LOOKS.join(', ')}, not "${look}"`);
  const rig = RIG[look];
  const kd = unit(rig.keyDir);
  const fd = unit(rig.fillDir);
  // intensities from shares of pi, divided by each light's cosine on an up-facing face
  const key = (Math.PI * rig.key) / kd.y;
  const fill = (Math.PI * rig.fill) / fd.y;
  const sky = Math.PI * rig.sky;
  const groundTone = useMemo(() => new THREE.Color(rig.ground, rig.ground, rig.ground), [rig.ground]);

  // Built by hand: the key's target must be part of the scene for three.js to place it, and its shadow camera is set below.
  const keyLight = useMemo(() => {
    const l = new THREE.DirectionalLight(WHITE, 1);
    l.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
    l.shadow.bias = -0.0002;
    l.shadow.normalBias = 0.02;
    return l;
  }, []);
  const { centre, radius } = shadowSphere(bounds, pose);
  // snap the centre to the shadow map's texel grid, seen from the light, so the shadow edge never crawls
  const texel = (2 * radius) / SHADOW_MAP;
  const right = new THREE.Vector3(0, 1, 0).cross(kd);
  if (right.lengthSq() < 1e-9) right.set(1, 0, 0);
  right.normalize();
  const up = kd.clone().cross(right).normalize();
  const snap = (axis: THREE.Vector3) => {
    const d = centre.dot(axis);
    return axis.clone().multiplyScalar(Math.round(d / texel) * texel - d);
  };
  const anchor = centre.clone().add(snap(right)).add(snap(up));
  keyLight.intensity = key;
  keyLight.castShadow = rig.shadow;
  keyLight.position.copy(anchor).addScaledVector(kd, radius * 3);
  keyLight.target.position.copy(anchor);
  keyLight.target.updateMatrixWorld();
  const cam = keyLight.shadow.camera;
  cam.left = cam.bottom = -radius;
  cam.right = cam.top = radius;
  cam.near = radius * 1.5;
  cam.far = radius * 4.6;
  cam.updateProjectionMatrix();
  keyLight.shadow.needsUpdate = true;
  return (
    <>
      <hemisphereLight args={[WHITE, groundTone, sky]} />
      <primitive object={keyLight} />
      <primitive object={keyLight.target} />
      {/* the fill has no shadow, so only its direction matters: its target stays at the origin, its position is that direction */}
      <directionalLight color={WHITE} position={[fd.x, fd.y, fd.z]} intensity={fill} />
    </>
  );
};

export const Ground = ({ ground = 'shadow', bounds }: { ground?: GroundSpec; bounds: Bounds }) => {
  const th = useTheme();
  if (ground === 'none') return null;
  if (typeof ground === 'string' && ground !== 'shadow' && ground !== 'solid')
    throw new Error(`a stage's "ground" is shadow, solid, none or { color, size }, not "${ground}"`);
  const own = typeof ground === 'object' && ground !== null ? ground : null;
  const size = own?.size ?? bounds.radius * 40;
  // a hair below y = 0, so a flat thing that a scene lays on the ground does not flicker against it
  const centreAt: [number, number, number] = [bounds.centre[0], -bounds.radius * 1e-3, bounds.centre[2]];
  // draw order (6.8): the ground first (-1), opaque things at 0, glass at 10
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={centreAt} receiveShadow renderOrder={-1}>
      <planeGeometry args={[size, size]} />
      {ground === 'shadow' ? (
        // only the shadow is drawn: ink over the ground colour on a light design, black on a dark one (light ink would glow)
        <shadowMaterial color={th.dark ? BLACK : paint(th, 'ink')} opacity={th.dark ? 0.4 : 0.16} depthWrite={false} />
      ) : (
        <meshStandardMaterial color={paint(th, own?.color ?? 'surface')} roughness={1} metalness={0} />
      )}
    </mesh>
  );
};

/** Distant things fade into the ground colour. `dist` is how far the camera is from what it looks at. */
export const Fog = ({ fog, bounds, dist }: { fog?: FogSpec; bounds: Bounds; dist: number }) => {
  const th = useTheme();
  if (!fog) return null;
  const own = typeof fog === 'object' ? fog : {};
  return <fog attach="fog" args={[paint(th, own.color ?? 'bg'), own.near ?? dist, own.far ?? dist + bounds.radius * 5]} />;
};
