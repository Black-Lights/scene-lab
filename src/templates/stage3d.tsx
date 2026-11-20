/**
 * @file stage3d.tsx
 * @description `stage3d`: a real 3D world (@remotion/three, react-three-fiber, three) for things that have form or
 *   that read best as places (F-008). Objects: `block` (a part of a system), `devices` (layered parts from a
 *   geometry file: boxes per layer, built up layer by layer in the order of the stack; each layer may set `metal` and
 *   `opacity`, each part a `name` and a `sub` label), `panel` (a picture on a 3D screen), `stack` (a log that grows
 *   slab by slab). `links` are arcs between objects whose packets travel while the link is named. The camera follows `shots` on cues (establish, top, side, close, orbit), gliding
 *   between angles with eased moves; labels are projected from 3D into the frame in the video's typeface.
 *   Everything derives from the frame: no physics, no clock, no randomness.
 */
import React, { useMemo, useState } from 'react';
import { ThreeCanvas } from '@remotion/three';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { continueRender, delayRender, staticFile, useVideoConfig } from 'remotion';
import { colour, fit, useTheme } from '../theme';
import type { Theme } from '../theme';
import { DUR, EASE, atOf, clamp01, lerp, prog, useClock } from '../motion';
import { Any, SceneTitle } from './common';

const FOV = 34;
const V = (a: number[] | undefined, d: number[]) => new THREE.Vector3(...(a && a.length === 3 ? a : d));

type Obj = { id: string; kind: string; pos: THREE.Vector3; size: THREE.Vector3; raw: Any; at: number };
type Pose = { pos: THREE.Vector3; look: THREE.Vector3 };

/** Size of a devices object in world units, from its boxes (the geometry's own units times scale). */
const deviceExtent = (data: Any, scale: number) => {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const d of data?.devices || [])
    for (const boxes of Object.values(d.boxes || {}) as number[][][])
      for (const [a, b, c, e] of boxes) {
        x0 = Math.min(x0, a + (d.x || 0)); x1 = Math.max(x1, c + (d.x || 0));
        z0 = Math.min(z0, b + (d.y || 0)); z1 = Math.max(z1, e + (d.y || 0));
      }
  if (!Number.isFinite(x0)) return { size: new THREE.Vector3(4, 1, 4), centre: [0, 0] };
  return { size: new THREE.Vector3((x1 - x0) * scale, 1.2, (z1 - z0) * scale), centre: [(x0 + x1) / 2, (z0 + z1) / 2] };
};

const layout = (v: Any, dur: number): Obj[] => {
  const raw: Any[] = v?.objects || [];
  return raw.map((o, i) => {
    let size = V(o.size, [2, 1, 2]);
    if (o.kind === 'devices') size = deviceExtent(o.data, o.scale ?? 0.12).size;
    if (o.kind === 'panel') size = V(o.size, [3.2, 1.9, 0.12]);
    if (o.kind === 'stack') size = V(o.size, [1.6, 0.18 * (o.count ?? 10), 1.1]);
    return { id: String(o.id ?? `o${i}`), kind: o.kind || 'block', pos: V(o.pos, [i * 3, 0, 0]), size, raw: o,
      at: typeof o.at === 'number' ? o.at : -0.4 + i * 0.12 };
  });
};

/** Camera pose for a shot. Angles: az from +z towards +x, el above the ground. */
const poseFor = (shot: Any, objs: Obj[], t: number): Pose => {
  const target = objs.find((o) => o.id === shot?.target);
  const box = new THREE.Box3();
  for (const o of target ? [target] : objs) {
    const c = o.pos.clone().add(new THREE.Vector3(0, o.size.y / 2, 0));
    box.expandByPoint(c.clone().sub(o.size.clone().multiplyScalar(0.5)));
    box.expandByPoint(c.clone().add(o.size.clone().multiplyScalar(0.5)));
  }
  const centre = box.getCenter(new THREE.Vector3());
  const span = box.getSize(new THREE.Vector3());
  const kind = shot?.camera || 'establish';
  const preset: Record<string, [number, number, number]> = {
    establish: [0.75, 0.55, 1.0], top: [0.12, 1.22, 1.0], side: [1.45, 0.16, 0.95], close: [0.55, 0.42, 0.75],
    front: [0.0, 0.3, 0.95], low: [0.9, 0.1, 0.85], orbit: [0.4, 0.45, 0.85],
  };
  const [az0, el, k] = preset[kind] ?? preset.establish;
  let az = shot?.az ?? az0;
  if (kind === 'orbit' && typeof shot?.at === 'number') az += 0.5 * EASE.move(clamp01((t - shot.at) / Math.max(2, shot.hold ?? 6)));
  // fit the footprint to the frame's width and the height to its height (the frame is 16:9, not square)
  const tanV = Math.tan(((FOV / 2) * Math.PI) / 180);
  const halfW = Math.max(span.x, span.z) / 2;
  const halfH = (span.y + Math.max(span.x, span.z) * Math.sin(el)) / 2;
  const floor = kind === 'close' ? 6 : kind === 'orbit' ? 7 : kind === 'low' ? 6 : 3; // a close shot keeps its surroundings
  const dist = (shot?.dist ?? 1) * Math.max(k * 1.08 * Math.max(halfW / (tanV * (16 / 9)), halfH / tanV), floor);
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  return { pos: centre.clone().add(dir.multiplyScalar(dist)), look: centre };
};

const cameraAt = (v: Any, objs: Obj[], t: number, dur: number): Pose => {
  const shots: Any[] = (v?.shots || []).map((s: Any, i: number) => ({ ...s, at: atOf(s, i, (v?.shots || []).length, dur) }));
  if (!shots.length) return poseFor({ camera: 'establish' }, objs, t);
  let k = -1;
  shots.forEach((s, i) => {
    if (s.at <= t) k = i;
  });
  const first = poseFor({ camera: 'establish', ...(shots[0].camera === 'establish' ? shots[0] : {}) }, objs, t);
  if (k < 0) return first;
  const from = k > 0 ? poseFor(shots[k - 1], objs, t) : first;
  const to = poseFor(shots[k], objs, t);
  const p = prog(t, shots[k].at, shots[k].move ?? 2.0, EASE.move);
  return { pos: from.pos.clone().lerp(to.pos, p), look: from.look.clone().lerp(to.look, p) };
};

const Rig = ({ pose }: { pose: Pose }) => {
  const { camera } = useThree();
  camera.position.copy(pose.pos);
  camera.lookAt(pose.look);
  return null;
};

/** Layered parts: every box extruded at its layer's height, layers merged per part for speed. */
const Devices = ({ o, t, th }: { o: Obj; t: number; th: Theme }) => {
  const data = o.raw.data || {};
  const scale = o.raw.scale ?? 0.12;
  const zx = o.raw.zScale ?? 2.5;
  const ext = useMemo(() => deviceExtent(data, scale), [data, scale]);
  const stack: Record<string, Any> = data.stack || {};
  const order = Object.keys(stack).sort((a, b) => (stack[a].z ?? 0) - (stack[b].z ?? 0));
  const geos = useMemo(() => {
    const out: { dev: number; key: string; geo: THREE.BufferGeometry }[] = [];
    (data.devices || []).forEach((d: Any, di: number) => {
      for (const key of order) {
        const boxes: number[][] = d.boxes?.[key] || [];
        if (!boxes.length) continue;
        const L = stack[key];
        const parts = boxes.map(([a, b, c, e]) => {
          const g = new THREE.BoxGeometry(Math.max(0.01, (c - a) * scale), Math.max(0.01, L.h * zx * scale * 4), Math.max(0.01, (e - b) * scale));
          g.translate(((a + c) / 2 + (d.x || 0) - ext.centre[0]) * scale, (L.z * zx * scale * 4) + (L.h * zx * scale * 4) / 2, ((b + e) / 2 + (d.y || 0) - ext.centre[1]) * scale);
          return g;
        });
        out.push({ dev: di, key, geo: mergeGeometries(parts) ?? parts[0] });
      }
    });
    return out;
  }, [data, scale, zx, ext, order.join('|')]);
  const nDev = (data.devices || []).length || 1;
  return (
    <group position={o.pos}>
      {geos.map(({ dev, key, geo }, i) => {
        const li = order.indexOf(key);
        // each part builds layer by layer in the order of the stack, parts staggered along the build
        const g = EASE.enter(clamp01((t - o.at - (dev / nDev) * (o.raw.build ?? 2.2) - li * 0.18) / 0.5));
        if (g <= 0) return null;
        return (
          <mesh key={i} geometry={geo} scale={[1, Math.max(0.001, g), 1]} castShadow receiveShadow>
            <meshStandardMaterial color={stack[key].color} roughness={0.5} metalness={stack[key].metal ?? 0.05}
              transparent={(stack[key].opacity ?? 1) < 1} opacity={stack[key].opacity ?? 1} />
          </mesh>
        );
      })}
      <mesh position={[0, -0.02, 0]} receiveShadow>
        <boxGeometry args={[ext.size.x + 1.2, 0.04, ext.size.z + 1.2]} />
        <meshStandardMaterial color={th.surface} roughness={0.95} />
      </mesh>
    </group>
  );
};

const Panel = ({ o, t, th }: { o: Obj; t: number; th: Theme }) => {
  const src: string | undefined = o.raw.image?.src;
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  const [handle] = useState(() => (src ? delayRender(`texture ${src}`) : null));
  useMemo(() => {
    if (!src) return;
    new THREE.TextureLoader().load(staticFile(src), (tx) => {
      tx.colorSpace = THREE.SRGBColorSpace;
      setTex(tx);
      if (handle !== null) continueRender(handle);
    }, undefined, () => handle !== null && continueRender(handle));
  }, [src]);
  const e = EASE.enter(clamp01((t - o.at) / DUR.enter));
  const s = o.size;
  return (
    <group position={o.pos} scale={[1, Math.max(0.001, e), 1]}>
      <mesh position={[0, s.y / 2 + 0.25, 0]} castShadow>
        <boxGeometry args={[s.x + 0.12, s.y + 0.12, s.z]} />
        <meshStandardMaterial color={th.ink} roughness={0.6} />
      </mesh>
      <mesh position={[0, s.y / 2 + 0.25, s.z / 2 + 0.002]}>
        <planeGeometry args={[s.x, s.y]} />
        {tex ? <meshBasicMaterial map={tex} toneMapped={false} /> : <meshStandardMaterial color={th.surface} />}
      </mesh>
      <mesh position={[0, 0.12, 0]} castShadow>
        <boxGeometry args={[0.5, 0.24, 0.4]} />
        <meshStandardMaterial color={th.ink2} />
      </mesh>
    </group>
  );
};

const Block = ({ o, t, th }: { o: Obj; t: number; th: Theme }) => {
  const e = EASE.enter(clamp01((t - o.at) / DUR.enter));
  if (e <= 0) return null;
  const c = colour(th, o.raw.color, th.surface);
  return (
    <group position={o.pos}>
      <mesh position={[0, (o.size.y * e) / 2, 0]} scale={[1, Math.max(0.001, e), 1]} castShadow receiveShadow>
        <boxGeometry args={[o.size.x, o.size.y, o.size.z]} />
        <meshStandardMaterial color={c} roughness={0.55} metalness={0.1} />
      </mesh>
    </group>
  );
};

/** A log that grows: one slab per event, from its cue, at a steady rate. */
const Stack = ({ o, t, th }: { o: Obj; t: number; th: Theme }) => {
  const n = o.raw.count ?? 10;
  const h = o.size.y / n;
  const c = colour(th, o.raw.color, th.surface);
  return (
    <group position={o.pos}>
      {Array.from({ length: n }, (_, k) => {
        const e = EASE.enter(clamp01((t - o.at - k * (o.raw.every ?? 0.35)) / 0.35));
        if (e <= 0) return null;
        return (
          <mesh key={k} position={[0, h * k + h / 2 + (1 - e) * 0.6, 0]} castShadow receiveShadow>
            <boxGeometry args={[o.size.x, h * 0.82, o.size.z]} />
            <meshStandardMaterial color={c} roughness={0.5} transparent opacity={e} />
          </mesh>
        );
      })}
    </group>
  );
};

const anchor = (o: Obj) => o.pos.clone().add(new THREE.Vector3(0, o.size.y + 0.05, 0));
const arcOf = (a: Obj, b: Obj, lift = 0.35) => {
  const p0 = anchor(a);
  const p2 = anchor(b);
  const mid = p0.clone().lerp(p2, 0.5).add(new THREE.Vector3(0, p0.distanceTo(p2) * lift, 0));
  return new THREE.QuadraticBezierCurve3(p0, mid, p2);
};

const Link = ({ l, objs, t, th, at }: { l: Any; objs: Obj[]; t: number; th: Theme; at: number }) => {
  const a = objs.find((o) => o.id === l.from);
  const b = objs.find((o) => o.id === l.to);
  const curve = useMemo(() => (a && b ? arcOf(a, b, l.lift ?? 0.35) : null), [a?.id, b?.id, l.lift]);
  if (!a || !b || !curve) return null;
  const p = EASE.move(clamp01((t - at) / DUR.draw));
  if (p <= 0) return null;
  const pts = curve.getPoints(48).slice(0, Math.max(2, Math.round(48 * p) + 1));
  const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, l.width ?? 0.022, 6, false);
  const col = colour(th, l.color, th.line);
  const n = l.packets ?? (l.carry ? 3 : 0);
  return (
    <group>
      <mesh geometry={tube}>
        <meshStandardMaterial color={col} roughness={0.4} transparent opacity={l.dashed ? 0.5 : 0.95} />
      </mesh>
      {Array.from({ length: n }, (_, k) => {
        const s = EASE.move(clamp01((t - at - DUR.draw * 0.7 - k * 0.28) / (DUR.travel * 1.4)));
        if (s <= 0 || s >= 1) return null;
        const q = curve.getPointAt(s);
        return (
          <mesh key={k} position={q} castShadow>
            <boxGeometry args={[0.16, 0.16, 0.16]} />
            <meshStandardMaterial color={colour(th, l.carry, th.paint.orange ?? '#F08A1C')} emissive={colour(th, l.carry, '#F08A1C')} emissiveIntensity={0.35} />
          </mesh>
        );
      })}
    </group>
  );
};

/** Labels: 3D anchors projected into the frame with a camera identical to the canvas camera. */
const labelsFor = (objs: Obj[], pose: Pose, t: number, W: number, H: number) => {
  const cam = new THREE.PerspectiveCamera(FOV, W / H, 0.1, 500);
  cam.position.copy(pose.pos);
  cam.lookAt(pose.look);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  const extra: { o: Obj; x: number; y: number; vis: boolean; e: number }[] = [];
  for (const o of objs) {
    if (o.kind !== 'devices' || o.raw.names === false) continue;
    const data = o.raw.data || {};
    const scale = o.raw.scale ?? 0.12;
    const ext = deviceExtent(data, scale);
    (data.devices || []).forEach((d: Any, i: number) => {
      const xs = Object.values(d.boxes || {}).flat() as number[][];
      if (!xs.length) return;
      const cx = (Math.min(...xs.map((q) => q[0])) + Math.max(...xs.map((q) => q[2]))) / 2 + (d.x || 0);
      const cz = (Math.min(...xs.map((q) => q[1])) + Math.max(...xs.map((q) => q[3]))) / 2 + (d.y || 0);
      const p = new THREE.Vector3((cx - ext.centre[0]) * scale, 1.4, (cz - ext.centre[1]) * scale).add(o.pos).project(cam);
      const nDev = (data.devices || []).length || 1;
      const at = o.at + (i / nDev) * (o.raw.build ?? 2.2) + 0.6;
      extra.push({ o: { ...o, id: `${o.id}-${d.name}`, raw: { label: d.name, sub: d.sub } } as Obj,
        x: ((p.x + 1) / 2) * W, y: ((1 - p.y) / 2) * H, vis: p.z < 1 && Math.abs(p.x) < 1.02 && Math.abs(p.y) < 1.02, e: clamp01((t - at) / DUR.enter) });
    });
  }
  return [...extra, ...objs
    .filter((o) => o.raw.label)
    .map((o) => {
      const p = anchor(o).add(new THREE.Vector3(0, 0.25, 0)).project(cam);
      const vis = p.z < 1 && Math.abs(p.x) < 1.05 && Math.abs(p.y) < 1.05;
      return { o, x: ((p.x + 1) / 2) * W, y: ((1 - p.y) / 2) * H, vis, e: clamp01((t - o.at - 0.25) / DUR.enter) };
    })];
};

export const Stage3D = ({ v, dur }: { v: Any; dur: number }) => {
  const th = useTheme();
  const t = useClock();
  void useVideoConfig;
  const width = 1920; // the layout space; --scale renders it sharper, the strip and sheet shrink it
  const height = 1080;
  const objs = useMemo(() => layout(v, dur), [v, dur]);
  const pose = cameraAt(v, objs, t, dur);
  const links: Any[] = v?.links || [];
  const linkAts = links.map((l, i) => (typeof l.at === 'number' ? l.at : Math.max(...[l.from, l.to].map((id) => objs.find((o) => o.id === id)?.at ?? 0)) + 0.3 + i * 0.05));
  const labels = labelsFor(objs, pose, t, 1920, 1080);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <ThreeCanvas width={width} height={height} shadows camera={{ fov: FOV, near: 0.1, far: 500, position: [8, 6, 8] }} style={{ position: 'absolute', inset: 0 }}>
        <Rig pose={pose} />
        <color attach="background" args={[th.bg]} />
        <hemisphereLight args={[th.dark ? '#B8C4D0' : '#FFFFFF', th.dark ? '#1A1F26' : '#C9CED4', th.dark ? 0.55 : 0.75]} />
        <directionalLight position={[8, 14, 10]} intensity={th.dark ? 1.6 : 1.9} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048}
          shadow-camera-left={-30} shadow-camera-right={30} shadow-camera-top={30} shadow-camera-bottom={-30} />
        <directionalLight position={[-10, 6, -6]} intensity={0.35} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow>
          <planeGeometry args={[400, 400]} />
          <meshStandardMaterial color={th.bg} roughness={1} />
        </mesh>
        {objs.map((o) =>
          o.kind === 'devices' ? <Devices key={o.id} o={o} t={t} th={th} /> : o.kind === 'panel' ? <Panel key={o.id} o={o} t={t} th={th} />
            : o.kind === 'stack' ? <Stack key={o.id} o={o} t={t} th={th} /> : <Block key={o.id} o={o} t={t} th={th} />,
        )}
        {links.map((l, i) => <Link key={i} l={l} objs={objs} t={t} th={th} at={linkAts[i]} />)}
      </ThreeCanvas>
      {labels.map(({ o, x, y, vis, e }) =>
        vis && e > 0 ? (
          <div key={o.id} style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%, -100%)', opacity: e, whiteSpace: 'nowrap',
            fontFamily: th.font.text, color: th.ink, textAlign: 'left', padding: '4px 12px', background: th.dark ? 'rgba(14,17,22,0.78)' : 'rgba(255,255,255,0.82)',
            borderRadius: 6 }}>
            <div style={{ fontSize: fit(o.raw.label, 30, 22), fontWeight: th.weight.strong, lineHeight: 1.15 }}>{o.raw.label}</div>
            {o.raw.sub ? <div style={{ fontSize: 22, color: th.ink2, lineHeight: 1.2 }}>{o.raw.sub}</div> : null}
          </div>
        ) : null,
      )}
      <SceneTitle text={v?.title} t={t} />
    </div>
  );
};

export { lerp };
