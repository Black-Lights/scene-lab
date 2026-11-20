/**
 * @file diagram.tsx
 * @description `diagram` (and `flow`): a system drawn in its field's convention, nodes and labelled directed edges
 *   (C4 and data-flow habits: one line is one relationship, its label says what flows). Automatic layered layout
 *   with @dagrejs/dagre (synchronous, deterministic). Built on cues: a node appears when it is named, an edge draws
 *   on when the narration says what flows, and an edge with "carry" sends a payload along itself. The item being
 *   spoken about is in full ink; earlier ones step back. A diagram too big for the frame gets a camera that glides
 *   to the node in focus and pulls back to the whole drawing at the end. Continuity: when the previous scene is a
 *   diagram sharing node ids, those nodes glide to their new places and keep their edges.
 */
import React from 'react';
import dagre from '@dagrejs/dagre';
import { getLength, getPointAtLength } from '@remotion/paths';
import { AREA, colour, fit, useTheme } from '../theme';
import type { Theme } from '../theme';
import { DUR, EASE, atOf, clamp01, lerp, prog, useClock } from '../motion';
import { DrawPath, Glyph } from '../draw';
import { Swatch } from '../looks';
import { Any, SceneTitle, inkOf } from './common';

const textW = (s: string, size: number) => (s || '').length * size * 0.54;
const idOf = (n: Any) => String(n?.id ?? n?.label ?? '');

type Node = { id: string; label: string; sub?: string; icon?: Any; image?: Any; at?: number; shape?: string; x: number; y: number; w: number; h: number; raw: Any };
type Edge = { from: string; to: string; label?: string; d: string; lx: number; ly: number; lw: number; at?: number; raw: Any; end: [number, number]; dir: [number, number] };

export const layoutDiagram = (v: Any) => {
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({ rankdir: v?.direction || 'LR', nodesep: 70, ranksep: v?.direction === 'TB' ? 90 : 130, edgesep: 30, marginx: 0, marginy: 0 });
  g.setDefaultEdgeLabel(() => ({}));
  const nodes: Any[] = v?.nodes || [];
  for (const n of nodes) {
    const lab = String(n.label ?? n.id ?? '');
    const iconW = n.icon || n.image ? 64 : 0;
    const w = Math.max(n.shape === 'actor' ? 180 : 230, Math.max(textW(lab, 34), textW(n.sub || '', 26)) + iconW + 64);
    const h = n.shape === 'actor' ? 150 : n.sub ? 120 : 94;
    g.setNode(idOf(n), { width: w, height: h });
  }
  (v?.edges || []).forEach((e: Any, i: number) => {
    if (!g.hasNode(String(e.from)) || !g.hasNode(String(e.to))) return;
    g.setEdge(String(e.from), String(e.to), { width: e.label ? textW(e.label, 26) + 28 : 0, height: e.label ? 40 : 0, labelpos: 'c' }, `e${i}`);
  });
  dagre.layout(g);
  const ns: Node[] = nodes.map((n) => {
    const d = g.node(idOf(n));
    return { id: idOf(n), label: String(n.label ?? n.id ?? ''), sub: n.sub, icon: n.icon, image: n.image, at: n.at, shape: n.shape, x: d.x, y: d.y, w: d.width, h: d.height, raw: n };
  });
  const es: Edge[] = [];
  (v?.edges || []).forEach((e: Any, i: number) => {
    const d = g.edge({ v: String(e.from), w: String(e.to), name: `e${i}` });
    if (!d) return;
    const pts: { x: number; y: number }[] = d.points;
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let k = 1; k < pts.length - 1; k++) {
      const m = { x: (pts[k].x + pts[k + 1].x) / 2, y: (pts[k].y + pts[k + 1].y) / 2 };
      path += ` Q ${pts[k].x} ${pts[k].y} ${m.x} ${m.y}`;
    }
    const a = pts[pts.length - 2];
    const b = pts[pts.length - 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const dir: [number, number] = [(b.x - a.x) / len, (b.y - a.y) / len];
    path += ` L ${b.x - dir[0] * 12} ${b.y - dir[1] * 12}`;
    es.push({ from: String(e.from), to: String(e.to), label: e.label, d: path, lx: d.x ?? (a.x + b.x) / 2, ly: d.y ?? (a.y + b.y) / 2,
      lw: e.label ? textW(e.label, 26) + 28 : 0, at: e.at, raw: e, end: [b.x, b.y], dir });
  });
  const xs = [...ns.map((n) => n.x - n.w / 2), ...ns.map((n) => n.x + n.w / 2)];
  const ys = [...ns.map((n) => n.y - n.h / 2), ...ns.map((n) => n.y + n.h / 2)];
  const box = { x0: Math.min(...xs, 0), x1: Math.max(...xs, 1), y0: Math.min(...ys, 0), y1: Math.max(...ys, 1) };
  return { ns, es, box };
};

const NodeView = ({ n, th, ink, shown }: { n: Node; th: Theme; ink: string; shown: number }) => {
  const actor = n.shape === 'actor';
  const store = n.shape === 'store';
  const fill = th.look === 'stage' ? th.bg : th.surface;
  return (
    <g opacity={shown} transform={`translate(${n.x} ${n.y}) scale(${0.96 + 0.04 * shown})`}>
      {actor ? null : n.shape === 'circle' ? (
        <ellipse rx={n.w / 2} ry={n.h / 2} fill={fill} stroke={ink} strokeWidth={th.look === 'ground' ? 0 : 3} />
      ) : (
        <rect x={-n.w / 2} y={-n.h / 2} width={n.w} height={n.h} rx={store ? 4 : th.radius} fill={fill} stroke={ink} strokeWidth={th.look === 'ground' ? 0 : 3} />
      )}
      {store ? <line x1={-n.w / 2} x2={n.w / 2} y1={-n.h / 2 + 12} y2={-n.h / 2 + 12} stroke={ink} strokeWidth={2} /> : null}
      {actor ? (
        <>
          <Glyph icon={n.icon} size={78} color={ink} x={-39} y={-n.h / 2} />
          <text y={n.h / 2 - 14} textAnchor="middle" fontSize={fit(n.label, 34, 14)} fontFamily={th.font.text} fontWeight={th.weight.strong} fill={ink}>{n.label}</text>
        </>
      ) : (
        <>
          {n.icon ? <Glyph icon={n.icon} size={44} color={ink} x={-n.w / 2 + 24} y={-22} /> : null}
          <text x={n.icon ? -n.w / 2 + 84 : 0} y={n.sub ? -6 : 12} textAnchor={n.icon ? 'start' : 'middle'} fontSize={fit(n.label, 34, 18)}
            fontFamily={th.font.text} fontWeight={th.weight.strong} fill={ink}>{n.label}</text>
          {n.sub ? (
            <text x={n.icon ? -n.w / 2 + 84 : 0} y={30} textAnchor={n.icon ? 'start' : 'middle'} fontSize={fit(n.sub, 26, 24)} fontFamily={th.font.text}
              fontWeight={th.weight.text} fill={ink}>{n.sub}</text>
          ) : null}
        </>
      )}
    </g>
  );
};

export const Diagram = ({ v, dur, prev }: { v: Any; dur: number; prev?: { v: Any; dur: number } | null }) => {
  const th = useTheme();
  const t = useClock();
  const L = layoutDiagram(v);
  const P = prev?.v ? layoutDiagram(prev.v) : null;
  const top = v?.title ? 210 : 150;
  const area = { x0: AREA.side, x1: 1920 - AREA.side, y0: top, y1: 860 };
  const bw = L.box.x1 - L.box.x0;
  const bh = L.box.y1 - L.box.y0;
  const fitS = Math.min(1.25, (area.x1 - area.x0) / bw, (area.y1 - area.y0) / bh);
  const camera = v?.camera === true || (v?.camera !== false && fitS < 0.9); // labels would fall under ~30 px

  // one focus timeline over nodes and edges, in the order they are cued
  const items: { kind: 'n' | 'e' | 'c'; i: number; at: number; cued: boolean }[] = [];
  const all = [...L.ns.map((n, i) => ({ kind: 'n' as const, i, raw: n.raw })), ...L.es.map((e, i) => ({ kind: 'e' as const, i, raw: e.raw }))];
  // a drawing without cues builds quickly at the start; cued items wait for their word
  all.forEach((it, k) => items.push({ kind: it.kind, i: it.i, at: typeof it.raw?.at === 'number' ? Math.max(0, it.raw.at) : -0.4 + k * 0.1, cued: typeof it.raw?.at === 'number' }));
  // an edge without its own cue draws when the later of its two nodes is spoken
  items.forEach((it) => {
    if (it.kind !== 'e' || it.cued) return;
    const e = L.es[it.i];
    const ends = [e.from, e.to].map((id) => items.find((x) => x.kind === 'n' && L.ns[x.i].id === id));
    if (ends.some((x) => x?.cued)) it.at = Math.max(...ends.map((x) => x?.at ?? 0)) + 0.1;
  });
  L.es.forEach((e, i) => {
    if (typeof e.raw?.carry?.at === 'number') items.push({ kind: 'c', i, at: e.raw.carry.at, cued: true });
  });
  void atOf;
  const sorted = [...items].sort((a, b) => a.at - b.at);
  const backOf = (a: number) => {
    const nx = sorted.find((x) => x.at > a + 0.05);
    return nx === undefined ? 0 : prog(t, nx.at, DUR.settle, EASE.move);
  };
  const nodeAt = (i: number) => items.find((x) => x.kind === 'n' && x.i === i)!.at;
  const edgeAt = (i: number) => items.find((x) => x.kind === 'e' && x.i === i)!.at;
  const shared = new Set(P ? L.ns.filter((n) => P.ns.some((m) => m.id === n.id)).map((n) => n.id) : []);
  const glide = prog(t, 0, DUR.morph, EASE.move);

  // camera: whole drawing at rest; with a camera, glide to each focused node, pull back for the last 1.6 s
  const whole = { s: fitS, cx: (L.box.x0 + L.box.x1) / 2, cy: (L.box.y0 + L.box.y1) / 2 };
  const shots = sorted.filter((x) => x.cued); // the camera moves only on spoken cues, never during the quick build
  const shot = (k: number) => {
    const it = shots[k];
    if (it.kind === 'c') {
      const a = L.ns.find((m) => m.id === L.es[it.i].from)!;
      const b = L.ns.find((m) => m.id === L.es[it.i].to)!;
      return { s: Math.max(fitS, 1.05), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
    }
    const n = it.kind === 'n' ? L.ns[it.i] : L.ns.find((m) => m.id === L.es[it.i].to)!;
    return { s: Math.max(fitS, 1.05), cx: n.x, cy: n.y };
  };
  let cam = whole;
  if (camera && shots.length) {
    let k = -1;
    shots.forEach((x, j) => {
      if (x.at <= t) k = j;
    });
    if (k >= 0) {
      const from = k > 0 ? shot(k - 1) : whole;
      const to = shot(k);
      const p = prog(t, shots[k].at, DUR.camera, EASE.move);
      cam = { s: lerp(from.s, to.s, p), cx: lerp(from.cx, to.cx, p), cy: lerp(from.cy, to.cy, p) };
    }
    const back = prog(t, dur - 1.8, DUR.camera, EASE.move);
    cam = { s: lerp(cam.s, whole.s, back), cx: lerp(cam.cx, whole.cx, back), cy: lerp(cam.cy, whole.cy, back) };
  }
  const tx = (area.x0 + area.x1) / 2 - cam.cx * cam.s;
  const ty = (area.y0 + area.y1) / 2 - cam.cy * cam.s;
  const fadeOld = 1 - prog(t, 0.05, DUR.exit, EASE.exit);
  const lift = (v?.direction || 'LR') === 'LR' ? 52 : 0; // a label sits above its line, clear of the payload

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <SceneTitle text={v?.title} t={t} />
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <g transform={`translate(${tx} ${ty}) scale(${cam.s})`}>
          {P && fadeOld > 0 ? (
            <g opacity={fadeOld}>
              {P.es.map((e, i) => (L.es.some((f) => f.from === e.from && f.to === e.to) ? null : <path key={`pe${i}`} d={e.d} stroke={th.back} strokeWidth={3} fill="none" />))}
              {P.ns.map((n) => (shared.has(n.id) ? null : <NodeView key={`pn${n.id}`} n={n} th={th} ink={th.back} shown={1} />))}
            </g>
          ) : null}
          {(v?.groups || []).map((gr: Any, k: number) => {
            const mem = L.ns.filter((n) => (gr.nodes || []).map(String).includes(n.id));
            if (!mem.length) return null;
            const x0 = Math.min(...mem.map((n) => n.x - n.w / 2)) - 34;
            const x1 = Math.max(...mem.map((n) => n.x + n.w / 2)) + 34;
            const y0 = Math.min(...mem.map((n) => n.y - n.h / 2)) - 64;
            const y1 = Math.max(...mem.map((n) => n.y + n.h / 2)) + 30;
            const at = typeof gr.at === 'number' ? gr.at : Math.min(...mem.map((n) => nodeAt(L.ns.indexOf(n))));
            return (
              <g key={`g${k}`} opacity={prog(t, at, DUR.enter)}>
                <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} rx={th.radius + 6} fill={th.lane ?? 'none'} fillOpacity={th.look === 'plate' ? 0.6 : 0.25}
                  stroke={th.line} strokeWidth={2} strokeDasharray="10 8" />
                <text x={x0 + 22} y={y0 + 40} fontSize={28} fontFamily={th.font.text} fontWeight={th.weight.strong} fill={th.ink2}>{gr.label}</text>
              </g>
            );
          })}
          {L.es.map((e, i) => {
            const at = edgeAt(i);
            const kept = P && P.es.some((f) => f.from === e.from && f.to === e.to);
            const p = kept ? 1 : prog(t, at, DUR.draw, EASE.move);
            const ink = inkOf(th, backOf(at));
            const head = clamp01((p - 0.85) / 0.15);
            const [bx, by] = e.end;
            const [dx, dy] = e.dir;
            const carry = e.raw?.carry;
            let token: React.ReactElement | null = null;
            if (carry && p > 0.95) {
              const len = getLength(e.d);
              const go = typeof e.raw?.carry?.at === 'number' ? e.raw.carry.at : at + DUR.draw * 0.6;
              const s = EASE.move(clamp01((t - go) / DUR.travel));
              const pt = getPointAtLength(e.d, Math.max(0, Math.min(len - 48, len * s)));  // rests just before the head
              if (pt && s > 0) {
                token = (
                  <g transform={`translate(${pt.x} ${pt.y})`}>
                    {carry === true || (typeof carry === 'object' && !carry.icon) ? <circle r={11} fill={ink} /> : typeof carry === 'string' ? <Swatch c={colour(th, carry)} r={20} th={th} /> : (
                      <g>
                        <rect x={-30} y={-30} width={60} height={60} rx={10} fill={th.look === 'stage' ? th.bg : th.surface} stroke={ink} strokeWidth={2} />
                        <Glyph icon={carry.icon ?? carry} size={36} color={ink} x={-18} y={-18} />
                      </g>
                    )}
                  </g>
                );
              }
            }
            return (
              <g key={`e${i}`}>
                <DrawPath d={e.d} p={p} color={ink} width={th.look === 'ground' ? 5 : 3} dashed={!!e.raw?.dashed} />
                <path d={`M ${bx} ${by} L ${bx - dx * 20 - dy * 9} ${by - dy * 20 + dx * 9} L ${bx - dx * 20 + dy * 9} ${by - dy * 20 - dx * 9} Z`} fill={ink} opacity={head} />
                {e.label ? (
                  <g opacity={prog(t, at + 0.25, DUR.enter)}>
                    <rect x={e.lx - e.lw / 2} y={e.ly - 22 - lift} width={e.lw} height={42} rx={6} fill={th.bg} />
                    <text x={e.lx} y={e.ly + 9 - lift} textAnchor="middle" fontSize={26} fontFamily={th.font.text} fontWeight={th.weight.text} fill={ink}>{e.label}</text>
                  </g>
                ) : null}
                {token}
              </g>
            );
          })}
          {L.ns.map((n, i) => {
            const at = nodeAt(i);
            const was = P?.ns.find((m) => m.id === n.id);
            const nn = was ? { ...n, x: lerp(was.x, n.x, glide), y: lerp(was.y, n.y, glide) } : n;
            return <NodeView key={n.id} n={nn} th={th} ink={inkOf(th, backOf(at))} shown={was ? 1 : prog(t, at, DUR.enter)} />;
          })}
        </g>
      </svg>
    </div>
  );
};

/** `flow`: steps in a row (or a loop with layout "cycle") are a diagram whose edges join consecutive items. */
export const Flow = ({ v, dur, prev }: { v: Any; dur: number; prev?: { v: Any; dur: number } | null }) => {
  const items: Any[] = v?.items || [];
  const nodes = items.map((it, i) => ({ id: `s${i}`, label: it.label ?? it.text ?? String(it), sub: it.sub, icon: it.icon, image: it.image, at: it.at, cue: it.cue }));
  const edges = items.slice(1).map((it, i) => ({ from: `s${i}`, to: `s${i + 1}`, at: typeof it.at === 'number' ? it.at - 0.1 : undefined, carry: it.carry }));
  if (v?.layout === 'cycle' && items.length > 2) edges.push({ from: `s${items.length - 1}`, to: 's0', at: undefined, carry: undefined });
  return <Diagram v={{ ...v, nodes, edges, direction: v?.direction || 'LR' }} dur={dur} prev={prev} />;
};
