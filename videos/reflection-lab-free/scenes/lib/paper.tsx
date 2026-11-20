/**
 * @file videos/reflection-lab-free/scenes/lib/paper.tsx
 * @description The drawn parts of the fact-checker's desk, shared by this video's scenes: a sheet of proof paper on
 *   the desk (Paper), a quoted passage in which single phrases are marked as a checker would mark them (Para: a
 *   highlighter wash, a red pencil underline, a strike), the grader's label under an answer (Grade) and a model's
 *   name chip (ModelChip). Colours are paints of the video's design: paper and print for the sheets, pencil for
 *   red on paper, flag for red on the desk, marker for the highlighter. Every text comes from the spec or a data file.
 */
import React from 'react';
import { CHIP_H, Chip, mixColour, paint, textStyle, useTheme } from '@kit';
import models from '../../data/models.json';

/** One run of text in a passage. `mark` draws on when the beat named `on` is spoken; `strike` names a second beat. */
export type Seg = { t: string; mark?: 'under' | 'wash'; on?: string; strike?: string; data?: boolean; red?: boolean };

/** Space between a sheet's edge and its text, in layout pixels. */
export const INSET = 22;
/** Size and line height of quoted text. */
export const BODY = 30;
export const LEAD = 1.27;

type PaperProps = { x: number; y: number; w: number; h: number; name?: string; slot?: number; fill?: number; lit?: number;
  children?: React.ReactNode };

/**
 * A sheet on the desk. `slot` 0..1 brings in its dashed place and its name; `fill` 0..1 lays the paper into it;
 * `lit` 0..1 makes an empty place and its name stand out. Children count from the sheet's top-left corner.
 */
export function Paper({ x, y, w, h, name, slot = 1, fill = 1, lit = 0, children }: PaperProps) {
  const th = useTheme();
  const bg = paint(th, 'bg');
  const paper = paint(th, 'paper');
  const ink = paint(th, 'ink');
  const edge = mixColour(mixColour(mixColour(bg, paint(th, 'back'), slot), ink, lit), paper, fill);
  return (
    <>
      {name ? (
        <div style={{ position: 'absolute', left: x, top: y - 46, ...textStyle(th, 's'), lineHeight: 1.2, whiteSpace: 'nowrap',
          color: mixColour(mixColour(bg, paint(th, 'ink2'), slot), ink, lit) }}>
          {name}
        </div>
      ) : null}
      <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, boxSizing: 'border-box', borderRadius: th.radius,
        border: `${th.stroke * (1 + lit)}px dashed ${edge}`, background: mixColour(bg, paper, fill) }}>
        {children}
      </div>
    </>
  );
}

type ParaProps = { segs: Seg[]; w: number; x?: number; y?: number; k?: number; mark?: (name: string) => number;
  on?: 'paper' | 'ground'; size?: number; flow?: boolean };

/**
 * A passage set in the reading face. A marked phrase gets its mark from left to right, through line breaks, as
 * `mark(name)` goes from 0 to 1. `on` says what it stands on, which decides the ink and the red. With `flow` it is
 * a block in its parent's column (passages under each other) instead of a box placed at x, y.
 */
export function Para({ segs, w, x = INSET, y = INSET - 4, k = 1, mark = () => 0, on = 'paper', size = BODY, flow = false }: ParaProps) {
  const th = useTheme();
  const onPaper = on === 'paper';
  const base = paint(th, onPaper ? 'paper' : 'bg');
  const red = paint(th, onPaper ? 'pencil' : 'flag');
  const wash = mixColour(base, paint(th, 'marker'), onPaper ? 0.6 : 0.35);
  const reading = textStyle(th, 'l').fontFamily;
  const dataFace = th.font.data;
  return (
    <div style={{ ...(flow ? { position: 'relative', marginBottom: 14 } : { position: 'absolute', left: x, top: y }), width: w, opacity: k,
      fontFamily: reading, fontSize: size, lineHeight: LEAD, fontWeight: 400, color: paint(th, onPaper ? 'print' : 'ink') }}>
      {segs.map((s, i) => {
        const style: React.CSSProperties = {};
        if (s.data) Object.assign(style, { fontFamily: dataFace, fontSize: size * 0.9, fontWeight: 600 });
        if (s.red) style.color = red;
        const images: string[] = [];
        const sizes: string[] = [];
        const spots: string[] = [];
        if (s.strike) {
          images.push(`linear-gradient(${red}, ${red})`);
          sizes.push(`${mark(s.strike) * 100}% 3px`);
          spots.push('0 56%');
        }
        if (s.mark && s.on) {
          const p = mark(s.on);
          const under = s.mark === 'under';
          images.push(under ? `linear-gradient(${red}, ${red})` : `linear-gradient(${wash}, ${wash})`);
          sizes.push(under ? `${p * 100}% 4px` : `${p * 100}% 84%`);
          spots.push(under ? '0 97%' : '0 55%');
        }
        if (images.length) {
          Object.assign(style, { backgroundImage: images.join(', '), backgroundSize: sizes.join(', '),
            backgroundPosition: spots.join(', '), backgroundRepeat: 'no-repeat' });
        }
        return <span key={i} style={style}>{s.t}</span>;
      })}
    </div>
  );
}

type GradeProps = { x: number; y: number; word: string; kind: string; k: number };

/** The grader's label for an answer, right-aligned at x: a tick, a cross or a bar, and the word. */
export function Grade({ x, y, word, kind, k }: GradeProps) {
  const th = useTheme();
  const color = paint(th, kind === 'correct' ? 'ink' : 'flag');
  const s = 26;
  const sw = th.stroke * 2;
  return (
    <div style={{ position: 'absolute', right: 1920 - x, top: y, height: 40, display: 'flex', alignItems: 'center', gap: 10, opacity: k,
      ...textStyle(th, 's'), lineHeight: 1, color, whiteSpace: 'nowrap' }}>
      <svg width={s} height={s} viewBox="0 0 26 26" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        {kind === 'correct' ? <polyline points="3,14 10,21 23,5" /> : null}
        {kind === 'hallucination' ? <path d="M4 4 L22 22 M22 4 L4 22" /> : null}
        {kind === 'incomplete' ? <path d="M4 13 L22 13" /> : null}
      </svg>
      {word}
    </div>
  );
}

export type ModelId = keyof typeof models;

/** A model's name on a solid chip of its colour. Without x and y it sits inline. */
export function ModelChip({ id, x, y, k = 1 }: { id: string; x?: number; y?: number; k?: number }) {
  const m = models[id as ModelId];
  const chip = <Chip x={x} y={y} text={m.name} color={m.color} solid ink="print" />;
  if (k >= 1) return chip;
  return <div style={{ opacity: k, display: x === undefined ? 'inline-block' : undefined, height: x === undefined ? CHIP_H : undefined }}>{chip}</div>;
}
