/**
 * @file videos/reflection-lab-free/scenes/Desk.tsx
 * @description The fact-checker's desk: one picture drawn by three scenes ("cut": "none" between them).
 *   Five sheets lie on it: the document and the question on the left, the analyst's draft and final answer in the
 *   middle, the critic's audit on the right. Two seats head the middle and the right column: a role's name and,
 *   under it, a chair (a dashed place) that a model's chip takes.
 *   - props.mode "frame": the loop as empty places. The seats are named as on a news desk (reporter, fact-checker)
 *     and take the lab's names (analyst, critic) on the beat "lab"; the place being spoken of then stands out.
 *   - props.mode "case", props.run: one real run from the note fills the sheets, phrase marks land on spoken words.
 *     props.after says what the scene before left on the desk: "frame" (empty places) or the key of another run,
 *     whose sheets are cleared first and whose two model chips trade seats on the beat "swap" (one arcs over the
 *     row and one under it, so neither covers the other).
 *   All text is in ../data/desk.json; all times are beats of the spec.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Arrow2, CHIP_H, PAST, SceneTitle, Text, clamp01, highlight, mix, mixColour, paint, prog, useBeats, useClock, useTheme } from '@kit';
import type { SceneProps } from '@kit';
import desk from '../data/desk.json';
import { Grade, INSET, ModelChip, Paper, Para } from './lib/paper';
import type { Seg } from './lib/paper';

const DOC = { x: 110, y: 336, w: 480, h: 268 };
const QUE = { x: 110, y: 680, w: 480, h: 146 };
const DRA = { x: 700, y: 336, w: 520, h: 235 };
const FIN = { x: 700, y: 680, w: 520, h: 146 };
const AUD = { x: 1330, y: 336, w: 480, h: 430 };
/** A seat heads the middle and the right column: the role's name, and under it the chair a model's chip takes. */
const ROLE_Y = 186;
const CHAIR = { y: 226, w: 236, h: 46 };
/** Height of the arrows that join the three columns. */
const FLOW_Y = 436;

type Run = { analyst: string; critic: string; document: Seg[]; question: Seg[]; draft: Seg[]; draftGrade: string;
  audit: Seg[][]; final: Seg[]; finalGrade: string };
type Props = { mode: 'frame' | 'case'; run?: string; after?: string };
type Shown = { document: number; question: number; draft: number; audit: number; final: number; grade1: number; grade2: number };

export default function Desk({ v }: SceneProps) {
  const th = useTheme();
  const t = useClock();
  const beats = useBeats();
  const p = (v.props ?? {}) as Props;
  const at = (name: string, fallback = Infinity) => (name in beats ? beats[name] : fallback);
  const frame = p.mode === 'frame';
  const runs = desk.runs as unknown as Record<string, Run>;
  const run = p.run ? runs[p.run] : null;
  const before = p.after && p.after !== 'frame' ? runs[p.after] : null;
  const grades = desk.grades as Record<string, string>;

  // --- the places: in the frame scene each arrives on its word; afterwards they are simply there ---
  const slot = (name: string) => (frame ? prog(t, at(name), 0.5) : 1);
  const flow = (name: string) => (frame ? at(name) : PAST);
  const lab = frame ? prog(t, at('lab'), 0.4) : 1;
  // in the frame scene the place being spoken of stands out: the draft, then the audit, then the final answer
  const lit = { draft: frame ? highlight(t, at('drafts'), at('audits')) : 0, audit: frame ? highlight(t, at('audits'), at('only')) : 0,
    final: frame ? highlight(t, at('only'), Infinity) : 0 };
  const verdicts = frame ? prog(t, at('verdict'), 0.4) : p.after === 'frame' ? 1 - prog(t, 0, 0.4) : 0;

  // --- what lies on the desk: the run before leaves in the first half second, this run arrives beat by beat ---
  const gone = before ? 1 - prog(t, 0.05, 0.45, 'exit') : 0;
  const mark = (name: string) => prog(t, at(name), 0.6, 'move');
  const doc = at('doc');
  const now: Shown = {
    document: prog(t, doc, 0.5), question: prog(t, at('question', doc + 0.3), 0.5), draft: prog(t, at('draft'), 0.5),
    audit: prog(t, at('audit'), 0.5), final: prog(t, at('final'), 0.5), grade1: prog(t, at('grade1'), 0.4), grade2: prog(t, at('grade2'), 0.4),
  };
  const old: Shown = { document: gone, question: gone, draft: gone, audit: gone, final: gone, grade1: gone, grade2: gone };
  const fill = (name: keyof Shown) => clamp01((run ? now[name] : 0) + (before ? old[name] : 0));

  // --- the seats: a role's name, and under it a chair. A model's chip takes the chair; on "swap" the two chips
  //     slide along the row of chairs to each other's place, one arcing above the row and one below it ---
  const swap = prog(t, at('swap'), 1.0, 'move');
  const lift = (CHIP_H / 2 + 4) * Math.sin(Math.PI * swap);
  const chips: { id: string; x: number; y: number; k: number }[] = [];
  let empty = { analyst: frame ? prog(t, at('chairs'), 0.4) : 1, critic: frame ? prog(t, at('chairs'), 0.4) : 1 };
  if (run && before) {
    chips.push({ id: run.critic, x: mix(DRA.x, AUD.x, swap), y: CHAIR.y - lift, k: 1 });
    chips.push({ id: run.analyst, x: mix(AUD.x, DRA.x, swap), y: CHAIR.y + lift, k: 1 });
    const away = Math.sin(Math.PI * swap);
    empty = { analyst: away, critic: away };
  } else if (run) {
    const seated = { analyst: prog(t, at('analyst'), 0.4), critic: prog(t, at('critic'), 0.4) };
    chips.push({ id: run.analyst, x: DRA.x, y: CHAIR.y, k: seated.analyst });
    chips.push({ id: run.critic, x: AUD.x, y: CHAIR.y, k: seated.critic });
    empty = { analyst: 1 - seated.analyst, critic: 1 - seated.critic };
  }
  const chair = (x: number, k: number) => (
    <div style={{ position: 'absolute', left: x, top: CHAIR.y, width: CHAIR.w, height: CHAIR.h, boxSizing: 'border-box', borderRadius: th.radius,
      border: `${th.stroke}px dashed ${mixColour(paint(th, 'bg'), paint(th, 'back'), k)}` }} />
  );

  const sheets = (r: Run, k: Shown, m: (name: string) => number) => (
    <>
      <div style={{ position: 'absolute', left: DOC.x, top: DOC.y }}><Para segs={r.document} w={DOC.w - 2 * INSET} k={k.document} mark={m} /></div>
      <div style={{ position: 'absolute', left: QUE.x, top: QUE.y }}><Para segs={r.question} w={QUE.w - 2 * INSET} k={k.question} mark={m} /></div>
      <div style={{ position: 'absolute', left: DRA.x, top: DRA.y }}><Para segs={r.draft} w={DRA.w - 2 * INSET} k={k.draft} mark={m} /></div>
      <div style={{ position: 'absolute', left: FIN.x, top: FIN.y }}><Para segs={r.final} w={FIN.w - 2 * INSET} k={k.final} mark={m} /></div>
      <div style={{ position: 'absolute', left: AUD.x + INSET, top: AUD.y + INSET - 4, width: AUD.w - 2 * INSET, opacity: k.audit }}>
        {r.audit.map((line, i) => <Para key={i} segs={line} w={AUD.w - 2 * INSET} flow mark={m} />)}
      </div>
      <Grade x={DRA.x + DRA.w} y={DRA.y - 46} word={grades[r.draftGrade]} kind={r.draftGrade} k={k.grade1} />
      <Grade x={FIN.x + FIN.w} y={FIN.y - 46} word={grades[r.finalGrade]} kind={r.finalGrade} k={k.grade2} />
    </>
  );

  return (
    <AbsoluteFill>
      <SceneTitle text={v.title} t={t} />

      {/* the seats */}
      {frame ? (
        <>
          <Text x={DRA.x} y={ROLE_Y} size="s" text={desk.seats.reporter} color="ink2" shown={prog(t, at('reporter'), 0.4) * (1 - lab)} />
          <Text x={AUD.x} y={ROLE_Y} size="s" text={desk.seats.checker} color="ink2" shown={prog(t, at('checker'), 0.4) * (1 - lab)} />
        </>
      ) : null}
      <Text x={DRA.x} y={ROLE_Y} size="s" text={desk.seats.analyst} color="ink2" shown={lab} />
      <Text x={AUD.x} y={ROLE_Y} size="s" text={desk.seats.critic} color="ink2" shown={lab} />
      {chair(DRA.x, empty.analyst)}
      {chair(AUD.x, empty.critic)}
      {chips.map((c) => <ModelChip key={c.id} id={c.id} x={c.x} y={c.y} k={c.k} />)}

      {/* the five places, then what is written on them */}
      <Paper {...DOC} name={desk.names.document} slot={slot('document')} fill={fill('document')} />
      <Paper {...QUE} name={desk.names.question} slot={slot('question')} fill={fill('question')} />
      <Paper {...DRA} name={desk.names.draft} slot={slot('draft')} fill={fill('draft')} lit={lit.draft} />
      <Paper {...AUD} name={desk.names.audit} slot={slot('audit')} fill={fill('audit')} lit={lit.audit} />
      <Paper {...FIN} name={desk.names.final} slot={slot('final')} fill={fill('final')} lit={lit.final} />
      {before ? sheets(before, old, () => 1) : null}
      {run ? sheets(run, now, mark) : null}

      {/* the two verdicts the critic may open with, written into the empty audit place */}
      {verdicts > 0 ? (
        <div style={{ position: 'absolute', left: AUD.x + INSET, top: AUD.y + INSET, opacity: verdicts }}>
          {desk.verdicts.map((line, i) => (
            <Para key={i} segs={line as Seg[]} w={AUD.w - 2 * INSET} flow on="ground" />
          ))}
        </div>
      ) : null}

      {/* the way round: document to draft, draft to audit, and back to a final answer only on ISSUES */}
      <Arrow2 from={[DOC.x + DOC.w + 14, FLOW_Y]} to={[DRA.x - 14, FLOW_Y]} at={flow('draft')} t={t} />
      <Arrow2 from={[DRA.x + DRA.w + 14, FLOW_Y]} to={[AUD.x - 14, FLOW_Y]} at={flow('audit')} t={t} />
      <Arrow2 from={[AUD.x + 250, AUD.y + AUD.h + 12]} to={[FIN.x + FIN.w + 14, FIN.y + 126]} elbow="vh" at={flow('final')} t={t} />
      <Text x={FIN.x + FIN.w + 44} y={FIN.y + 138} size="s" text={desk.only} color="ink2" shown={frame ? prog(t, at('only'), 0.4) : 1} />
    </AbsoluteFill>
  );
}
