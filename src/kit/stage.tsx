/**
 * @file kit/stage.tsx
 * @description <Stage>: the 3D stage of a scene (architecture section 6.4). It owns everything a scene should
 *   not have to build again: the canvas (the kit's own host, canvas.tsx), the camera that follows the spec's
 *   `shots` on world time, the lights and the ground, and the overlay of HTML above the picture. Its children
 *   are ordinary react-three-fiber elements, the world itself; raw three geometry is first class.
 *   The camera is not react-three-fiber's own: its position and its projection matrix are set from the pure
 *   math in camera.ts on every frame, so the labels in the overlay are projected with exactly the numbers the
 *   picture was rendered with, and the subject sits in the content area, clear of the chapter bar and the
 *   captions. A pose that is not usable (a place at NaN, a zero-size frame seen from inside, fov 180) is an error.
 *   The stage's context (useStage) is computed here, outside the canvas, and provided above it, so the overlay
 *   and the 3D children read one and the same value.
 *   One <Stage> per scene: each is a WebGL context, and a filmstrip mounts a scene eight times. A second one in the
 *   same scene becomes the scene's card (useOnlyStage).
 */
import React, { useContext, useLayoutEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import type { Place, Visual } from '../types';
import { boundsOf, cameraOf, centreOf, clipFor, corners, mixPose, placeOf, project, settle, turned } from './camera';
import type { Bounds, Places, Pose, Rect, Shot, View } from './camera';
import { CanvasHost } from './canvas';
import { Fog, Ground, Lights } from './lights';
import type { FogSpec, GroundSpec, Light } from './lights';
import { DataLabels } from './overlay';
import { InCanvas, StageContext, StageRunContext, useShots, viewOf } from './staging';
import type { OnStage, StageRun, StageState } from './staging';
import { useWorldLine } from './world';
import { StageSlot } from '../custom';

export type StageProps = {
  /** The scene's visual: the stage reads `shots` and `labels` from it. */
  v?: Visual;
  /** Places of this stage only, added to the world's (same shape: { name: { pos, size } }). */
  places?: Record<string, Place>;
  /** Where the stage sits on the frame, [x, y, w, h] in layout pixels. Default: the whole frame. */
  rect?: number[];
  light?: Light;
  ground?: GroundSpec;
  fog?: FogSpec;
  /** HTML above the picture, in layout pixels of the frame: Pin, Label, Counter, anything. */
  overlay?: ReactNode;
  children?: ReactNode;
};

/** A place or a point on the frame as one pose shows it. A place also gets the rectangle its box covers. */
const onStage = (pose: Pose, ref: string | number[], places: Places, view: View): OnStage => {
  if (typeof ref !== 'string') {
    const p = project(pose, ref, view);
    return { ...p, box: [p.x, p.y, 0, 0] };
  }
  const place = placeOf(places, ref, 'the overlay');
  const mid = project(pose, centreOf(place), view);
  const pts = corners(place).map((c) => project(pose, c, view));
  if (!mid.visible || pts.some((p) => !p.visible)) return { ...mid, visible: false, box: [mid.x, mid.y, 0, 0] };
  const [x0, y0] = [Math.min(...pts.map((p) => p.x)), Math.min(...pts.map((p) => p.y))];
  const [x1, y1] = [Math.max(...pts.map((p) => p.x)), Math.max(...pts.map((p) => p.y))];
  return { ...mid, box: [x0, y0, x1 - x0, y1 - y0] };
};

/**
 * A shot that names no angle (no az, el, preset or pos) keeps the angle of the pose before it: "frame the shed"
 * moves in on the shed from where the camera stands, it does not swing round to the establishing angle.
 */
const carry = (shot: Shot, before: Pose): Shot =>
  shot.az !== undefined || shot.el !== undefined || shot.preset !== undefined || shot.pos !== undefined ? shot : { ...shot, az: before.az, el: before.el };

const finitePose = (p: Pose): boolean =>
  [...p.target, p.az, p.el, p.dist, p.fov, ...p.shift].every(Number.isFinite) && p.dist > 0 && p.fov > 0 && p.fov < 180;

/** A pose for an error message: numbers rounded to two decimals, so the line stays short enough to read. */
const poseText = (p: Pose): string =>
  JSON.stringify(p, (_k, x) => (typeof x === 'number' && Number.isFinite(x) ? Math.round(x * 100) / 100 : typeof x === 'number' ? String(x) : x));

/** Puts the canvas camera where the pose says, with the same matrix the overlay projects with. */
const Rig = ({ cam, pose, view, bounds }: { cam: THREE.PerspectiveCamera; pose: Pose; view: View; bounds: Bounds }) => {
  const [m, r, u, b] = useMemo(() => [new THREE.Matrix4(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] as const, []);
  // a layout effect with no dependencies: it runs in every commit, before <Draw> draws the frame
  useLayoutEffect(() => {
    const clip = clipFor(pose, bounds);
    const c = cameraOf(pose, view, clip.near, clip.far);
    cam.position.set(...c.eye);
    cam.quaternion.setFromRotationMatrix(m.makeBasis(r.set(...c.right), u.set(...c.up), b.set(...c.back)));
    cam.fov = pose.fov;
    cam.aspect = c.aspect;
    cam.near = c.near;
    cam.far = c.far;
    cam.projectionMatrix.fromArray(c.proj);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    cam.updateMatrixWorld(true);
  });
  return null;
};

/**
 * One <Stage> per scene. Checked when a stage mounts (a layout effect, whose error the scene's boundary turns into the
 * card), not while it renders: in the frame where a scene swaps one stage for another, the old one is unmounted before
 * the new one mounts, so a swap is never taken for two stages at once.
 */
const useOnlyStage = () => {
  const slot = useContext(StageSlot);
  const me = useMemo(() => ({}), []);
  useLayoutEffect(() => {
    if (!slot) return undefined;
    slot.add(me);
    if (slot.values().next().value !== me) {
      slot.delete(me);
      throw new Error('this scene mounts a second <Stage>. A scene holds one (each is a WebGL context): draw both parts in one Stage, ' +
        'or draw one of them on a <Board>');
    }
    return () => {
      slot.delete(me);
    };
  }, [slot, me]);
};

export const Stage = ({ v, places: more, rect, light = 'studio', ground = 'shadow', fog = false, overlay, children }: StageProps) => {
  if (useContext(InCanvas)) throw new Error('a <Stage> cannot sit inside the 3D children of another <Stage>');
  useOnlyStage();
  const { line, here } = useWorldLine();
  const visual = v ?? here.scene.visual;
  const moreKey = JSON.stringify(more ?? null);
  const rectKey = JSON.stringify(rect ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const view = useMemo(() => viewOf(rect), [rectKey]);
  const places = useMemo(() => {
    const all: Places = { ...line.decl.places, ...more };
    for (const [name, p] of Object.entries(all))
      if (!Array.isArray(p?.pos) || p.pos.length !== 3)
        throw new Error(`the place "${name}" needs "pos": [x, y, z] on a <Stage> (a place with [x, y] belongs to a <Board>)`);
    return all;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line, moreKey]);
  const bounds = useMemo(() => boundsOf(Object.values(places)), [places]);
  const stamp = useMemo(() => ({}), [places, view]);
  const { pose, entries, atRest, follow } = useShots<Pose>(visual, { rest: (shot) => settle(shot, places, view), mix: mixPose, turn: turned, carry, stamp });
  if (!finitePose(pose))
    throw new Error(`the camera pose of this <Stage> is not usable (a value is not finite, dist <= 0, or fov <= 0 or >= 180): ${poseText(pose)}; ` +
      'check the places and shots it frames');

  const state = useMemo<StageState>(
    () => ({ kind: 'stage', pose, project: (ref) => onStage(pose, ref, places, view), places, rect: [view.x, view.y, view.w, view.h],
      area: [view.x + view.area[0], view.y + view.area[1], view.area[2], view.area[3]] as Rect }),
    [pose, places, view],
  );
  const run: StageRun = { count: entries.length, stamp, projectAt: (i, ref) => onStage(atRest(i), ref, places, view), follow };

  // The camera belongs to the stage: react-three-fiber leaves a camera marked `manual` alone.
  const camera = useMemo(() => Object.assign(new THREE.PerspectiveCamera(), { manual: true }), []);

  return (
    <StageContext.Provider value={state}>
      <StageRunContext.Provider value={run}>
        <div style={{ position: 'absolute', left: view.x, top: view.y, width: view.w, height: view.h }}>
          <CanvasHost width={view.w} height={view.h} camera={camera}>
            <Rig cam={camera} pose={pose} view={view} bounds={bounds} />
            <Lights look={light} bounds={bounds} pose={pose} />
            <Ground ground={ground} bounds={bounds} />
            <Fog fog={fog} bounds={bounds} dist={pose.dist} />
            {children}
          </CanvasHost>
        </div>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, pointerEvents: 'none' }}>
          <DataLabels labels={visual?.labels} />
          {overlay}
        </div>
      </StageRunContext.Provider>
    </StageContext.Provider>
  );
};
