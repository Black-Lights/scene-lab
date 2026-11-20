/**
 * @file videos/moon-phases-2d/scenes/lib/moon.ts
 * @description Geometry of a lit ball, shared by the scenes of this video. Angles are in degrees.
 *   litPath: the bright part of the Moon's disc as seen from Earth, for a phase angle (0 new, 180 full, 360 new),
 *   lit on the right while it waxes, as seen from the northern hemisphere. The terminator is a half ellipse whose
 *   width is R times the cosine of the phase angle, so the lit share of the disc is (1 - cos) / 2.
 *   halfDisc / halfArc: the half of a ball that faces a direction (screen angle, y down), seen from above.
 */

const rad = (d: number) => (d * Math.PI) / 180;
const f = (n: number) => n.toFixed(2);

/** The lit part of a disc of radius R at (cx, cy) for phase angle `deg`. Empty path at new moon. */
export function litPath(cx: number, cy: number, R: number, deg: number): string {
  const a = ((deg % 360) + 360) % 360;
  const c = Math.cos(rad(a));
  const rx = Math.abs(c) * R;
  const waxing = a < 180;
  const top = `${f(cx)},${f(cy - R)}`;
  const bottom = `${f(cx)},${f(cy + R)}`;
  // the bright limb: the right half while waxing, the left half while waning
  const limbSweep = waxing ? 1 : 0;
  // the terminator runs back from the bottom to the top through x = cx + side * rx
  const side = (waxing ? 1 : -1) * Math.sign(c || 1);
  const termSweep = side > 0 ? 0 : 1;
  return `M ${top} A ${f(R)} ${f(R)} 0 0 ${limbSweep} ${bottom} A ${f(rx)} ${f(R)} 0 0 ${termSweep} ${top} Z`;
}

/** The point at angle `deg` (screen angle, y down) on a circle. */
export function onCircle(cx: number, cy: number, r: number, deg: number): [number, number] {
  return [cx + r * Math.cos(rad(deg)), cy + r * Math.sin(rad(deg))];
}

/** The half disc of a ball of radius r at (cx, cy) that faces the screen direction `deg`, closed. */
export function halfDisc(cx: number, cy: number, r: number, deg: number): string {
  return `${halfArc(cx, cy, r, deg)} Z`;
}

/** The outline of the half of a circle that faces the screen direction `deg`, open. */
export function halfArc(cx: number, cy: number, r: number, deg: number): string {
  const [x1, y1] = onCircle(cx, cy, r, deg + 90);
  const [x2, y2] = onCircle(cx, cy, r, deg - 90);
  return `M ${f(x1)},${f(y1)} A ${f(r)} ${f(r)} 0 0 0 ${f(x2)},${f(y2)}`;
}

/** Screen angle in degrees from point a to point b, in [0, 360). */
export function towards(a: [number, number], b: [number, number]): number {
  const d = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
  return d < 0 ? d + 360 : d;
}

/** Where the Moon is on its orbit, `progress` degrees after new moon; the Sun's light comes from the left and the
 *  Moon goes round counter-clockwise as seen from above the north pole: new on the left, first quarter at the
 *  bottom, full on the right, last quarter at the top. */
export function moonAt(cx: number, cy: number, r: number, progress: number): [number, number] {
  return onCircle(cx, cy, r, 180 - progress);
}
