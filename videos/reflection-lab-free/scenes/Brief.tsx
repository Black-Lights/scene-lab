/**
 * @file videos/reflection-lab-free/scenes/Brief.tsx
 * @description The repair: the second set of prompts as two sheets on the desk (the critic's brief and the
 *   refiner's), with the binding phrase of each washed by the highlighter on its spoken word, and beside them what
 *   the three pairings then did to the number of hallucinations: rows of label and value, with the note's caveat
 *   that the differences are within chance. Words, numbers and times come from the spec.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { SceneTitle, Text, dataStyle, paint, prog, textStyle, useBeats, useClock, useTheme } from '@kit';
import type { SceneProps } from '@kit';
import { INSET, ModelChip, Paper, Para } from './lib/paper';
import type { Seg } from './lib/paper';

type Sheet = { name: string; y: number; h: number; at: string; segs: Seg[] };
type Row = { analyst: string; critic: string; from: string; to: string };
type Props = { sheets: Sheet[]; head: { text: string; at: string }; by: string; cols: [string, string]; rows: Row[]; rowsAt: string;
  note: { text: string; at: string } };

const SHEET = { x: 110, w: 720 };
const TABLE = { x: 930, y: 254, from: 1630, to: 1810, row: 84 };

export default function Brief({ v }: SceneProps) {
  const th = useTheme();
  const t = useClock();
  const beats = useBeats();
  const p = v.props as unknown as Props;
  const at = (name: string) => (name in beats ? beats[name] : Infinity);
  const mark = (name: string) => prog(t, at(name), 0.8, 'move');
  const number = dataStyle(th, 'm');
  const head = prog(t, at(p.head.at), 0.5);

  return (
    <AbsoluteFill>
      <SceneTitle text={v.title} t={t} />

      {p.sheets.map((s, i) => {
        const k = prog(t, at(s.at), 0.5);
        return (
          <Paper key={i} x={SHEET.x} y={s.y} w={SHEET.w} h={s.h} name={s.name} slot={k} fill={k}>
            <Para segs={s.segs} w={SHEET.w - 2 * INSET} k={k} mark={mark} size={34} />
          </Paper>
        );
      })}

      {/* what the loops did after the change: label and value rows */}
      <Text x={TABLE.x} y={TABLE.y} size="s" text={p.head.text} color="ink2" shown={head} />
      <Text x={TABLE.from} y={TABLE.y + 52} size="s" anchor="end" text={p.cols[0]} color="ink2" shown={head} />
      <Text x={TABLE.to} y={TABLE.y + 52} size="s" anchor="end" text={p.cols[1]} color="ink2" shown={head} />
      {p.rows.map((r, i) => {
        const y = TABLE.y + 112 + i * TABLE.row;
        const k = prog(t, at(p.rowsAt) + i * 0.25, 0.4);
        return (
          <React.Fragment key={i}>
            <div style={{ position: 'absolute', left: TABLE.x, top: y, height: 46, display: 'flex', alignItems: 'center', gap: 14, opacity: k,
              ...textStyle(th, 's'), lineHeight: 1, color: paint(th, 'ink2'), whiteSpace: 'nowrap' }}>
              <ModelChip id={r.analyst} />
              <span>{p.by}</span>
              <ModelChip id={r.critic} />
            </div>
            <div style={{ position: 'absolute', right: 1920 - TABLE.from, top: y, height: 46, display: 'flex', alignItems: 'center', opacity: k,
              ...number, lineHeight: 1, color: paint(th, 'flag') }}>{r.from}</div>
            <div style={{ position: 'absolute', right: 1920 - TABLE.to, top: y, height: 46, display: 'flex', alignItems: 'center', opacity: k,
              ...number, lineHeight: 1, color: paint(th, 'flag') }}>{r.to}</div>
          </React.Fragment>
        );
      })}
      <Text x={TABLE.x} y={TABLE.y + 112 + p.rows.length * TABLE.row + 16} w={TABLE.to - TABLE.x} size="s" text={p.note.text}
        shown={prog(t, at(p.note.at), 0.5)} />
    </AbsoluteFill>
  );
}
