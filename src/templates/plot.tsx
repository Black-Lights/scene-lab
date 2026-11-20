/**
 * @file plot.tsx
 * @description `plot`: data drawn on real axes (Tufte and Wilke: direct labels instead of a legend, log axes that
 *   show the original values, annotations at the point). Axes draw first, then each series draws along x at its
 *   cue at a steady speed (it is data being laid down), then its name appears at the end of its line. A series
 *   with "from" morphs out of an earlier series' shape (@remotion/paths interpolatePath): a real change in the data.
 *   Reference lines ("lines") and point notes ("notes") arrive on their cues.
 */
import React from 'react';
import { interpolatePath } from '@remotion/paths';
import { colour, fit, useTheme } from '../theme';
import { DUR, EASE, atOf, clamp01, prog, useClock } from '../motion';
import { DrawPath } from '../draw';
import { Any, SceneTitle, inkOf } from './common';

const SUP: Record<string, string> = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const pow10 = (e: number) => (e === 0 ? '1' : e === 1 ? '10' : `10${String(e).split('').map((c) => SUP[c] ?? c).join('')}`);

const nice = (lo: number, hi: number, n = 5) => {
  const span = hi - lo || 1;
  const step0 = span / n;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? mag * 10;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Number(v.toPrecision(12)));
  return out;
};
const fmt = (v: number) => (Math.abs(v) >= 1e5 || (Math.abs(v) < 1e-3 && v !== 0) ? v.toExponential(0) : v.toLocaleString('en-US', { maximumFractionDigits: 3 }));

export const Plot = ({ v, dur }: { v: Any; dur: number }) => {
  const th = useTheme();
  const t = useClock();
  const series: Any[] = v.series || [];
  const lines: Any[] = v.lines || [];
  const notes: Any[] = v.notes || [];
  const xa = v.x || {};
  const ya = v.y || {};
  const allX = series.flatMap((s: Any) => (s.points || []).map((p: number[]) => p[0]));
  const allY = [...series.flatMap((s: Any) => (s.points || []).map((p: number[]) => p[1])), ...lines.filter((l) => l.y != null).map((l) => l.y)];
  const tf = (log: boolean) => (q: number) => (log ? Math.log10(Math.max(q, 1e-300)) : q);
  const fx = tf(!!xa.log);
  const fy = tf(!!ya.log);
  const xlo = fx(xa.min ?? Math.min(...allX));
  const xhi = fx(xa.max ?? Math.max(...allX));
  const ylo = fy(ya.min ?? (ya.log ? Math.min(...allY) : Math.min(0, ...allY)));
  const yhi = fy(ya.max ?? Math.max(...allY));
  const top = v.title ? 220 : 160;
  const X0 = 300;
  const X1 = 1560;
  const Y0 = top + 20;
  const Y1 = 790;
  const sx = (q: number) => X0 + ((fx(q) - xlo) / (xhi - xlo || 1)) * (X1 - X0);
  const sy = (q: number) => Y1 - ((fy(q) - ylo) / (yhi - ylo || 1)) * (Y1 - Y0);
  const xt: number[] = xa.ticks ?? (xa.log ? Array.from({ length: Math.floor(xhi) - Math.ceil(xlo) + 1 }, (_, k) => 10 ** (Math.ceil(xlo) + k)) : nice(xlo, xhi));
  const ytRaw: number[] = ya.ticks ?? (ya.log ? Array.from({ length: Math.floor(yhi) - Math.ceil(ylo) + 1 }, (_, k) => 10 ** (Math.ceil(ylo) + k)) : nice(ylo, yhi));
  const yt = ytRaw.length > 9 ? ytRaw.filter((_, k) => k % Math.ceil(ytRaw.length / 8) === 0) : ytRaw;
  const ylab = (q: number) => (ya.log ? pow10(Math.round(Math.log10(q))) : fmt(q));
  const xlab = (q: number) => (xa.log ? pow10(Math.round(Math.log10(q))) : fmt(q));
  const axes = prog(t, -0.4, DUR.draw, EASE.move); // the axes are in place as the camera arrives
  const items = [...series, ...lines, ...notes];
  const ats = items.map((it, k) => atOf(it, k, items.length, dur));
  const sorted = [...ats].sort((a, b) => a - b);
  const backOf = (a: number) => {
    const nx = sorted.find((x) => x > a + 0.05);
    return nx === undefined ? 0 : prog(t, nx, DUR.settle, EASE.move);
  };
  const defaults = [th.ink, th.roles.a, th.roles.b, th.paint.orange, th.paint.green];
  const pathOf = (pts: number[][]) => pts.map((p, k) => `${k ? 'L' : 'M'} ${sx(p[0]).toFixed(1)} ${sy(p[1]).toFixed(1)}`).join(' ');
  const resample = (pts: number[][], n: number) => {
    const sorted2 = [...pts].sort((a, b) => a[0] - b[0]);
    return Array.from({ length: n }, (_, k) => sorted2[Math.round((k * (sorted2.length - 1)) / (n - 1))]);
  };
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <SceneTitle text={v.title} t={t} />
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <DrawPath d={`M ${X0} ${Y0 - 10} L ${X0} ${Y1} L ${X1 + 10} ${Y1}`} p={axes} color={th.ink} width={3} />
        {yt.map((q, k) => (
          <g key={`y${k}`} opacity={axes}>
            <line x1={X0 - 12} x2={X0} y1={sy(q)} y2={sy(q)} stroke={th.ink} strokeWidth={2} />
            <text x={X0 - 22} y={sy(q) + 10} textAnchor="end" fontSize={28} fontFamily={th.font.data} fill={th.ink2}>{ylab(q)}</text>
          </g>
        ))}
        {xt.map((q, k) => (
          <g key={`x${k}`} opacity={axes}>
            <line x1={sx(q)} x2={sx(q)} y1={Y1} y2={Y1 + 12} stroke={th.ink} strokeWidth={2} />
            <text x={sx(q)} y={Y1 + 44} textAnchor="middle" fontSize={28} fontFamily={th.font.data} fill={th.ink2}>{xlab(q)}</text>
          </g>
        ))}
        {ya.label ? (
          <text x={X0} y={Y0 - 30} fontSize={30} fontFamily={th.font.text} fontWeight={th.weight.strong} fill={th.ink} opacity={axes}>{ya.label}</text>
        ) : null}
        {xa.label ? (
          <text x={X1} y={Y1 + 44} dx={0} dy={0} textAnchor="end" fontSize={30} fontFamily={th.font.text} fontWeight={th.weight.strong} fill={th.ink} opacity={axes}
            transform={`translate(0 ${42})`}>{xa.label}</text>
        ) : null}
        {lines.map((l: Any, k: number) => {
          const at = ats[series.length + k];
          const p = prog(t, at, DUR.draw, EASE.move);
          const ink = inkOf(th, backOf(at));
          if (l.y == null) return null;
          const y = sy(l.y);
          return (
            <g key={`l${k}`}>
              <DrawPath d={`M ${X0} ${y} L ${X1} ${y}`} p={p} color={ink} width={2} dashed />
              <text x={X0 + 18} y={y - 14} textAnchor="start" fontSize={28} fontFamily={th.font.text} fontWeight={th.weight.strong} fill={ink} opacity={prog(t, at + 0.3, DUR.enter)}>
                {l.label}
              </text>
            </g>
          );
        })}
        {series.map((s: Any, k: number) => {
          const at = ats[k];
          const pts: number[][] = s.points || [];
          if (pts.length < 2) return null;
          const col = s.color ? colour(th, s.color) : defaults[k % defaults.length];
          const back = backOf(at);
          const src = s.from ? series.find((o: Any) => o.label === s.from) : null;
          const own = pathOf(resample(pts, 40));
          let d = pathOf(pts);
          let p = prog(t, at, 1.4, EASE.linear);
          if (src?.points?.length) {
            const m = prog(t, at, DUR.morph, EASE.move);
            d = interpolatePath(m, pathOf(resample(src.points, 40)), own);
            p = 1;
            if (t < at) return null;
          }
          const last = pts[pts.length - 1];
          return (
            <g key={`s${k}`} opacity={1 - 0.45 * back}>
              <DrawPath d={d} p={p} color={col} width={th.look === 'ground' ? 6 : 5} />
              <g opacity={prog(t, at + (src ? DUR.morph : 1.3), DUR.enter)}>
                <line x1={sx(last[0]) + 14} x2={sx(last[0]) + 40} y1={sy(last[1])} y2={sy(last[1])} stroke={col} strokeWidth={5} />
                <text x={sx(last[0]) + 50} y={sy(last[1]) + 10} fontSize={fit(s.label, 32, 16)} fontFamily={th.font.text} fontWeight={th.weight.strong} fill={th.ink}>{s.label}</text>
              </g>
            </g>
          );
        })}
        {notes.map((n: Any, k: number) => {
          const at = ats[series.length + lines.length + k];
          const e = prog(t, at, DUR.enter);
          const x = sx(n.x);
          const y = sy(n.y);
          const dx = n.dx ?? -60;
          const dy = n.dy ?? -70;
          return (
            <g key={`n${k}`} opacity={e}>
              <circle cx={x} cy={y} r={9} fill={th.ink} />
              <line x1={x} y1={y} x2={x + dx} y2={y + dy} stroke={th.ink} strokeWidth={2} />
              <text x={x + dx + (dx < 0 ? -8 : 8)} y={y + dy - 8} textAnchor={dx < 0 ? 'end' : 'start'} fontSize={28} fontFamily={th.font.text}
                fontWeight={th.weight.strong} fill={inkOf(th, backOf(at))}>{n.text}</text>
            </g>
          );
        })}
      </svg>
      {v.source ? (
        <div style={{ position: 'absolute', left: X0, top: Y1 + 92, fontSize: 28, color: th.ink2, opacity: clamp01(axes) }}>{v.source}</div>
      ) : null}
    </div>
  );
};
