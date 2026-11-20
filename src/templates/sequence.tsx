/**
 * @file sequence.tsx
 * @description `sequence`: a protocol or multi-agent exchange drawn in its field's convention (RFC 8446, UML):
 *   one column per actor with a lifeline, time flowing down, messages as arrows that draw on at their cue while
 *   their payload (a paint swatch, an icon, or a sealed packet) travels along them. An actor with "watch": true is
 *   the public lane: every message crossing it leaves a copy there (a sealed message leaves only scrambled bytes).
 *   Notes sit over one actor, several, or "all"; consecutive notes over different actors share a row.
 *   Focus: whatever was spoken about last is in full ink, earlier steps step back; an actor with a cue takes focus.
 *   A message with "detail" opens the plate look's detail lens on its copy: the analogy object shown as the real
 *   artefact. Continuity: when the previous scene is a sequence with the same actors, they stay put (or glide to
 *   their new column) and the old messages fade, so the drawing carries across the cut.
 */
import React from 'react';
import { interpolateColors } from 'remotion';
import { colour, fit, useTheme } from '../theme';
import type { Theme } from '../theme';
import { DUR, EASE, atOf, clamp01, lerp, prog, useClock } from '../motion';
import { DrawPath, Glyph, passTime, travelX } from '../draw';
import { NoteBox, Packet, Scrambled, Swatch, seqLook } from '../looks';
import type { SeqLook } from '../looks';
import { useGlyphs } from '../glyphs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const nameOf = (a: Any): string => (typeof a === 'string' ? a : a?.name ?? '');
const listOf = (o: Any, names: string[]): string[] => (o == null || o === 'all' ? names : Array.isArray(o) ? o : [o]);
const textW = (s: string, size: number, bold = false) => s.length * size * (bold ? 0.56 : 0.52);
const isNote = (s: Any) => !s?.from && (s?.note != null || s?.over != null || Array.isArray(s?.mix) || s?.swatch != null);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const BOTTOM = 852;

export const seqLayout = (v: Any, th: Theme) => {
  const K = seqLook(th);
  const actors = (v?.actors || []).map((a: Any) => (typeof a === 'string' ? { name: a } : a));
  const names: string[] = actors.map(nameOf);
  const steps: Any[] = v?.messages || v?.steps || [];
  const rows: number[] = [];
  const rowKind: ('msg' | 'note')[] = [];
  let r = -1;
  let noteSet: Set<string> | null = null;
  for (const s of steps) {
    if (isNote(s)) {
      const set = listOf(s.over, names);
      if (noteSet && set.length < names.length && set.every((n) => !noteSet!.has(n))) {
        rows.push(r);
        set.forEach((n) => noteSet!.add(n));
        continue;
      }
      r += 1;
      rowKind.push('note');
      noteSet = new Set(set);
    } else {
      r += 1;
      rowKind.push('msg');
      noteSet = null;
    }
    rows.push(r);
  }
  const n = Math.max(1, actors.length);
  const gap = n <= 1 ? 0 : n === 2 ? Math.min(K.gap * 1.8, 1100) : Math.min(K.gap, 1560 / (n - 1));
  const xs: number[] = actors.map((_: Any, i: number) => 960 + (i - (n - 1) / 2) * gap);
  const headTop = K.headTop + (v?.title ? 70 : 0);
  const lifeTop = headTop + K.headH + (K.head === 'bare' ? 16 : 8);
  const y0 = lifeTop + 26;
  const base = rowKind.map((k) => (k === 'msg' ? 108 : 82));
  const sum = base.reduce((a, b) => a + b, 0) || 1;
  let s = Math.min(1.15, (BOTTOM - 12 - y0) / sum);
  // a detail lens opens below its message's copy: keep room for its inset (copy 51 px + lens 68 px + inset)
  steps.forEach((st, i) => {
    if (!st?.detail || !st?.from || th.look !== 'plate') return;
    const k = rows[i];
    const h = 50 + 30 * (st.detail.lines || st.detail.data || []).length;
    const before = base.slice(0, k).reduce((a, b) => a + b, 0) + 0.47 * base[k];
    s = Math.min(s, (BOTTOM - 119 - h - y0) / Math.max(1, before));
  });
  const tops: number[] = [];
  let y = y0;
  base.forEach((h) => {
    tops.push(y);
    y += h * s;
  });
  // message rows: the line sits high in its row so the eavesdropper's copy fits under it
  const rowY = (k: number) => tops[k] + (rowKind[k] === 'msg' ? 0.47 : 0.5) * base[k] * s;
  const rowH = (k: number) => base[k] * s;
  const watch = actors.findIndex((a: Any) => a?.watch);
  return { K, actors, names, xs, steps, rows, rowKind, headTop, lifeTop, rowY, rowH, watch };
};

type L = ReturnType<typeof seqLayout>;

/** Where the eavesdropper's copy of a message sits, per look. */
const copyAt = (K: SeqLook, xw: number, y: number) =>
  K.copy === 'print' ? { x: xw, y: y + 14 + K.copyR } : K.copy === 'tap' ? { x: xw, y: y + 24 + K.copyR } : { x: xw, y: y + 32 + K.copyR };

/** Arrowhead at (x, y) pointing in dir, per look. */
const Head = ({ x, y, dir, color, K, on }: { x: number; y: number; dir: number; color: string; K: SeqLook; on: number }) => {
  if (on <= 0) return null;
  const l = K.arrowHead === 'filled' ? 20 : 22;
  const w = K.arrowHead === 'filled' ? 8 : 15;
  return K.arrowHead === 'filled' ? (
    <path d={`M ${x} ${y} L ${x - dir * l} ${y - w} L ${x - dir * l} ${y + w} Z`} fill={color} opacity={on} />
  ) : (
    <path d={`M ${x - dir * l} ${y - w} L ${x} ${y} L ${x - dir * l} ${y + w}`} fill="none" stroke={color} strokeWidth={K.arrowW}
      strokeLinecap="round" strokeLinejoin="round" opacity={on} />
  );
};

const Lens = ({ cx, cy, r, d, t, at, th }: { cx: number; cy: number; r: number; d: Any; t: number; at: number; th: Theme }) => {
  const a = prog(t, at, DUR.draw, EASE.move);
  const b = prog(t, at + 0.35, DUR.enter);
  if (a <= 0) return null;
  const lines: string[] = d?.lines || d?.data || [];
  const w = Math.max(380, ...lines.map((x) => x.length * 13.5 + 48), (d?.title?.length ?? 0) * 13 + 48);
  const h = 50 + 30 * lines.length;
  const top = Math.min(cy + r + 34, BOTTOM - h);
  const ix = Math.max(120, Math.min(1800 - w, cx - w / 2));
  const circle = `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r}`;
  return (
    <g>
      <DrawPath d={circle} p={a} color={th.ink} width={3} />
      <g opacity={b}>
        <line x1={cx - r * 0.82} y1={cy + r * 0.57} x2={ix} y2={top} stroke={th.ink} strokeWidth={2} />
        <line x1={cx + r * 0.82} y1={cy + r * 0.57} x2={ix + w} y2={top} stroke={th.ink} strokeWidth={2} />
        <rect x={ix} y={top} width={w} height={h} rx={16} fill={th.surface} stroke={th.ink} strokeWidth={3} />
        <text x={ix + 24} y={top + 36} fontSize={24} fontFamily={th.font.text} fontWeight={th.weight.strong} fill={th.ink}>{d?.title}</text>
        {lines.map((ln, k) => (
          <text key={k} x={ix + 24} y={top + 68 + 30 * k} fontSize={22} fontFamily={th.font.data} fontWeight={500} fill={th.ink}>{ln}</text>
        ))}
      </g>
    </g>
  );
};

/** One layer of the diagram at scene time t (the previous scene's layer is drawn frozen at its end). */
const Layer = ({ L, t, dur, th, xs, live }: { L: L; t: number; dur: number; th: Theme; xs: number[]; live: boolean }) => {
  const K = L.K;
  const g = useGlyphs();
  const steps = L.steps;
  const ats = steps.map((s: Any, i: number) => atOf(s, i, steps.length, dur));
  const actorAts = L.actors.map((a: Any) => (typeof a?.at === 'number' ? a.at : -1));
  const events = [...ats, ...actorAts.filter((x: number) => x >= 0)].sort((a, b) => a - b);
  const backOf = (a: number) => {
    const nx = events.find((e) => e > a + 0.05);
    return nx === undefined ? 0 : prog(t, nx, DUR.settle, EASE.move);
  };
  const inkAt = (back: number, base = th.ink) => interpolateColors(clamp01(back), [0, 1], [base, th.back]);
  const xOf = (name: string) => xs[Math.max(0, L.names.indexOf(name))];
  const xw = L.watch >= 0 ? xs[L.watch] : null;
  const laneL = xw !== null ? xw - 240 : 0;
  const laneR = xw !== null ? xw + 240 : 0;
  const under: React.ReactElement[] = [];
  const over: React.ReactElement[] = [];

  steps.forEach((s: Any, i: number) => {
    const y = L.rowY(L.rows[i]);
    const back = backOf(ats[i]);
    const ink = inkAt(back);
    if (s?.from) {
      const xa = xOf(s.from);
      const xb = xOf(s.to);
      const dir = Math.sign(xb - xa) || 1;
      const x1 = xa + dir * 14;
      const x2 = xb - dir * 14;
      const p = prog(t, ats[i], DUR.draw, EASE.move);
      const lab = prog(t, ats[i] + 0.1, DUR.enter);
      const sT = clamp01((t - (ats[i] + 0.12)) / DUR.travel);
      const sealed = !!s.sealed;
      const both = !!s.both;
      const rest = K.chipR + 18;
      const px0 = x1 + dir * 30;
      const px1 = x2 - dir * rest;
      const tip = x1 + (x2 - x1) * p;
      const lo = Math.min(x1, tip);
      const hi = Math.max(x1, tip);
      const dash = s.dashed || s.reply ? `${K.arrowW * 4} ${K.arrowW * 2.7}` : undefined;
      const lineCol = sealed && th.look === 'stage' ? inkAt(back, th.paint.sealed) : ink;
      under.push(
        <g key={`m${i}`}>
          {p > 0 ? <line x1={lo} x2={hi} y1={y} y2={y} stroke={lineCol} strokeWidth={K.arrowW} strokeLinecap="round" strokeDasharray={dash} /> : null}
          {p > 0 && K.lane === 'street' && xw !== null && hi > laneL && lo < laneR ? (
            <line x1={Math.max(lo, laneL)} x2={Math.min(hi, laneR)} y1={y} y2={y} stroke={th.onLane} strokeWidth={K.arrowW} strokeDasharray={dash} />
          ) : null}
          <Head x={x2} y={y} dir={dir} color={lineCol} K={K} on={clamp01((p - 0.85) / 0.15)} />
          {both ? <Head x={x1} y={y} dir={-dir} color={lineCol} K={K} on={clamp01((p - 0.85) / 0.15)} /> : null}
        </g>,
      );
      // label: near the sender (plate, stage) or at the start of the public lane (ground)
      const label = String(s.label ?? '');
      const lsize = fit(label, K.label, 20);
      const onLaneLabel = K.labelAt === 'lane' && xw !== null;
      const lx = onLaneLabel ? laneL + 24 : dir > 0 ? xa + 32 : xa - 32;
      const anchor = onLaneLabel || dir > 0 ? 'start' : 'end';
      const lcol = onLaneLabel ? interpolateColors(clamp01(back), [0, 1], [th.onLane!, '#A7A398']) : ink;
      const lockW = sealed && g.lock && th.look !== 'ground' ? lsize * 1.25 : 0;
      over.push(
        <g key={`l${i}`} opacity={lab}>
          {lockW ? (
            <Glyph icon={g.lock} size={lsize * 0.95} color={lcol} x={anchor === 'start' ? lx : lx - textW(label, lsize, true) - lockW} y={y - 16 - lsize * 0.95} />
          ) : null}
          <text x={anchor === 'start' ? lx + lockW : lx} y={y - 16} textAnchor={anchor} fontSize={lsize}
            fontFamily={th.font.text} fontWeight={th.weight.strong} fill={lcol}>{label}</text>
        </g>,
      );
      // payload travelling, then at rest just before the head (a two-way message sends one each way)
      const payload = (key: string, x: number) => (
        <g key={key} transform={`translate(${x} ${y})`}>
          {sealed && !s.swatch ? <Packet th={th} lock={g['lock-fill'] ?? g.lock} envelope={g.envelope} /> : null}
          {sealed && s.icon ? <Glyph icon={s.icon} size={34} color={th.ink} x={dir > 0 ? -82 : 48} y={-17} /> : null}
          {s.swatch ? <Swatch c={colour(th, s.swatch)} r={K.chipR} th={th} /> : null}
          {s.icon && !sealed ? (
            <g>
              {th.look === 'plate' ? <rect x={s.swatch ? K.chipR + 6 : -26} y={-26} width={52} height={52} fill={th.bg} /> : null}
              <Glyph icon={s.icon} size={44} color={ink} x={s.swatch ? K.chipR + 10 : -22} y={-22} />
            </g>
          ) : null}
        </g>
      );
      if (sT > 0) {
        over.push(payload(`p${i}`, travelX(px0, px1, sT)));
        if (both) over.push(payload(`q${i}`, travelX(x2 - dir * 30, x1 + dir * rest, sT)));
      }
      // the public lane keeps a copy of whatever crosses it
      if (xw !== null && (xw - x1) * (xw - x2) < 0 && (s.swatch || s.icon || sealed)) {
        const tw = ats[i] + 0.12 + passTime(px0, px1, xw) * DUR.travel;
        const c = prog(t, tw, 0.3, EASE.enter);
        if (c > 0) {
          const at = copyAt(K, xw, y);
          const name = typeof s.swatch === 'string' && !s.swatch.startsWith('#') ? cap(s.swatch) : '';
          over.push(
            <g key={`c${i}`} opacity={c}>
              {K.copy === 'takeoff' ? (
                <g>
                  <circle cx={xw} cy={y} r={6} fill={th.ink} />
                  <line x1={xw} y1={y} x2={xw} y2={at.y - K.copyR} stroke={th.ink} strokeWidth={2} />
                </g>
              ) : K.copy === 'tap' ? (
                <line x1={xw} y1={y + 6} x2={xw} y2={y + 22} stroke={th.roles.a} strokeWidth={2} strokeDasharray="4 3" />
              ) : null}
              <g transform={`translate(${at.x} ${at.y}) scale(${0.75 + 0.25 * c})`}>
                {sealed ? (
                  K.copy === 'takeoff' ? <Packet th={th} lock={g['lock-fill'] ?? g.lock} scale={0.8} /> : <Scrambled seed={i} th={th} />
                ) : s.swatch ? (
                  <Swatch c={colour(th, s.swatch)} r={K.copyR} th={th} print />
                ) : s.icon ? (
                  <Glyph icon={s.icon} size={34} color={K.lane === 'street' ? th.onLane : th.ink} x={-17} y={-17} />
                ) : null}
              </g>
              {name ? (
                <text x={at.x + K.copyR + 12} y={at.y + 10} fontSize={26} fontFamily={th.font.text} fontWeight={th.weight.text}
                  fill={K.lane === 'street' ? th.onLane : th.ink}>{name}</text>
              ) : null}
            </g>,
          );
          if (s.detail && th.look === 'plate') {
            const dat = typeof s.detail.at === 'number' ? s.detail.at : ats[i] + 2;
            over.push(<Lens key={`d${i}`} cx={at.x} cy={at.y} r={K.copyR + 15} d={s.detail} t={t} at={dat} th={th} />);
          }
        }
      }
      return;
    }
    // a note: chips (a swatch, or a mix "a + b = c"), an icon, a few words
    const names = listOf(s?.over, L.names);
    const oxs = names.map(xOf);
    const mix: string[] = Array.isArray(s?.mix) ? s.mix : [];
    const chips: string[] = mix.length ? [...mix, s.swatch].filter(Boolean) : s?.swatch ? [s.swatch] : [];
    const role = s?.role ?? (names.length === L.names.length ? 'public' : s?.icon || /same|shared/i.test(String(s?.note ?? '')) ? 'shared' : 'private');
    const text = String(s?.note ?? '');
    const tsize = fit(text, K.noteText, 26);
    const rOp = K.chipR * 0.85;
    const rRes = K.chipR * 1.05;
    const chipsW = chips.reduce((a, _c, k) => a + 2 * (mix.length && k === chips.length - 1 ? rRes : rOp) + (k ? 40 : 0), 0);
    const iconW = s?.icon ? 46 : 0;
    const contentW = chipsW + (chips.length && (iconW || text) ? 16 : 0) + iconW + (iconW && text ? 12 : 0) + (text ? textW(text, tsize, true) : 0);
    const h = Math.min(L.rowH(L.rows[i]) - 24, 64); // clear of the label of the message row below
    const single = names.length === 1;
    const w = Math.max(contentW + 48, single ? 0 : Math.max(...oxs) - Math.min(...oxs) + 200);
    let x0: number;
    if (single && K.lane === 'street' && xw !== null) {
      const xa = oxs[0];
      x0 = xa < xw ? xa - 40 - w : xa + 40;
    } else x0 = (Math.max(...oxs) + Math.min(...oxs)) / 2 - w / 2;
    const e = prog(t, ats[i], DUR.enter);
    let cx = x0 + (w - contentW) / 2;
    const parts: React.ReactElement[] = [];
    chips.forEach((c, k) => {
      const res = mix.length > 0 && k === chips.length - 1;
      const r = res ? rRes : rOp;
      if (k > 0) {
        parts.push(
          <text key={`o${k}`} x={cx + 20} y={y + 11} textAnchor="middle" fontSize={34} fontFamily={th.font.text} fontWeight={th.weight.text} fill={ink}>
            {res ? '=' : '+'}
          </text>,
        );
        cx += 40;
      }
      parts.push(<g key={`s${k}`} transform={`translate(${cx + r} ${y})`}><Swatch c={colour(th, c)} r={r} th={th} /></g>);
      cx += 2 * r;
    });
    if (s?.icon) {
      cx += chips.length ? 16 : 0;
      parts.push(<Glyph key="ic" icon={s.icon} size={40} color={ink} x={cx} y={y - 20} />);
      cx += 46;
    }
    if (text) {
      cx += chips.length || s?.icon ? 12 : 0;
      parts.push(<text key="t" x={cx} y={y + 10} fontSize={tsize} fontFamily={th.font.text} fontWeight={th.weight.strong} fill={ink}>{text}</text>);
    }
    const mid = x0 + w / 2;
    under.push(
      <g key={`n${i}`} opacity={e} transform={`translate(${mid} ${y}) scale(${0.97 + 0.03 * e}) translate(${-mid} ${-y})`}>
        <NoteBox x={x0} y={y - h / 2} w={w} h={h} th={th} role={role} />
        {parts}
      </g>,
    );
  });

  return (
    <g>
      {under}
      {over}
    </g>
  );
};

/** The stage look's shutter band: one flat band over whatever is being spoken about, moving on each cue. */
const Band = ({ L, t, dur, th, xs }: { L: L; t: number; dur: number; th: Theme; xs: number[] }) => {
  if (th.look !== 'stage') return null;
  const ats = L.steps.map((s: Any, i: number) => atOf(s, i, L.steps.length, dur));
  const actorAts = L.actors.map((a: Any) => (typeof a?.at === 'number' ? a.at : -1));
  const events = [...ats, ...actorAts.filter((x: number) => x >= 0)].sort((a, b) => a - b);
  if (!events.length) return null;
  const rect = (e: number) => {
    const ai = actorAts.findIndex((a: number) => Math.abs(a - e) < 1e-6);
    if (ai >= 0) return [xs[ai] - 270, L.lifeTop, 540, BOTTOM - L.lifeTop];
    const si = ats.findIndex((a: number) => Math.abs(a - e) < 1e-6);
    const k = L.rows[si];
    return [96, L.rowY(k) - (L.rowKind[k] === 'msg' ? 0.47 : 0.5) * L.rowH(k) + 2, 1728, L.rowH(k) - 4];
  };
  let k = -1;
  events.forEach((e, i) => {
    if (e <= t) k = i;
  });
  if (k < 0) return null;
  const cur = rect(events[k]);
  const prev = k > 0 ? rect(events[k - 1]) : cur;
  const p = prog(t, events[k], DUR.morph, EASE.move);
  const [x, y, w, h] = cur.map((c, j) => lerp(prev[j], c, p));
  return <rect x={x} y={y} width={w} height={h} fill={th.lit} opacity={k === 0 ? prog(t, events[0], DUR.enter) : 1} />;
};

/** Lanes, lifelines and heads: the part that persists across a continuity cut. */
const Frame = ({ L, xs, th, t, enterAt, focusBack }: { L: L; xs: number[]; th: Theme; t: number; enterAt: (i: number) => number; focusBack: number[] }) => {
  const K = L.K;
  const xw = L.watch >= 0 ? xs[L.watch] : null;
  return (
    <>
      {xw !== null && K.lane === 'band' ? <rect x={xw - 240} y={L.headTop - 8} width={480} height={BOTTOM - L.headTop + 8} rx={20} fill={th.lane} /> : null}
      {xw !== null && K.lane === 'street' ? <rect x={xw - 240} y={72} width={480} height={870 - 72} fill={th.lane} /> : null}
      {L.actors.map((a: Any, i: number) => {
        if (a?.watch && K.watchLife === 'none') return null;
        const pub = a?.watch && K.watchLife === 'dash-public';
        return (
          <line key={`life${i}`} x1={xs[i]} x2={xs[i]} y1={L.lifeTop} y2={BOTTOM} stroke={pub ? th.roles.a : th.line}
            strokeWidth={K.life.w} strokeDasharray={pub ? '12 10' : K.life.dash} opacity={enterAt(i) < 0 ? 1 : prog(t, enterAt(i), DUR.enter)} />
        );
      })}
      {L.actors.map((a: Any, i: number) => {
        const e = enterAt(i) < 0 ? 1 : prog(t, enterAt(i), DUR.enter);
        const name = nameOf(a);
        const size = fit(name, K.name, 16);
        const onLane = a?.watch && K.lane === 'street';
        const baseCol = onLane ? th.onLane! : a?.watch && th.look === 'stage' ? th.roles.a : th.ink;
        const col = interpolateColors(clamp01(focusBack[i]), [0, 1], [baseCol, th.back]);
        const w = textW(name, size, true) + (a.icon ? K.icon + 14 : 0) + (K.head === 'box' ? 44 : 0);
        let left = xs[i] - w / 2;
        if (K.head === 'field') left = i === 0 ? 120 : a?.watch && xw !== null ? xw - 208 : xs[i] - 48;
        const top = L.headTop;
        return (
          <g key={`h${i}`} opacity={e} transform={`translate(0 ${(1 - e) * 14})`}>
            {K.head === 'box' ? (
              <rect x={left} y={top} width={w} height={K.headH} rx={th.radius} fill={th.surface} stroke={col} strokeWidth={3}
                strokeDasharray={a?.watch ? '10 8' : undefined} />
            ) : null}
            {a.icon ? <Glyph icon={a.icon} size={K.icon} color={col} x={left + (K.head === 'box' ? 22 : 0)} y={top + (K.headH - K.icon) / 2} /> : null}
            <text x={left + (K.head === 'box' ? 22 : 0) + (a.icon ? K.icon + 14 : 0)} y={top + K.headH / 2 + size * 0.47} fontSize={size}
              fontFamily={th.font.text} fontWeight={th.weight.strong} fill={col}>{name}</text>
          </g>
        );
      })}
    </>
  );
};

export const Sequence = ({ v, dur, prev }: { v: Any; dur: number; prev?: { v: Any; dur: number } | null }) => {
  const th = useTheme();
  const t = useClock();
  const L = seqLayout(v, th);
  const P = prev?.v ? seqLayout(prev.v, th) : null;
  const shared = P ? L.names.filter((n) => P.names.includes(n)) : [];
  const glide = prog(t, 0, DUR.morph, EASE.move);
  const xs = L.xs.map((x, i) => (P && P.names.includes(L.names[i]) ? lerp(P.xs[P.names.indexOf(L.names[i])], x, glide) : x));
  const fadeOld = 1 - prog(t, 0.05, DUR.exit, EASE.exit);
  const enterAt = (i: number) => (P && shared.includes(L.names[i]) ? -1 : -0.5 + i * DUR.stagger); // arrive during the cut
  const actorAts = L.actors.map((a: Any) => (typeof a?.at === 'number' ? a.at : -1));
  const focusBack = L.actors.map((_: Any, i: number) =>
    Math.max(0, ...actorAts.map((a: number, j: number) => (j !== i && a >= 0 ? prog(t, a, DUR.settle, EASE.move) : 0))));
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {v?.title ? (
        <div style={{ position: 'absolute', left: 110, top: 96, fontFamily: th.font.display, fontWeight: th.weight.display,
          fontSize: fit(v.title, 50, 40), color: th.ink, opacity: prog(t, 0, DUR.enter) }}>{v.title}</div>
      ) : null}
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <Band L={L} t={t} dur={dur} th={th} xs={xs} />
        <Frame L={L} xs={xs} th={th} t={t} enterAt={enterAt} focusBack={focusBack} />
        {P && fadeOld > 0 ? (
          <g opacity={fadeOld}>
            <Layer L={P} t={prev!.dur} dur={prev!.dur} th={th} xs={P.xs} live={false} />
          </g>
        ) : null}
        <Layer L={L} t={t} dur={dur} th={th} xs={xs} live />
      </svg>
    </div>
  );
};
