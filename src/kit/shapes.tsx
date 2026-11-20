/**
 * @file kit/shapes.tsx
 * @description 3D shapes for a <Stage> (work package B, architecture section 6.7), y up, ground at y = 0. Like a place,
 *   a shape's `pos` is the centre of its base and `size` is [x width, y height, z depth] (architecture section 1).
 *   Colours are colour references; `dim` (1 in focus, 0.3 stepped back: pass w.dim(id)) mixes a colour toward the
 *   ground, never by opacity.
 *   Box: a box, matte by default, `flat` to take no light, or any material of ./materials as its child.
 *   Edges: the twelve edges of a box drawn as thin beams (a WebGL line is one pixel wide, too thin at 4K), or only its
 *   top ring, or all but the top ring. Slab: a thin slab lying flat along +z, in coloured parts that share its length;
 *   `shown` is the share that exists, from its leading end (a strip being written, a path being laid).
 *   Room: a hollow building with walls of thickness `k`, one opening in its front wall (a door, a hatch, a slot), a roof
 *   that can lift away (`lid` from 1 on to 0 off: it rises a little and fades) so the camera can look in, a seam under
 *   the roof and a roof pane that can glow (`glow`). Its inner faces and floor take flat tones, and the floor's inner
 *   edges are drawn, so an empty room reads as a bare floor and not a hole.
 *   Not built yet (no video has needed them): Ball, Cyl, Cone, Capsule, Lathe, Extrude, Prisms, Arrow3, FaceText, the
 *   3D Appear, gridPositions, and shapes that read focus by `id`; meanwhile a raw mesh (<mesh><cylinderGeometry
 *   args={[r, r, h, 48]} /><Matte color="blue" /></mesh>, its position the centre) and `dim` from w.dim(id).
 *   Lifted from an earlier video's scene code. Pure functions of their props and the theme.
 */
import React from 'react';
import { useTheme } from '../theme';
import type { Vec3 } from './camera';
import { toward } from './ink';
import { Flat, Glow, Matte } from './materials';
import { paint } from './paint';

/** Cast and receive shadows (the stage's `shadow` ground shows them); nothing when off, as before. */
const shadows = (on: boolean | undefined) => (on ? { castShadow: true, receiveShadow: true } : {});

/** A box by its centre (three's own position) in a resolved colour: the private brick of the shapes below. */
function Brick({ at, size, colour, flat = false, shadow }: { at: Vec3; size: Vec3; colour: string; flat?: boolean; shadow?: boolean }) {
  return (
    <mesh position={at} {...shadows(shadow)}>
      <boxGeometry args={size} />
      {flat ? <Flat color={colour} /> : <Matte color={colour} />}
    </mesh>
  );
}

/** The colour of a shape at a focus. */
const shade = (th: ReturnType<typeof useTheme>, ref: string, dim: number) => (dim >= 1 ? paint(th, ref) : toward(th, paint(th, ref), 0.4 + 0.6 * dim));

export type BoxProps = {
  /** The centre of its base. */
  pos: Vec3;
  size: Vec3;
  color: string;
  /** Takes no light: the colour shows exactly on every face. */
  flat?: boolean;
  /** Turn about the vertical axis, in degrees. */
  rot?: number;
  dim?: number;
  /** Casts a shadow and receives one (the stage's `shadow` ground shows it); default off. */
  shadow?: boolean;
  /** A material of ./materials (Glow, Ghost...) instead of the matte or flat one. */
  children?: React.ReactNode;
};

/** A box standing on `pos`. */
export function Box({ pos, size, color, flat = false, rot = 0, dim = 1, shadow, children }: BoxProps) {
  const th = useTheme();
  const c = shade(th, color, dim);
  return (
    <mesh position={[pos[0], pos[1] + size[1] / 2, pos[2]]} rotation={rot ? [0, (rot * Math.PI) / 180, 0] : undefined} {...shadows(shadow)}>
      <boxGeometry args={size} />
      {children ?? (flat ? <Flat color={c} /> : <Matte color={c} />)}
    </mesh>
  );
}

export type EdgesProps = {
  /** The centre of the base of the box whose edges are drawn. */
  pos: Vec3;
  size: Vec3;
  color: string;
  /** Thickness of a beam, in world units (about 0.02 to 0.05 for a box a few units wide). */
  k: number;
  /** 'top': only the top ring; 'rest': every edge but the top ring. */
  only?: 'top' | 'rest';
  dim?: number;
};

/** The twelve edges of a box given by its centre, as beams `k` thick, in a resolved flat colour (private). */
function Beams({ at, size, colour, k, only }: { at: Vec3; size: Vec3; colour: string; k: number; only?: 'top' | 'rest' }) {
  const [x, y, z] = at;
  const [w, h, d] = size;
  const beams: { at: Vec3; size: Vec3; top: boolean }[] = [];
  for (const sy of [-1, 1]) {
    for (const sz of [-1, 1]) beams.push({ at: [x, y + (sy * h) / 2, z + (sz * d) / 2], size: [w + k, k, k], top: sy > 0 });
    for (const sx of [-1, 1]) beams.push({ at: [x + (sx * w) / 2, y + (sy * h) / 2, z], size: [k, k, d + k], top: sy > 0 });
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) beams.push({ at: [x + (sx * w) / 2, y, z + (sz * d) / 2], size: [k, h + k, k], top: false });
  return (
    <>
      {beams.filter((b) => (only === 'top' ? b.top : only === 'rest' ? !b.top : true)).map((b, i) => (
        <Brick key={i} at={b.at} size={b.size} colour={colour} flat />
      ))}
    </>
  );
}

/** The twelve edges of a box as beams `k` thick, in a flat colour. */
export function Edges({ pos, size, color, k, only, dim = 1 }: EdgesProps) {
  const th = useTheme();
  return <Beams at={[pos[0], pos[1] + size[1] / 2, pos[2]]} size={size} colour={shade(th, color, dim)} k={k} only={only} />;
}

export type SlabProps = {
  /** The middle of its leading end, on its underside: [x, y, z]. It reaches `len` toward +z from there. */
  start: Vec3;
  len: number;
  /** Width (x) and thickness (y; default 0.025). */
  w: number;
  k?: number;
  /** Its parts from the leading end, each taking `share` of the length (shares are relative). */
  parts: { color: string; share: number }[];
  /** 0..1, the share of the length that exists, from the leading end; default 1. */
  shown?: number;
};

/** A thin slab lying flat along +z, in coloured parts, flat colours. */
export function Slab({ start, len, w, k = 0.025, parts, shown = 1 }: SlabProps) {
  const th = useTheme();
  const [x, y, front] = start;
  const total = parts.reduce((n, p) => n + p.share, 0) || 1;
  const end = front + len * Math.max(0, Math.min(1, shown));
  let z = front;
  return (
    <>
      {parts.map((p, i) => {
        const from = z;
        z += (len * p.share) / total;
        const l = Math.min(z, end) - from;
        if (l <= 0.0005) return null;
        return <Brick key={i} at={[x, y + k / 2, from + l / 2]} size={[w, k, l]} colour={paint(th, p.color)} flat />;
      })}
    </>
  );
}

export type RoomShape = {
  /** Outer width (x), height and depth (z). */
  w: number; h: number; d: number;
  /** Wall thickness. */
  k: number;
  /** The opening in the front wall (the wall that faces +z): its width, its height and the y of its lower edge. */
  opening: { w: number; h: number; y: number };
};

export type RoomProps = {
  /** The centre of its base; default the origin. */
  pos?: Vec3;
  shape: RoomShape;
  /** The walls and the roof, the inner faces, the floor. */
  wall: string; inside: string; floor: string;
  /** The outer edges and the roof ring, and the floor's inner edges. */
  edge: string; line: string;
  /** Thickness of the outer edge beams (0: no outer edges but the roof ring) and of the roof ring. */
  beam: number; roof: number;
  /** The outline of the opening when it differs from the other edges (the opening picked out). */
  openingEdge?: string;
  /** 1 the roof is on (default), 0 it is taken off. */
  lid?: number;
  /** The colour of the ring under the roof; default `edge`. */
  seam?: string;
  /** The light the roof pane gives: a colour and 0..1. */
  glow?: { color: string; k: number };
  /** The walls and the roof cast and receive shadows; default off. */
  shadow?: boolean;
};

/** The outline of the opening when the room draws no outer edges, and the roof: its thickness and how far it lifts. */
const OPENING_EDGE = 0.024;
const ROOF = { k: 0.06, lift: 0.5 };

/** A hollow room with an opening in its front wall and a roof that lifts. */
export function Room({ pos = [0, 0, 0], shape, wall: wallRef, inside: insideRef, floor: floorRef, edge: edgeRef, line: lineRef, beam, roof, openingEdge,
  lid = 1, seam, glow, shadow }: RoomProps) {
  const th = useTheme();
  const [wall, inside, floor, edge, line] = [wallRef, insideRef, floorRef, edgeRef, lineRef].map((c) => paint(th, c));
  const { w, h, d, k, opening: slot } = shape;
  // The room is drawn in a frame whose origin is the middle of the front wall's outer face, at ground level.
  const zc = -d / 2;
  const side = (w - slot.w) / 2;
  const topH = h - slot.y - slot.h;
  const e = 0.012;
  const iw = w - 2 * k;
  const id = d - 2 * k;
  const ring = (at: Vec3, size: Vec3, colour: string, kk: number, only?: 'top' | 'rest') => <Beams at={at} size={size} colour={colour} k={kk} only={only} />;
  return (
    <group position={[pos[0], pos[1], pos[2] + d / 2]}>
      {/* The four walls; the front wall is four pieces round the opening. */}
      <Brick at={[0, h / 2, -d + k / 2]} size={[w, h, k]} colour={wall} shadow={shadow} />
      <Brick at={[-w / 2 + k / 2, h / 2, zc]} size={[k, h, id]} colour={wall} shadow={shadow} />
      <Brick at={[w / 2 - k / 2, h / 2, zc]} size={[k, h, id]} colour={wall} shadow={shadow} />
      <Brick at={[0, slot.y / 2, -k / 2]} size={[w, slot.y, k]} colour={wall} shadow={shadow} />
      <Brick at={[0, slot.y + slot.h + topH / 2, -k / 2]} size={[w, topH, k]} colour={wall} shadow={shadow} />
      <Brick at={[-(slot.w + side) / 2, slot.y + slot.h / 2, -k / 2]} size={[side, slot.h, k]} colour={wall} shadow={shadow} />
      <Brick at={[(slot.w + side) / 2, slot.y + slot.h / 2, -k / 2]} size={[side, slot.h, k]} colour={wall} shadow={shadow} />
      {/* The inside: a floor and four liners in flat tones. */}
      <Brick at={[0, e / 2, zc]} size={[iw, e, id]} colour={floor} flat />
      <Brick at={[0, h / 2, -d + k + e / 2]} size={[iw, h - e, e]} colour={inside} flat />
      <Brick at={[-w / 2 + k + e / 2, h / 2, zc]} size={[e, h - e, id]} colour={inside} flat />
      <Brick at={[w / 2 - k - e / 2, h / 2, zc]} size={[e, h - e, id]} colour={inside} flat />
      <Brick at={[0, slot.y / 2, -k - e / 2]} size={[iw, slot.y, e]} colour={inside} flat />
      <Brick at={[0, slot.y + slot.h + topH / 2, -k - e / 2]} size={[iw, topH - e, e]} colour={inside} flat />
      {/* The bare floor's edges, the roof ring, the roof, and the outer edges where they are drawn. */}
      {ring([0, 2 * e, zc], [iw - 0.03, 0.001, id - 0.03], line, 0.022, 'top')}
      {ring([0, h / 2, zc], [w, h, d], seam === undefined ? edge : paint(th, seam), roof, 'top')}
      {lid > 0 ? (
        <mesh position={[0, h + roof / 2 + ROOF.k / 2 + (1 - lid) * ROOF.lift, zc]} {...shadows(shadow)}>
          <boxGeometry args={[w, ROOF.k, d]} />
          <Glow color={wall} glow={glow?.color} k={glow?.k ?? 0} opacity={lid} />
        </mesh>
      ) : null}
      {beam > 0 ? ring([0, h / 2, zc], [w, h, d], edge, beam, 'rest') : null}
      {/* The opening: a pane in the floor's tone closes its inner half, so that it glows with the room, and its outline. */}
      <Brick at={[0, slot.y + slot.h / 2, -k * 0.75]} size={[slot.w, slot.h, k / 2]} colour={floor} flat />
      {ring([0, slot.y + slot.h / 2, 0], [slot.w, slot.h, 0.001], openingEdge === undefined ? edge : paint(th, openingEdge), beam > 0 ? beam * 0.8 : OPENING_EDGE)}
    </group>
  );
}
