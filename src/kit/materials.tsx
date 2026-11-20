/**
 * @file kit/materials.tsx
 * @description Materials as children of any mesh (work package B, architecture section 6.7): put one inside a <mesh>
 *   or a kit shape (Box takes one as its child) and it becomes that mesh's material. Colours are colour references
 *   (paint(): hex, paint, role or token).
 *   Matte: a lit, matte surface (lambert): under the stage's `studio` light a face that looks up shows its colour
 *   exactly. Flat: takes no light, the colour shows exactly as given on every face (edges, paper, labels in 3D).
 *   Glow: matte with a light of its own (emissive): a lamp, a lit pane; `k` 0..1 is how strongly it glows. Ghost: a
 *   matte surface you can see through (`opacity`, default 0.35): a lid being lifted, a part that is gone.
 *   Not built yet (no video has needed them): Metal and Glass; meanwhile a raw <meshStandardMaterial> with metalness, or
 *   <meshPhysicalMaterial> with transmission, inside a mesh. Lifted from an earlier video's scene code.
 */
import React from 'react';
import { useTheme } from '../theme';
import { paint } from './paint';

export type MatteProps = { color: string;
  /** Below 1 the surface is see-through. */
  opacity?: number };

/** A lit, matte surface. */
export function Matte({ color, opacity = 1 }: MatteProps) {
  const th = useTheme();
  if (opacity < 1) return <meshLambertMaterial color={paint(th, color)} transparent opacity={opacity} />;
  return <meshLambertMaterial color={paint(th, color)} />;
}

/** A surface that takes no light: its colour shows exactly as given. */
export function Flat({ color }: { color: string }) {
  const th = useTheme();
  return <meshBasicMaterial color={paint(th, color)} />;
}

export type GlowProps = { color: string;
  /** The colour of its own light; default its colour. */
  glow?: string;
  /** 0..1, how strongly it glows; default 1. */
  k?: number;
  opacity?: number };

/** A matte surface with a light of its own. */
export function Glow({ color, glow, k = 1, opacity = 1 }: GlowProps) {
  const th = useTheme();
  const c = paint(th, color);
  return <meshLambertMaterial color={c} emissive={glow === undefined ? c : paint(th, glow)} emissiveIntensity={k} transparent={opacity < 1} opacity={opacity} />;
}

/** A matte surface you can see through. */
export function Ghost({ color, opacity = 0.35 }: { color: string; opacity?: number }) {
  const th = useTheme();
  return <meshLambertMaterial color={paint(th, color)} transparent opacity={opacity} />;
}
