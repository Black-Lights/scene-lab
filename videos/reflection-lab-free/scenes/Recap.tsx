/**
 * @file videos/reflection-lab-free/scenes/Recap.tsx
 * @description The recap for the phone: three recommendations, each beside the picture that carried it earlier in
 *   the video: the count of correct answers that rose with the analyst's instruction and a calculator, Gemma in
 *   the critic's seat, and a corrupted number under the red pencil. Words, numbers and times come from the spec.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Arrow2, SceneTitle, Text, dataStyle, paint, prog, textStyle, useBeats, useClock, useTheme } from '@kit';
import type { SceneProps } from '@kit';
import { ModelChip, Paper } from './lib/paper';

type Row = { text: string; at: string };
type Props = { rows: [Row, Row, Row]; gain: { from: string; to: string; unit: string }; seat: { role: string; model: string };
  slip: { value: string } };

const LEFT = 110;
const TEXT_X = 640;
const ROW = [250, 430, 610];

export default function Recap({ v }: SceneProps) {
  const th = useTheme();
  const t = useClock();
  const beats = useBeats();
  const p = v.props as unknown as Props;
  const at = (name: string) => (name in beats ? beats[name] : Infinity);
  const shown = p.rows.map((r) => prog(t, at(r.at), 0.5));
  const number = { ...dataStyle(th, 'm'), lineHeight: 1 };
  const pencil = paint(th, 'pencil');
  const drawn = prog(t, at(p.rows[2].at) + 0.4, 0.6, 'move');

  return (
    <AbsoluteFill>
      <SceneTitle text={v.title} t={t} />

      {/* 1: the analyst first. The count from the strips: 89 correct, then 101 */}
      <div style={{ position: 'absolute', left: LEFT, top: ROW[0], width: 420, opacity: shown[0] }}>
        <div style={{ ...number, position: 'absolute', left: 0, top: 4 }}>{p.gain.from}</div>
        <div style={{ ...number, position: 'absolute', left: 190, top: 4 }}>{p.gain.to}</div>
        <div style={{ ...textStyle(th, 's'), lineHeight: 1, position: 'absolute', left: 0, top: 62, color: paint(th, 'ink2'), whiteSpace: 'nowrap' }}>
          {p.gain.unit}
        </div>
      </div>
      <Arrow2 from={[LEFT + 76, ROW[0] + 26]} to={[LEFT + 172, ROW[0] + 26]} at={at(p.rows[0].at) + 0.2} t={t} over={0.5} />

      {/* 2: if a critic, the one that can tell right from wrong: Gemma in the critic's seat */}
      <div style={{ position: 'absolute', left: LEFT, top: ROW[1] + 6, height: 46, display: 'flex', alignItems: 'center', gap: 16, opacity: shown[1],
        ...textStyle(th, 's'), lineHeight: 1, color: paint(th, 'ink2') }}>
        <span>{p.seat.role}</span>
        <ModelChip id={p.seat.model} />
      </div>

      {/* 3: the number check. The corrupted value from the rewrite, under the red pencil */}
      <Paper x={LEFT} y={ROW[2]} w={330} h={92} slot={shown[2]} fill={shown[2]}>
        <div style={{ position: 'absolute', left: 24, top: 22, opacity: shown[2] }}>
          <span style={{ ...number, color: paint(th, 'print'), paddingBottom: 8, backgroundImage: `linear-gradient(${pencil}, ${pencil})`,
            backgroundRepeat: 'no-repeat', backgroundSize: `${drawn * 100}% 4px`, backgroundPosition: '0 100%' }}>{p.slip.value}</span>
        </div>
      </Paper>

      {p.rows.map((r, i) => <Text key={i} x={TEXT_X} y={ROW[i] + (i === 2 ? 22 : 4)} w={1170} size="m" text={r.text} shown={shown[i]} />)}
    </AbsoluteFill>
  );
}
