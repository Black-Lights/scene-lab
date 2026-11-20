/**
 * @file videos/reflection-lab-free/scenes/Opening.tsx
 * @description The opening: the note's name, its question, and the three small models it tests as the chips the
 *   rest of the video uses (one colour for Gemma, one for both sizes of Qwen), each with the size of its file.
 *   Words, sizes and times come from the spec.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Text, paint, prog, textStyle, useBeats, useClock, useTheme } from '@kit';
import type { SceneProps } from '@kit';
import { ModelChip } from './lib/paper';

type Props = { name: string; question: string; models: { id: string; size: string; at: string }[]; note: { text: string; at: string } };

const LEFT = 110;

export default function Opening({ v }: SceneProps) {
  const th = useTheme();
  const t = useClock();
  const beats = useBeats();
  const p = v.props as unknown as Props;
  const at = (name: string) => (name in beats ? beats[name] : Infinity);
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: LEFT, top: 215, ...textStyle(th, 'l'), fontSize: 132, lineHeight: 1, whiteSpace: 'nowrap',
        opacity: prog(t, 0, 0.6) }}>
        {p.name}
      </div>
      <Text x={LEFT} y={392} w={1300} size="m" text={p.question} color="ink2" shown={prog(t, 0.35, 0.6)} />

      {/* the three models, as they will appear in every later scene, with the size of each file */}
      <div style={{ position: 'absolute', left: LEFT, top: 610, display: 'flex', gap: 56 }}>
        {p.models.map((m, i) => (
          <div key={i} style={{ opacity: prog(t, at(m.at) + i * 0.12, 0.4) }}>
            <ModelChip id={m.id} />
            <div style={{ ...textStyle(th, 's'), lineHeight: 1, marginTop: 14, color: paint(th, 'ink2') }}>{m.size}</div>
          </div>
        ))}
      </div>
      <Text x={LEFT} y={760} size="s" text={p.note.text} color="back" shown={prog(t, at(p.note.at), 0.5)} />
    </AbsoluteFill>
  );
}
