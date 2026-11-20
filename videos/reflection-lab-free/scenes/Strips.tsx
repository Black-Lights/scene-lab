/**
 * @file videos/reflection-lab-free/scenes/Strips.tsx
 * @description Counts out of the note's 104 questions, drawn as strips of 104 cells so that every count in the
 *   video stands on one scale. A strip is a list of segments (how many cells, of which kind); kinds are "ok"
 *   (a paper cell), "other" (an empty cell), "bad" (a red cell that stands lower than the rest, so the kind is
 *   told by shape as well as colour) and "maybe" (the same, hatched: only in some pairings). Strips stand under a
 *   group head (model chips and words), with the count at the right end and notes beneath. Three scenes use this
 *   file with their own props: the swap counted both ways, the critics' objections, and Gemma alone three ways.
 *   Every word, number and time comes from the spec.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { HatchDefs, SceneTitle, Text, dataStyle, hatchFill, hatchId, paint, prog, textStyle, useBeats, useClock, useTheme } from '@kit';
import type { SceneProps } from '@kit';
import { ModelChip } from './lib/paper';

type Kind = 'ok' | 'other' | 'bad' | 'maybe';
type Segment = [number, Kind, string?];
type Part = { model?: string; text?: string };
type Value = { t: string; at?: string };
type Strip = { label: string; labelAt?: string; ghostAt?: string; at: string; seg: Segment[]; value: Value[]; valueKind?: Kind };
type Group = { y: number; at: string; head: Part[]; strips: Strip[]; notes?: { text: string; at: string }[] };
type Props = { x0: number; pitch: number; cellH?: number; row?: number; groups: Group[];
  legend: { kind: Kind; text: string }[]; legendAt: string; legendY: number; foot?: { text: string; at: string; y: number } };

const LEFT = 110;
const RIGHT = 1810;
/** How much lower a red cell stands than the others. */
const DROP = 10;

type CellsProps = { seg: Segment[]; pitch: number; h: number; times: number[]; t: number; quiet?: boolean };

/** One strip: its cells arrive from the left, each segment on its own time. `quiet` draws empty cells in the line ink. */
function Cells({ seg, pitch, h, times, t, quiet = false }: CellsProps) {
  const th = useTheme();
  const paper = paint(th, 'paper');
  const back = paint(th, quiet ? 'line' : 'back');
  const flag = paint(th, 'flag');
  const hatch = hatchId(flag, { pitch: 6, width: 2 });
  const rects: React.ReactNode[] = [];
  let i = 0;
  seg.forEach(([n, kind], s) => {
    for (let j = 0; j < n; j++, i++) {
      const k = prog(t, times[s] + j * 0.006, 0.2);
      const red = kind === 'bad' || kind === 'maybe';
      const fill = kind === 'ok' ? paper : kind === 'bad' ? flag : kind === 'maybe' ? hatchFill(hatch) : 'none';
      const stroke = kind === 'other' ? back : kind === 'maybe' ? flag : 'none';
      rects.push(<rect key={i} x={i * pitch + 0.75} y={0.75} width={pitch - 3.5} height={h - 1.5 + (red ? DROP : 0)} fill={fill}
        stroke={stroke} strokeWidth={1.5} opacity={k} />);
    }
  });
  const total = seg.reduce((sum, [n]) => sum + n, 0);
  return (
    <svg width={total * pitch} height={h + DROP + 2} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
      <HatchDefs id={hatch} color={flag} pitch={6} />
      {rects}
    </svg>
  );
}

export default function Strips({ v }: SceneProps) {
  const th = useTheme();
  const t = useClock();
  const beats = useBeats();
  const p = v.props as unknown as Props;
  const at = (name?: string) => (name !== undefined && name in beats ? beats[name] : Infinity);
  const h = p.cellH ?? 40;
  const row = p.row ?? 58;
  const count = dataStyle(th, 'm');
  const inkOf = (kind?: Kind) => paint(th, kind === 'bad' || kind === 'maybe' ? 'flag' : 'ink');

  return (
    <AbsoluteFill>
      <SceneTitle text={v.title} t={t} />

      {p.groups.map((g, gi) => {
        const top = g.y + 66;
        return (
          <React.Fragment key={gi}>
            {/* the head: who writes, who checks, what is counted */}
            <div style={{ position: 'absolute', left: LEFT, top: g.y, height: 46, display: 'flex', alignItems: 'center', gap: 14,
              opacity: prog(t, at(g.at), 0.4), ...textStyle(th, 's'), lineHeight: 1, whiteSpace: 'nowrap' }}>
              {g.head.map((part, i) => (part.model ? <ModelChip key={i} id={part.model} /> : <span key={i}>{part.text}</span>))}
            </div>

            {g.strips.map((s, si) => {
              const y = top + si * row;
              const start = at(s.at);
              const times = s.seg.map(([, , own]) => (own ? at(own) : start));
              return (
                <React.Fragment key={si}>
                  <Text x={LEFT} y={y + (h - 34) / 2} size="s" text={s.label} color="ink2" shown={prog(t, at(s.labelAt ?? s.at), 0.4)} />
                  <div style={{ position: 'absolute', left: p.x0, top: y }}>
                    {/* the scale before the count: 104 empty cells, one per question */}
                    {s.ghostAt ? <Cells seg={[[104, 'other']]} pitch={p.pitch} h={h} times={[at(s.ghostAt)]} t={t} quiet /> : null}
                    <Cells seg={s.seg} pitch={p.pitch} h={h} times={times} t={t} />
                  </div>
                  <div style={{ position: 'absolute', left: p.x0 + 104 * p.pitch + 22, top: y + (h - 46) / 2, height: 46, display: 'flex',
                    alignItems: 'center', ...count, lineHeight: 1, color: inkOf(s.valueKind), whiteSpace: 'pre' }}>
                    {s.value.map((part, i) => <span key={i} style={{ opacity: prog(t, at(part.at ?? s.at) + 0.3, 0.4) }}>{part.t}</span>)}
                  </div>
                </React.Fragment>
              );
            })}

            <div style={{ position: 'absolute', left: p.x0, top: top + g.strips.length * row + 8, display: 'flex', gap: 48,
              ...textStyle(th, 's'), lineHeight: 1.2, whiteSpace: 'nowrap' }}>
              {(g.notes ?? []).map((n, i) => <span key={i} style={{ opacity: prog(t, at(n.at), 0.5) }}>{n.text}</span>)}
            </div>
          </React.Fragment>
        );
      })}

      {/* the legend: one cell of each kind and its word */}
      <div style={{ position: 'absolute', left: LEFT, top: p.legendY, display: 'flex', gap: 44, alignItems: 'center',
        opacity: prog(t, at(p.legendAt), 0.5), ...textStyle(th, 's'), lineHeight: 1, color: paint(th, 'ink2'), whiteSpace: 'nowrap' }}>
        {p.legend.map((l, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ position: 'relative', width: 16, height: 34 }}>
              <Cells seg={[[1, l.kind]]} pitch={16} h={l.kind === 'bad' || l.kind === 'maybe' ? 24 : 34} times={[-1e6]} t={t} />
            </div>
            {l.text}
          </div>
        ))}
      </div>
      {p.foot ? <Text x={RIGHT} y={p.foot.y} size="s" anchor="end" text={p.foot.text} color="back" shown={prog(t, at(p.foot.at), 0.5)} /> : null}
    </AbsoluteFill>
  );
}
