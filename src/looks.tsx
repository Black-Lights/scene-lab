/**
 * @file looks.tsx
 * @description What differs between design directions (theme.look), kept in one place: structural numbers for
 *   diagrams (SEQ) and the few pieces each look draws its own way: paint chips, the eavesdropper's copy,
 *   note plates, sealed packets and scrambled bytes. Everything else reads plain tokens from theme.ts.
 *   Looks: plate (whiteprint technical plate, detail lens), stage (lecture board, shutter band),
 *   ground (fields and a public street that keeps prints). docs/design.md records which one was chosen.
 */
import React from 'react';
import type { Theme } from './theme';
import { Glyph } from './draw';
import type { IconData } from './draw';

export type SeqLook = {
  gap: number; // lane spacing for three actors
  headTop: number;
  head: 'box' | 'bare' | 'field';
  headH: number;
  icon: number;
  name: number;
  life: { w: number; dash?: string };
  watchLife: 'same' | 'dash-public' | 'none';
  arrowW: number;
  arrowHead: 'filled' | 'chevron';
  chip: 'circle' | 'square';
  chipR: number;
  copyR: number;
  copy: 'takeoff' | 'tap' | 'print';
  note: 'folded' | 'outline' | 'plate';
  lane: 'band' | 'street' | 'none';
  label: number;
  labelAt: 'sender' | 'lane';
  noteText: number;
};

export const SEQ: Record<string, SeqLook> = {
  plate: { gap: 540, headTop: 92, head: 'box', headH: 68, icon: 40, name: 30, life: { w: 2, dash: '8 8' }, watchLife: 'same', arrowW: 3,
    arrowHead: 'filled', chip: 'circle', chipR: 24, copyR: 19, copy: 'takeoff', note: 'folded', lane: 'band', label: 30, labelAt: 'sender', noteText: 28 },
  stage: { gap: 560, headTop: 96, head: 'bare', headH: 56, icon: 46, name: 34, life: { w: 3 }, watchLife: 'dash-public', arrowW: 3,
    arrowHead: 'chevron', chip: 'circle', chipR: 27, copyR: 21, copy: 'tap', note: 'outline', lane: 'none', label: 32, labelAt: 'sender', noteText: 28 },
  ground: { gap: 320, headTop: 92, head: 'field', headH: 56, icon: 42, name: 38, life: { w: 4 }, watchLife: 'none', arrowW: 6,
    arrowHead: 'chevron', chip: 'square', chipR: 27, copyR: 25, copy: 'print', note: 'plate', lane: 'street', label: 32, labelAt: 'lane', noteText: 30 },
};
export const seqLook = (th: Theme) => SEQ[th.look] ?? SEQ.plate;

/** A paint chip centred on (0,0). Content colour: it never steps back. `print` = a copy seen in public (no outline). */
export const Swatch = ({ c, r, th, print }: { c: string; r: number; th: Theme; print?: boolean }) => {
  const L = seqLook(th);
  const ring = th.dark ? th.ink : th.ink;
  const w = print ? 0 : th.look === 'plate' ? 3 : 3;
  if (L.chip === 'square')
    return <rect x={-r} y={-r} width={2 * r} height={2 * r} rx={4} fill={c} stroke={w ? ring : 'none'} strokeWidth={w} />;
  return <circle r={r} fill={c} stroke={w ? ring : 'none'} strokeWidth={w} />;
};

/** A sealed message as an object: a packet in the session key's colour with a lock (plate), an envelope (stage),
 *  a paper plate with a sealed-mail glyph (ground). */
export const Packet = ({ th, lock, envelope, scale = 1 }: { th: Theme; lock?: IconData | null; envelope?: IconData | null; scale?: number }) => {
  if (th.look === 'stage') return <Glyph icon={envelope} size={44 * scale} color={th.ink} x={-22 * scale} y={-22 * scale} />;
  if (th.look === 'ground')
    return (
      <g>
        <rect x={-36 * scale} y={-26 * scale} width={72 * scale} height={52 * scale} rx={4} fill={th.surface} stroke={th.ink} strokeWidth={2} />
        <Glyph icon={lock} size={30 * scale} color={th.ink} x={-15 * scale} y={-15 * scale} />
      </g>
    );
  return (
    <g>
      <rect x={-32 * scale} y={-18 * scale} width={64 * scale} height={36 * scale} rx={8} fill={th.paint.sealed ?? th.ink} />
      <Glyph icon={lock} size={22 * scale} color={th.surface} x={-11 * scale} y={-11 * scale} />
    </g>
  );
};

/** What anyone watching holds of a sealed message: bytes that look like noise (fixed per message, never random). */
export const Scrambled = ({ seed, th }: { seed: number; th: Theme }) => {
  if (th.look === 'ground') {
    const cells: React.ReactElement[] = [];
    for (let k = 0; k < 27; k++) {
      const on = ((seed * 31 + k * 17 + ((k * k) % 7)) % 9) < 5;
      if (on) cells.push(<rect key={k} x={-52 + (k % 9) * 12} y={-16 + Math.floor(k / 9) * 12} width={8} height={8} fill={th.onLane ?? th.surface} />);
    }
    return <g>{cells}</g>;
  }
  const hex = '0123456789abcdef';
  const pick = (k: number) => hex[(seed * 7 + k * 13 + 5) % 16] + hex[(seed * 11 + k * 5 + 3) % 16];
  const txt = `${pick(1)}${pick(2)} ${pick(3)}${pick(4)}`;
  return (
    <text x={0} y={9} textAnchor="middle" fontSize={26} fontFamily={th.font.data} fontWeight={500}
      style={{ fontVariationSettings: th.look === 'stage' ? '"MONO" 1' : undefined }} fill={th.look === 'plate' ? th.ink : th.ink}>
      {txt}
    </text>
  );
};

/** A note plate. role: public (shared with everyone), private (one party), shared (the same secret on both sides). */
export const NoteBox = ({ x, y, w, h, th, role }: { x: number; y: number; w: number; h: number; th: Theme; role: string }) => {
  const L = seqLook(th);
  if (L.note === 'folded') {
    const f = 16;
    return (
      <g>
        <path d={`M ${x + 6} ${y} L ${x + w - f} ${y} L ${x + w} ${y + f} L ${x + w} ${y + h - 6} Q ${x + w} ${y + h} ${x + w - 6} ${y + h} L ${x + 6} ${y + h} Q ${x} ${y + h} ${x} ${y + h - 6} L ${x} ${y + 6} Q ${x} ${y} ${x + 6} ${y} Z`}
          fill={th.surface} stroke={th.ink} strokeWidth={3} strokeLinejoin="round" />
        <path d={`M ${x + w - f} ${y} L ${x + w - f} ${y + f} L ${x + w} ${y + f} Z`} fill={th.lane ?? th.bg} stroke={th.ink} strokeWidth={3} strokeLinejoin="round" />
      </g>
    );
  }
  if (L.note === 'outline') {
    const col = role === 'public' ? th.roles.a : role === 'private' ? th.roles.b : th.ink;
    return <rect x={x} y={y} width={w} height={h} rx={th.radius} fill={role === 'shared' ? '#1E3340' : 'none'} stroke={col} strokeWidth={2}
      strokeDasharray={role === 'private' ? '8 6' : undefined} />;
  }
  return <rect x={x} y={y} width={w} height={h} rx={th.radius} fill={th.surface} />;
};
