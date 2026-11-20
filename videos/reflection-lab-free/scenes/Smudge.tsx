/**
 * @file videos/reflection-lab-free/scenes/Smudge.tsx
 * @description Where the news desk stops fitting: the rewrite is done by a small model too, and on long answers it
 *   corrupted numbers. Two sheets lie on the desk, the document and the rewrite; between them the retyping is
 *   drawn as one more seat of the desk (the chair and chip of the Desk scenes), which a small model's chip takes
 *   while the narration says so. Then the sheets hold three values as the document has them and as the rewrite
 *   gave them back (quoted from the note), and the red pencil underlines each corrupted value. Under the sheets,
 *   what the rewrites did to the long answers, and the size of the test. Words, numbers and times come from the spec.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Arrow2, SceneTitle, Text, dataStyle, mixColour, paint, prog, useBeats, useClock, useTheme } from '@kit';
import type { SceneProps } from '@kit';
import { INSET, ModelChip, Paper } from './lib/paper';

type Side = { name: string; values: string[]; at: string };
type Retyper = { role: string; model: string; at: string; seat: string };
type Props = { document: Side; rewrite: Side; retyper: Retyper; markAt: string;
  facts: { text: string; at: string; strong?: boolean }[]; limits: { text: string; at: string } };

/** The two sheets, centred on the frame, with the retyper's seat in the gap between them. */
const DOC = { x: 230, y: 290, w: 560, h: 270 };
const REW = { x: 1130, y: 290, w: 560, h: 270 };
const CHAIR = { x: 842, y: 372, w: 236, h: 46 };
const FLOW_Y = 470;
/** The facts in two columns under the sheets, read left to right and down, in the order they are spoken. */
const FACTS = [{ x: DOC.x, w: 860 }, { x: REW.x, w: 640 }];
const FACT_Y = 626;
const FACT_ROW = 62;
const ROW = 76;

export default function Smudge({ v }: SceneProps) {
  const th = useTheme();
  const t = useClock();
  const beats = useBeats();
  const p = v.props as unknown as Props;
  const at = (name: string) => (name in beats ? beats[name] : Infinity);
  const value = { ...dataStyle(th, 'm'), lineHeight: 1, color: paint(th, 'print'), whiteSpace: 'pre' as const };
  const pencil = paint(th, 'pencil');

  const side = (s: Side, box: typeof DOC, marked: boolean) => {
    const k = prog(t, at(s.at), 0.5);
    return (
      <Paper {...box} name={s.name} slot={prog(t, 0.2, 0.5)} fill={k}>
        {s.values.map((text, i) => {
          const drawn = marked ? prog(t, at(p.markAt) + i * 0.3, 0.6, 'move') : 0;
          return (
            <div key={i} style={{ position: 'absolute', left: INSET, top: INSET + 8 + i * ROW, opacity: prog(t, at(s.at) + i * 0.2, 0.4) }}>
              <span style={{ ...value, paddingBottom: 8, backgroundImage: `linear-gradient(${pencil}, ${pencil})`, backgroundRepeat: 'no-repeat',
                backgroundSize: `${drawn * 100}% 4px`, backgroundPosition: '0 100%' }}>{text}</span>
            </div>
          );
        })}
      </Paper>
    );
  };

  // the retyper's seat: an empty chair with its role on the first beat, a small model's chip in it on the second
  const seat = prog(t, at(p.retyper.at), 0.4);
  const seated = prog(t, at(p.retyper.seat), 0.4);

  return (
    <AbsoluteFill>
      <SceneTitle text={v.title} t={t} />
      {side(p.document, DOC, false)}
      {side(p.rewrite, REW, true)}

      <Text x={CHAIR.x} y={CHAIR.y - 40} size="s" text={p.retyper.role} color="ink2" shown={seat} />
      <div style={{ position: 'absolute', left: CHAIR.x, top: CHAIR.y, width: CHAIR.w, height: CHAIR.h, boxSizing: 'border-box',
        borderRadius: th.radius, border: `${th.stroke}px dashed ${mixColour(paint(th, 'bg'), paint(th, 'back'), seat * (1 - seated))}` }} />
      <ModelChip id={p.retyper.model} x={CHAIR.x} y={CHAIR.y} k={seated} />
      <Arrow2 from={[DOC.x + DOC.w + 16, FLOW_Y]} to={[REW.x - 16, FLOW_Y]} at={at(p.retyper.at)} t={t} />

      {p.facts.map((f, i) => (
        <Text key={i} x={FACTS[i % 2].x} y={FACT_Y + Math.floor(i / 2) * FACT_ROW} w={FACTS[i % 2].w} size="s" text={f.text}
          color={f.strong ? 'ink' : 'ink2'} shown={prog(t, at(f.at), 0.5)} />
      ))}
      <Text x={DOC.x} y={FACT_Y + 2 * FACT_ROW + 34} size="m" text={p.limits.text} shown={prog(t, at(p.limits.at), 0.5)} />
    </AbsoluteFill>
  );
}
