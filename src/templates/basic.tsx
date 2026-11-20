/**
 * @file basic.tsx
 * @description The general templates, rewritten for v0.2 on theme tokens and the motion language: title, points,
 *   compare, stat, quote, code, image, svg, timeline, chart. Text is left-aligned to the content edge (never
 *   everything centred), sentence case, no labels above titles, no count-ups on static numbers, no colour cycling:
 *   one ink, and the item being spoken about stays in full ink while earlier ones step back.
 */
import React from 'react';
import { Img, staticFile } from 'remotion';
import { AREA, colour, fit, useTheme } from '../theme';
import { DUR, EASE, atOf, clamp01, lerp, prog, useClock } from '../motion';
import { DrawPath, Glyph } from '../draw';
import { useGlyphs } from '../glyphs';
import { Any, Mark, Plate, SceneTitle, fitSize, inkOf, plateStyle, rise, txt, useReveal } from './common';

type P = { v: Any; dur: number };
const L0 = AREA.side;
const W = 1920 - 2 * AREA.side;
const top = (v: Any) => (v?.title ? 210 : 150);

export const TitleScene = ({ v }: P) => {
  const th = useTheme();
  const t = useClock();
  const g = useGlyphs();
  const icon = v.icon ?? g.motif;
  const size = fitSize(th, String(v.title ?? ''), icon || v.image ? 1240 : 1560, 116);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: L0, top: 330, width: icon || v.image ? 1260 : 1600 }}>
        <div style={{ ...rise(prog(t, 0.15, DUR.enter)), fontFamily: th.font.display, fontWeight: th.weight.display, fontSize: size, lineHeight: 1.06, color: th.ink }}>
          {v.title}
        </div>
        {v.subtitle ? (
          <div style={{ ...rise(prog(t, 0.4, DUR.enter)), marginTop: 30, fontSize: fit(v.subtitle, 46, 50), fontWeight: th.weight.text, color: th.ink2, lineHeight: 1.25 }}>
            {v.subtitle}
          </div>
        ) : null}
        {v.kicker ? (
          <div style={{ ...rise(prog(t, 0.6, DUR.enter)), marginTop: 18, fontSize: 32, fontWeight: th.weight.text, color: th.ink2 }}>{v.kicker}</div>
        ) : null}
      </div>
      {icon || v.image ? (
        <div style={{ position: 'absolute', right: L0 + 20, top: 300, width: 330, height: 330, display: 'flex', alignItems: 'center', justifyContent: 'center',
          ...plateStyle(th), ...rise(prog(t, 0.3, DUR.enter)) }}>
          <Mark icon={icon} image={v.image} size={200} />
        </div>
      ) : null}
    </div>
  );
};

/** A small marker for an unordered item: a square in the look's ink (a real list has no numbers). */
const Marker = ({ col, size = 16 }: { col: string; size?: number }) => {
  const th = useTheme();
  return <div style={{ width: size, height: size, flex: 'none', background: col, borderRadius: th.look === 'stage' ? size : 2 }} />;
};

export const Points = ({ v, dur }: P) => {
  const th = useTheme();
  const t = useClock();
  const items: Any[] = v.items || [];
  const rv = useReveal(items, dur, t);
  const n = Math.max(1, items.length);
  const gap = Math.min(128, 600 / n);
  const size = n > 4 ? 42 : 48;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <SceneTitle text={v.title} t={t} />
      <div style={{ position: 'absolute', left: L0, top: Math.max(top(v) + 20, (860 + top(v) - n * gap) / 2), width: W, display: 'flex', flexDirection: 'column', gap: gap - size }}>
        {items.map((it, i) => {
          const col = inkOf(th, rv[i].back);
          return (
            <div key={i} style={{ ...rise(rv[i].shown, 18), display: 'flex', alignItems: 'center', gap: 28, minHeight: size * 1.3 }}>
              {v.ordered ? (
                <div style={{ width: 54, flex: 'none', fontFamily: th.font.display, fontWeight: th.weight.display, fontSize: size, color: col }}>{i + 1}</div>
              ) : it?.icon || it?.image ? (
                <Mark icon={it.icon} image={it.image} size={size * 1.15} color={col} />
              ) : it?.swatch ? (
                <svg width={size} height={size} style={{ flex: 'none' }}>
                  <circle cx={size / 2} cy={size / 2} r={size / 2 - 3} fill={colour(th, it.swatch)} stroke={th.ink} strokeWidth={3} />
                </svg>
              ) : (
                <Marker col={col} />
              )}
              <div style={{ fontSize: fit(txt(it), size, 52), fontWeight: th.weight.text, lineHeight: 1.25, color: col }}>{txt(it)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const Compare = ({ v, dur }: P) => {
  const th = useTheme();
  const t = useClock();
  const sides = [v.left || {}, v.right || {}];
  // one focus order across both columns: left's items, then right's
  const flat: Any[] = [];
  sides.forEach((s, k) => (s.items || []).forEach((it: Any) => flat.push({ ...(typeof it === 'string' ? { text: it } : it), side: k })));
  const headAt = [typeof sides[0].at === 'number' ? sides[0].at : 0.2, typeof sides[1].at === 'number' ? sides[1].at : Math.min(dur * 0.45, 4)];
  const rv = useReveal(flat.map((it, i) => (typeof it.at === 'number' ? it : { ...it, at: headAt[it.side] + 0.4 + 0.5 * i })), dur, t);
  const colW = (W - 80) / 2;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <SceneTitle text={v.title} t={t} />
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <line x1={960} x2={960} y1={top(v)} y2={850} stroke={th.line} strokeWidth={2} strokeDasharray={th.look === 'plate' ? '8 8' : undefined}
          opacity={prog(t, headAt[1] - 0.2, DUR.enter)} />
      </svg>
      {sides.map((s, k) => (
        <div key={k} style={{ position: 'absolute', left: L0 + k * (colW + 80), top: top(v), width: colW, ...rise(prog(t, headAt[k], DUR.enter)) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 34 }}>
            <Mark icon={s.icon} image={s.image} size={64} />
            <div style={{ fontFamily: th.font.display, fontWeight: th.weight.display, fontSize: fit(s.title, 52, 18), color: th.ink }}>{s.title}</div>
          </div>
          {flat.map((it, i) =>
            it.side !== k ? null : (
              <div key={i} style={{ ...rise(rv[i].shown, 14), display: 'flex', gap: 22, alignItems: 'baseline', margin: '0 0 26px', color: inkOf(th, rv[i].back) }}>
                <div style={{ transform: 'translateY(-6px)' }}><Marker col={inkOf(th, rv[i].back)} size={14} /></div>
                <div style={{ fontSize: fit(it.text, 40, 34), lineHeight: 1.3, fontWeight: th.weight.text }}>{it.text}</div>
              </div>
            ),
          )}
        </div>
      ))}
    </div>
  );
};

/** One number as a label and value, read at once. It does not count up: the number is not being computed. */
export const Stat = ({ v }: P) => {
  const th = useTheme();
  const t = useClock();
  const value = `${v.prefix ?? ''}${v.value ?? ''}${v.suffix ?? ''}`;
  return (
    <div style={{ position: 'absolute', left: L0, top: 300, width: W }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 40, ...rise(prog(t, 0.15, DUR.enter)) }}>
        <div style={{ fontFamily: th.font.display, fontWeight: th.weight.display, fontSize: fit(value, 200, 6), lineHeight: 1, color: th.ink, fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </div>
        <div style={{ fontSize: fit(v.label, 56, 30), fontWeight: th.weight.strong, color: th.ink }}>{v.label}</div>
      </div>
      {v.sub ? <div style={{ ...rise(prog(t, 0.6, DUR.enter)), marginTop: 34, fontSize: 40, color: th.ink2 }}>{v.sub}</div> : null}
    </div>
  );
};

export const Quote = ({ v }: P) => {
  const th = useTheme();
  const t = useClock();
  return (
    <div style={{ position: 'absolute', left: L0, top: 250, width: 1500, display: 'flex', gap: 48 }}>
      {v.icon || v.image ? <div style={rise(prog(t, 0.1, DUR.enter))}><Mark icon={v.icon} image={v.image} size={110} /></div> : null}
      <div>
        {v.term ? (
          <div style={{ ...rise(prog(t, 0.1, DUR.enter)), fontFamily: th.font.display, fontWeight: th.weight.display, fontSize: 72, lineHeight: 1.1, color: th.ink, marginBottom: 30 }}>{v.term}</div>
        ) : null}
        <div style={{ ...rise(prog(t, 0.3, DUR.enter)), fontFamily: th.font.text, fontWeight: th.weight.text, fontSize: fit(v.text, v.term ? 52 : 68, 60), lineHeight: 1.25, color: th.ink }}>
          {v.text}
        </div>
        {v.by ? <div style={{ ...rise(prog(t, 0.8, DUR.enter)), marginTop: 28, fontSize: 34, color: th.ink2 }}>{v.by}</div> : null}
      </div>
    </div>
  );
};

export const Code = ({ v, dur }: P) => {
  const th = useTheme();
  const t = useClock();
  const lines: string[] = String(v.code || '').replace(/\t/g, '  ').split('\n');
  const hl: number[] = v.highlight || [];
  const longest = lines.reduce((a, b) => (a.length > b.length ? a : b), '');
  const size = Math.min(fit(longest, 42, 56), 520 / (lines.length * 1.5));
  const hp = prog(t, typeof v.at === 'number' ? v.at : dur * 0.45, DUR.micro * 2, EASE.move);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <SceneTitle text={v.title} t={t} />
      <Plate style={{ position: 'absolute', left: L0, top: Math.max(top(v), (860 + top(v) - lines.length * size * 1.5 - 48) / 2), maxWidth: W, padding: '24px 0', fontFamily: th.font.data, fontSize: size, lineHeight: 1.5,
        ...rise(prog(t, 0.15, DUR.enter)) }}>
        {lines.map((ln, i) => (
          <div key={i} style={{ display: 'flex', opacity: prog(t, 0.2 + i * DUR.stagger, DUR.enter), padding: '0 36px 0 0',
            background: hl.includes(i + 1) ? `color-mix(in srgb, ${th.lane ?? th.surface} ${Math.round(100 * hp)}%, transparent)` : 'transparent' }}>
            <span style={{ width: size * 2.4, textAlign: 'right', paddingRight: size * 0.9, color: th.back, flex: 'none' }}>{i + 1}</span>
            <span style={{ whiteSpace: 'pre', color: th.ink, fontWeight: hl.includes(i + 1) && hp > 0.5 ? 700 : 500 }}>{ln || ' '}</span>
          </div>
        ))}
      </Plate>
    </div>
  );
};

/** A real picture in a frame, a caption under it like a figure caption, the credit under that. Optional callouts:
 *  boxes on parts of the figure ([x, y, w, h] as fractions of the picture) with a label, each on its cue. */
export const ImageScene = ({ v, dur }: P) => {
  const th = useTheme();
  const t = useClock();
  const img = v.image;
  // with the picture's aspect given, the frame takes its shape, so callout fractions land on the picture itself
  const maxH = v.caption ? 560 : 640;
  const asp = Number(v.aspect) || 0;
  const boxW = asp ? Math.min(1500, maxH * asp) : 1500;
  const boxH = asp ? Math.min(maxH, 1500 / asp) : maxH;
  const calls: Any[] = v.callouts || [];
  const rv = useReveal(calls, dur, t);
  const z = v.zoom === true ? 1 + 0.05 * clamp01(t / Math.max(1, dur)) : 1;
  // camera: with callouts, glide into each one as it is named (fill about 80% of the frame), pull back at the end
  const shotOf = (k: number) => {
    if (k < 0) return { s: 1, cx: 0.5, cy: 0.5 };
    const [bx, by, bw, bh] = calls[k].box || [0, 0, 1, 1];
    const s = Math.max(1, Math.min(2.4, 0.8 / Math.max(bw, (bh * boxH) / boxW, 0.05), 0.8 / Math.max(bh, 0.05)));
    return { s, cx: bx + bw / 2, cy: by + bh / 2 };
  };
  let cam = { s: 1, cx: 0.5, cy: 0.5 };
  if (calls.length && v.follow !== false) {
    let k = -1;
    rv.forEach((r, i) => {
      if (r.at <= t) k = i;
    });
    if (k >= 0) {
      const a = shotOf(k - 1);
      const b = shotOf(k);
      const p = prog(t, rv[k].at, DUR.camera, EASE.move);
      cam = { s: lerp(a.s, b.s, p), cx: lerp(a.cx, b.cx, p), cy: lerp(a.cy, b.cy, p) };
    }
    const back = prog(t, dur - 1.8, DUR.camera, EASE.move);
    cam = { s: lerp(cam.s, 1, back), cx: lerp(cam.cx, 0.5, back), cy: lerp(cam.cy, 0.5, back) };
  }
  // keep the picture covering the frame while zoomed
  const half = 0.5 / cam.s;
  const ccx = Math.min(1 - half, Math.max(half, cam.cx));
  const ccy = Math.min(1 - half, Math.max(half, cam.cy));
  const camT = `translate(${boxW / 2 - ccx * boxW * cam.s}px, ${boxH / 2 - ccy * boxH * cam.s}px) scale(${cam.s})`;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <SceneTitle text={v.title} t={t} />
      <div style={{ position: 'absolute', left: L0, top: top(v) - (v.title ? 0 : 20), ...rise(prog(t, 0.05, DUR.enter), 12) }}>
        {img?.src ? (
          <div style={{ ...plateStyle(th), padding: 12, display: 'inline-block' }}>
            <div style={{ position: 'relative', width: boxW, height: boxH, overflow: 'hidden', background: th.bg }}>
              <div style={{ position: 'absolute', left: 0, top: 0, width: boxW, height: boxH, transformOrigin: '0 0', transform: camT }}>
              <Img src={staticFile(img.src)} style={{ width: '100%', height: '100%', objectFit: v.fit === 'cover' ? 'cover' : 'contain', transform: `scale(${z})` }} />
              <svg width={boxW} height={boxH} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
                {calls.map((c, i) => {
                  const [x, y, w, h] = (c.box || [0, 0, 0, 0]).map((q: number, k: number) => q * (k % 2 ? boxH : boxW));
                  const d = `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
                  const ly = v.follow === false && y - 48 >= 4 ? y - 48 : y + 8; // inside the box when the camera follows it
                  const ls = 1 / Math.max(1, cam.s * 0.75); // labels stay about the same size while the camera zooms
                  return (
                    <g key={i}>
                      {/* two tones, so the box reads on a dark screenshot and on a white drawing alike */}
                      <DrawPath d={d} p={prog(t, rv[i].at, DUR.draw, EASE.move)} color={th.surface} width={9} />
                      <DrawPath d={d} p={prog(t, rv[i].at, DUR.draw, EASE.move)} color={th.paint.callout ?? th.ink} width={4} />
                      <g opacity={prog(t, rv[i].at + 0.3, DUR.enter)} transform={`translate(${x} ${ly}) scale(${ls})`}>
                        <rect x={0} y={0} width={txt(c).length * 15 + 28} height={40} fill={th.surface} stroke={th.ink} strokeWidth={2} rx={6} />
                        <text x={14} y={28} fontSize={26} fontFamily={th.font.text} fontWeight={th.weight.strong} fill={th.ink}>{txt(c)}</text>
                      </g>
                    </g>
                  );
                })}
              </svg>
              </div>
            </div>
          </div>
        ) : (
          <Mark icon={v.icon} size={260} />
        )}
        {v.caption ? <div style={{ ...rise(prog(t, 0.5, DUR.enter)), marginTop: 18, fontSize: fit(v.caption, 38, 70), color: th.ink }}>{v.caption}</div> : null}
        {img?.credit ? <div style={{ marginTop: 6, fontSize: 26, color: th.ink2 }}>{img.credit}</div> : null}
      </div>
    </div>
  );
};

export const Svg = ({ v }: P) => {
  const th = useTheme();
  const t = useClock();
  const markup = String(v.svg || '').replace(/<svg(?![^>]*\swidth=)/, '<svg width="100%" height="100%"');
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <SceneTitle text={v.title} t={t} />
      <div style={{ position: 'absolute', left: L0, top: top(v), width: v.width || 1400, height: v.height || 520, ...rise(prog(t, 0.15, DUR.enter)) }}
        dangerouslySetInnerHTML={{ __html: markup }} />
      {v.caption ? (
        <div style={{ position: 'absolute', left: L0, top: top(v) + (v.height || 520) + 20, ...rise(prog(t, 0.6, DUR.enter)), fontSize: fit(v.caption, 38, 70), color: th.ink2 }}>
          {v.caption}
        </div>
      ) : null}
    </div>
  );
};

/** Time drawn as an axis: the line extends to each event as it is spoken (real years sit at their real distance). */
export const Timeline = ({ v, dur }: P) => {
  const th = useTheme();
  const t = useClock();
  const items: Any[] = v.items || [];
  const rv = useReveal(items, dur, t);
  const years = items.map((it) => parseFloat(String(it.when ?? it.date ?? '')));
  const numeric = years.every((y) => Number.isFinite(y));
  const x0 = 200;
  const x1 = 1720;
  const lo = Math.min(...years);
  const hi = Math.max(...years);
  const xs = items.map((_, i) => (numeric && hi > lo ? lerp(x0, x1, (years[i] - lo) / (hi - lo)) : items.length <= 1 ? 960 : lerp(x0, x1, i / (items.length - 1))));
  const y = 520;
  let reach = x0 - 60;
  items.forEach((_, i) => {
    const p = prog(t, rv[i].at - 0.3, DUR.draw, EASE.move);
    if (p > 0) reach = lerp(i ? xs[i - 1] : x0 - 60, xs[i], p);
  });
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <SceneTitle text={v.title} t={t} />
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <line x1={x0 - 60} x2={x1 + 60} y1={y} y2={y} stroke={th.line} strokeWidth={2} strokeDasharray="8 8" />
        <line x1={x0 - 60} x2={reach} y1={y} y2={y} stroke={th.ink} strokeWidth={4} strokeLinecap="round" />
        {items.map((_, i) => (
          <circle key={i} cx={xs[i]} cy={y} r={11} fill={inkOf(th, rv[i].back)} opacity={rv[i].shown} />
        ))}
      </svg>
      {items.map((it, i) => {
        const up = i % 2 === 0;
        return (
          <div key={i} style={{ position: 'absolute', left: xs[i] - 12, width: Math.min(340, (x1 - x0) / Math.max(1, items.length - 1) * 2 - 30),
            ...(up ? { bottom: 1080 - y + 30 } : { top: y + 30 }), ...rise(rv[i].shown, up ? -14 : 14), color: inkOf(th, rv[i].back) }}>
            <div style={{ fontFamily: th.font.display, fontWeight: th.weight.display, fontSize: fit(String(it.when ?? it.date ?? ''), 46, 10), lineHeight: 1.1 }}>{it.when ?? it.date}</div>
            <div style={{ fontSize: fit(it.label, 30, 26), lineHeight: 1.25, marginTop: 4 }}>{it.label}</div>
          </div>
        );
      })}
    </div>
  );
};

/** Quantities as bars with direct labels. A bar grows when it is spoken; its value is printed whole (no count-up). */
export const Chart = ({ v, dur }: P) => {
  const th = useTheme();
  const t = useClock();
  const items: Any[] = v.items || [];
  const rv = useReveal(items, dur, t);
  const max = Math.max(1e-9, ...items.map((it) => Number(it.value) || 0));
  const barH = Math.min(78, 460 / Math.max(1, items.length));
  const x0 = 560;
  const span = 1000;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <SceneTitle text={v.title} t={t} />
      {items.map((it, i) => {
        const val = Number(it.value) || 0;
        const g = prog(t, rv[i].at, DUR.draw, EASE.move);
        const y = Math.max(top(v) + 30, (860 + top(v) - items.length * barH * 1.55) / 2) + i * barH * 1.55;
        const col = inkOf(th, rv[i].back);
        return (
          <div key={i} style={{ position: 'absolute', left: L0, top: y, width: W, height: barH, opacity: rv[i].shown, color: col }}>
            <div style={{ position: 'absolute', left: 0, width: x0 - L0 - 30, textAlign: 'right', lineHeight: `${barH}px`, fontSize: fit(it.label, 38, 20), fontWeight: th.weight.strong }}>
              {it.label}
            </div>
            <div style={{ position: 'absolute', left: x0 - L0, top: barH * 0.12, height: barH * 0.76, width: Math.max(4, (span * g * Math.max(0, val)) / max),
              background: col, borderRadius: th.look === 'stage' ? 4 : 2 }} />
            <div style={{ position: 'absolute', left: x0 - L0 + (span * g * Math.max(0, val)) / max + 20, lineHeight: `${barH}px`, fontFamily: th.font.data,
              fontSize: 40, fontWeight: 600, opacity: prog(t, rv[i].at + DUR.draw * 0.6, DUR.micro) }}>
              {String(it.value)}
              {v.unit ? <span style={{ fontFamily: th.font.text, fontSize: 30, color: th.ink2 }}> {v.unit}</span> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export { Glyph, atOf };
