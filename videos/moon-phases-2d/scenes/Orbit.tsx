/**
 * @file videos/moon-phases-2d/scenes/Orbit.tsx
 * @description The world of this video ("worlds.orbit" in the spec), seen in scenes 2 to 6: the Moon's orbit from
 *   above the north pole, with the light coming from the left, and beside it a panel with what is seen from the
 *   centre. The same drawing is first a room (a lamp, your head, a ball at arm's length) and then space (sunlight,
 *   Earth, the Moon): the track "sky" cross-fades the one into the other, so the analogy and the mechanism are one
 *   picture. Tracks: "angle" is how far the Moon has gone round since new moon, in degrees; "facing" rings the half
 *   of the Moon that faces Earth; "shadow" draws Earth's shadow; "side" turns the panel into a side view of the
 *   tilted orbit. "tilt" (1 to 0) turns the line where the orbit crosses Earth's plane toward the Sun, as the year
 *   does: the path stays tilted (from the side it opens from a line to a thin ellipse) and the full moon comes to
 *   lie where the path crosses the shadow, which is an eclipse. The phase under the disc is named only when the
 *   disc shows it: new, half and full within a few degrees, a crescent or gibbous Moon between them.
 *   A scene whose props hold a "definition" ({term, text}) writes it under the drawing on its beat "def": the close
 *   of the video, said over the last picture of the world.
 *   Board units: the light on the left (x 0 to 300), the orbit around (620, 300) with radius 200, the panel at
 *   x 960 to 1500. Every word on screen comes from the world's props.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { AREA, Board, KeepSize, SceneTitle, clamp01, mix, mixColour, paint, prog, textStyle, useBeats, useClock, useTheme, useWorld } from '@kit';
import type { SceneProps } from '@kit';
import { halfArc, halfDisc, litPath, moonAt, onCircle, towards } from './lib/moon';

const RECT = [0, 180, 1920, 690];
const C: [number, number] = [620, 300];
const ORBIT = 200;
const EARTH = 46;
const MOON = 30;
const LAMP: [number, number] = [90, 300];
const PANEL = { x: 960, y: 40, w: 540, h: 520 };
const FACE = { x: 1230, y: 285, r: 160 };
const SIDE = { ex: 1060, ey: 300, er: 30, mx: 1420, mr: 18, deg: 12 };
/** The top of the definition line, under the drawing and above the captions. */
const DEF_Y = 812;
/** Degrees either side of new, half and full in which the disc is given that name. */
const NAMED = 8;

/** The index into props.phases for a phase angle: new, crescent, half, gibbous, full, gibbous, half, crescent. */
const phaseIndex = (a: number) => {
  const near = (c: number) => Math.abs(((a - c + 540) % 360) - 180) <= NAMED;
  if (near(0)) return 0;
  if (near(90)) return 2;
  if (near(180)) return 4;
  if (near(270)) return 6;
  return a < 90 ? 1 : a < 180 ? 3 : a < 270 ? 5 : 7;
};

type Names = { light: string; centre: string; ball: string; view: string; shadow: string };
type SideWords = { title: string; path: string; note: string; shadow: string; eclipse: string };

export default function Orbit({ v }: SceneProps) {
  const th = useTheme();
  const t = useClock();
  const w = useWorld();
  const room = w.props.room as Names;
  const space = w.props.space as Names;
  const phases = w.props.phases as string[];
  const sw = w.props.sideview as SideWords;
  const def = w.props.definition as { term: string; text: string } | undefined;
  const beats = useBeats();
  const defShown = def && 'def' in beats ? prog(t, beats.def, 0.6) : 0;

  const angle = w.num('angle');
  const sky = w.num('sky');
  const facing = w.num('facing');
  const shadow = w.num('shadow');
  const side = w.num('side');
  const tilt = w.num('tilt');

  const sun = paint(th, 'sun');
  const lit = paint(th, 'moonlit');
  const unlit = paint(th, 'unlit');
  const faint = paint(th, 'earthshine');
  const earth = paint(th, 'earth');
  const night = paint(th, 'night');
  const shade = paint(th, 'shadow');
  const skyFill = paint(th, 'sky');
  const copper = paint(th, 'eclipse');
  const quiet = mixColour(th.bg, th.ink2, 0.45);

  const moon = moonAt(C[0], C[1], ORBIT, angle);
  // the lit half faces the lamp in the room and the far Sun (straight to the left) in space
  const litDir = mix(towards(moon, LAMP), 180, sky);
  const toEarth = towards(moon, C);
  const seen = ((angle % 360) + 360) % 360;
  const phaseName = phases[phaseIndex(seen)];
  // in the room the ball held behind your head goes into its shadow; in space the Moon passes above it (side view)
  const inBand = moon[0] > C[0] + EARTH ? clamp01((EARTH + MOON / 2 - Math.abs(moon[1] - C[1])) / MOON) : 0;
  const shaded = (1 - sky) * shadow * inBand;
  const ballLit = mixColour(lit, unlit, shaded);
  const faceLit = mixColour(lit, faint, shaded);

  // Earth's shadow: a band that narrows away from the Sun, as long as the track says
  const len = 300 * shadow;
  const h0 = EARTH;
  const h1 = EARTH - 12 * shadow;
  const band = `M ${C[0]},${C[1] - h0} L ${C[0] + len},${C[1] - h1} L ${C[0] + len},${C[1] + h1} L ${C[0]},${C[1] + h0} Z`;

  // side view: the Moon's orbit, a circle of radius L tilted by i (drawn larger than the real 5 degrees), seen
  // from the side. phi is the angle of its line of nodes from the Sun line: 90 degrees draws it edge on as a tilted
  // line, 0 as a thin ellipse whose far end lies in Earth's plane. The full moon is the point of the orbit straight
  // away from the Sun as seen from above (z = 0).
  const L = SIDE.mx - SIDE.ex;
  const inc = (-SIDE.deg * Math.PI) / 180;
  const phi = (90 * tilt * Math.PI) / 180;
  const onOrbit = (th0: number): [number, number] => [
    SIDE.ex + L * (Math.cos(th0) * Math.cos(phi) - Math.sin(th0) * Math.cos(inc) * Math.sin(phi)),
    SIDE.ey - L * Math.sin(th0) * Math.sin(inc),
  ];
  const orbitPath = Array.from({ length: 91 }, (_, k) => onOrbit((k * 4 * Math.PI) / 180))
    .map(([x, y], k) => `${k ? 'L' : 'M'} ${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const sideMoon = onOrbit(Math.atan2(-Math.sin(phi), Math.cos(inc) * Math.cos(phi)));
  const dark = 1 - tilt;

  const nose = (() => {
    const d = towards(C, moon);
    const tip = onCircle(C[0], C[1], EARTH + 16, d);
    const a = onCircle(C[0], C[1], EARTH - 2, d - 16);
    const b = onCircle(C[0], C[1], EARTH - 2, d + 16);
    return `M ${a[0]},${a[1]} L ${tip[0]},${tip[1]} L ${b[0]},${b[1]} Z`;
  })();

  const out = (() => {
    const dx = moon[0] - C[0];
    const dy = moon[1] - C[1];
    const n = Math.hypot(dx, dy) || 1;
    return [moon[0] + (dx / n) * 86, moon[1] + (dy / n) * 62] as [number, number];
  })();

  // a name in the room and its name in space, cross-faded by "sky"; both centred on their points. A name that a
  // line of the drawing may cross sits on a patch of the ground colour, as names on a chart do.
  const name = (key: keyof Names, inRoom: [number, number], inSpace: [number, number], colour = th.ink, extra = 1, halo = false) => {
    const look = (o: number): React.CSSProperties => ({ ...textStyle(th, 's'), color: colour, opacity: o * extra,
      whiteSpace: 'nowrap', background: halo ? th.bg : undefined, padding: halo ? '0 10px' : undefined });
    return (
      <>
        <KeepSize pos={inRoom} center><div style={look(1 - sky)}>{room[key]}</div></KeepSize>
        <KeepSize pos={inSpace} center><div style={look(sky)}>{space[key]}</div></KeepSize>
      </>
    );
  };

  return (
    <AbsoluteFill>
      <SceneTitle text={v.title} t={t} />
      <Board v={v} rect={RECT}>
        <svg width={1500} height={600} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
          {/* the light: a bulb that shines all round in the room, parallel rays from the far Sun in space */}
          <g opacity={1 - sky}>
            <circle cx={LAMP[0]} cy={LAMP[1]} r={28} fill={sun} />
            {[-40, -20, 0, 20, 40].map((d) => {
              const a = onCircle(LAMP[0], LAMP[1], 44, d);
              const b = onCircle(LAMP[0], LAMP[1], 110, d);
              return <line key={d} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={sun} strokeWidth={th.stroke * 2} strokeLinecap="round" />;
            })}
          </g>
          <g opacity={sky}>
            {[100, 200, 300, 400, 500].map((y) => (
              <g key={y}>
                <line x1={20} y1={y} x2={236} y2={y} stroke={sun} strokeWidth={th.stroke * 2} strokeLinecap="round" />
                <path d={`M 226,${y - 12} L 250,${y} L 226,${y + 12} Z`} fill={sun} />
              </g>
            ))}
          </g>

          {/* the orbit, then the shadow under everything that sits on it */}
          <circle cx={C[0]} cy={C[1]} r={ORBIT} fill="none" stroke={th.line} strokeWidth={th.stroke * 1.5} strokeDasharray="10 12" />
          {shadow > 0.001 ? <path d={band} fill={shade} /> : null}

          {/* the arm that holds the ball, only in the room */}
          <line x1={C[0]} y1={C[1]} x2={moon[0]} y2={moon[1]} stroke={quiet} strokeWidth={12} strokeLinecap="round" opacity={1 - sky} />

          {/* your head, seen from above, turned toward the ball */}
          <g opacity={1 - sky}>
            <path d={nose} fill={th.surface} stroke={th.ink2} strokeWidth={th.stroke} />
            <circle cx={C[0]} cy={C[1]} r={EARTH} fill={th.surface} stroke={th.ink2} strokeWidth={th.stroke} />
          </g>
          {/* Earth, its night half away from the Sun */}
          <g opacity={sky}>
            <circle cx={C[0]} cy={C[1]} r={EARTH} fill={earth} />
            <path d={halfDisc(C[0], C[1], EARTH, 0)} fill={night} />
          </g>

          {/* the Moon (or the ball): its lit half toward the light, and the half that faces Earth ringed */}
          <circle cx={moon[0]} cy={moon[1]} r={MOON} fill={unlit} />
          <path d={halfDisc(moon[0], moon[1], MOON, litDir)} fill={ballLit} />
          <path d={halfArc(moon[0], moon[1], MOON + 8, toEarth)} fill="none" stroke={earth} strokeWidth={6}
            strokeLinecap="round" opacity={facing} />

          {/* the panel: what is seen from the centre, or the side view */}
          <rect x={PANEL.x} y={PANEL.y} width={PANEL.w} height={PANEL.h} fill={skyFill} stroke={th.line} strokeWidth={th.stroke} />
          <g opacity={1 - side}>
            <circle cx={FACE.x} cy={FACE.y} r={FACE.r} fill={faint} />
            <path d={litPath(FACE.x, FACE.y, FACE.r, seen)} fill={faceLit} />
          </g>
          <g opacity={side}>
            {[220, 300, 380].map((y) => (
              <g key={y}>
                <line x1={980} y1={y} x2={1008} y2={y} stroke={sun} strokeWidth={th.stroke * 1.5} strokeLinecap="round" />
                <path d={`M 1004,${y - 8} L 1020,${y} L 1004,${y + 8} Z`} fill={sun} />
              </g>
            ))}
            <path d={`M ${SIDE.ex},${SIDE.ey - 30} L 1480,${SIDE.ey - 22} L 1480,${SIDE.ey + 22} L ${SIDE.ex},${SIDE.ey + 30} Z`} fill={shade} />
            <defs>
              <clipPath id="moon-side-panel"><rect x={1030} y={PANEL.y} width={PANEL.x + PANEL.w - 1050} height={PANEL.h} /></clipPath>
            </defs>
            <path d={orbitPath} fill="none" clipPath="url(#moon-side-panel)" stroke={th.ink2} strokeWidth={th.stroke * 1.5} strokeDasharray="8 10" />
            <circle cx={SIDE.ex} cy={SIDE.ey} r={SIDE.er} fill={earth} />
            <path d={halfDisc(SIDE.ex, SIDE.ey, SIDE.er, 0)} fill={night} />
            <circle cx={sideMoon[0]} cy={sideMoon[1]} r={SIDE.mr} fill={mixColour(unlit, copper, dark)} />
            <path d={halfDisc(sideMoon[0], sideMoon[1], SIDE.mr, 180)} fill={mixColour(lit, copper, dark)} />
          </g>
        </svg>

        {/* names last, so nothing covers them; each keeps its size while the board is zoomed */}
        {name('light', [LAMP[0] - 20, 372], [135, 450])}
        {name('centre', [C[0] - 72, C[1] - EARTH - 40], [C[0] - 72, C[1] - EARTH - 40], th.ink, 1, true)}
        {name('ball', out, out)}
        {name('shadow', [800, C[1] - EARTH - 18], [800, C[1] - EARTH - 18], th.ink2, shadow, true)}
        <KeepSize pos={[PANEL.x + 20, PANEL.y + 14]}>
          <div style={{ ...textStyle(th, 's'), color: th.ink2, opacity: (1 - side) * (1 - sky), whiteSpace: 'nowrap' }}>{room.view}</div>
        </KeepSize>
        <KeepSize pos={[PANEL.x + 20, PANEL.y + 14]}>
          <div style={{ ...textStyle(th, 's'), color: th.ink2, opacity: (1 - side) * sky, whiteSpace: 'nowrap' }}>{space.view}</div>
        </KeepSize>
        <KeepSize pos={[FACE.x, FACE.y + FACE.r + 44]} center>
          <div style={{ ...textStyle(th, 's'), color: th.ink, opacity: sky * (1 - side), whiteSpace: 'nowrap' }}>{phaseName}</div>
        </KeepSize>
        <KeepSize pos={[PANEL.x + 20, PANEL.y + 14]}>
          <div style={{ ...textStyle(th, 's'), color: th.ink2, opacity: side, whiteSpace: 'nowrap' }}>{sw.title}</div>
        </KeepSize>
        <KeepSize pos={[1100, 120]}>
          <div style={{ opacity: side, whiteSpace: 'nowrap' }}>
            <div style={{ ...textStyle(th, 's'), color: th.ink }}>{sw.path}</div>
            <div style={{ ...textStyle(th, 's'), color: th.ink2 }}>{sw.note}</div>
          </div>
        </KeepSize>
        <KeepSize pos={[1180, SIDE.ey + 44 + 52 * (1 - tilt)]}>
          <div style={{ ...textStyle(th, 's'), color: th.ink2, opacity: side, whiteSpace: 'nowrap' }}>{sw.shadow}</div>
        </KeepSize>
        <KeepSize pos={[SIDE.mx, SIDE.ey - 70]} center>
          <div style={{ ...textStyle(th, 's'), color: th.ink, opacity: side * dark, whiteSpace: 'nowrap' }}>{sw.eclipse}</div>
        </KeepSize>
      </Board>
      {def && defShown > 0 ? (
        <div style={{ position: 'absolute', left: AREA.side, top: DEF_Y, display: 'flex', alignItems: 'baseline', gap: 24,
          whiteSpace: 'nowrap', opacity: defShown }}>
          <span style={{ ...textStyle(th, 'l'), color: th.ink }}>{def.term}</span>
          <span style={{ ...textStyle(th, 'm'), color: th.ink }}>{def.text}</span>
        </div>
      ) : null}
    </AbsoluteFill>
  );
}
