/**
 * @file kit/board.tsx
 * @description <Board>: the 2D stage of a scene (architecture section 6.4), the equal of <Stage> for things a
 *   flat drawing says faster (F-011). It is a drawing surface of any extent in board units (layout pixels at
 *   zoom 1, origin top left, y down) that a camera pans and zooms. Its children are ordinary HTML and SVG,
 *   positioned in board units. The same model as in 3D runs it: places declared in the spec, `shots` that
 *   frame places on spoken words on world time, state tracks, labels and an overlay in layout pixels.
 *   The camera is a CSS transform on one element. Nothing is turned into a bitmap, so type and strokes stay
 *   sharp at any zoom and in a 4K master.
 *   Children scale with the zoom. A name or a number that must keep its size on screen goes in <KeepSize>.
 */
import React, { useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { Place, Visual } from '../types';
import { mixPose2, placeOf, project2, settle2 } from './camera';
import type { Places, Pose2, Rect, View } from './camera';
import { DataLabels } from './overlay';
import { InCanvas, StageContext, StageRunContext, useShots, useStage, viewOf } from './staging';
import type { OnStage, StageRun, StageState } from './staging';
import { useWorldLine } from './world';

export type BoardProps = {
  /** The scene's visual: the board reads `shots` and `labels` from it. */
  v?: Visual;
  /** Places of this board only, added to the world's ({ name: { pos: [x, y], size: [w, h] } }). */
  places?: Record<string, Place>;
  /** Where the board sits on the frame, [x, y, w, h] in layout pixels. Default: the whole frame. */
  rect?: number[];
  /** HTML above the drawing, in layout pixels of the frame: Pin, Label, Counter, anything. */
  overlay?: ReactNode;
  children?: ReactNode;
};

/** A place or a point on the frame as one pose shows it. */
const onBoard = (pose: Pose2, ref: string | number[], places: Places, view: View): OnStage => {
  if (typeof ref !== 'string') {
    const p = project2(pose, ref, view);
    return { ...p, box: [p.x, p.y, 0, 0] };
  }
  const pl = placeOf(places, ref, 'the overlay');
  const [w, h] = [Number(pl.size?.[0] ?? 0), Number(pl.size?.[1] ?? 0)];
  const corner = project2(pose, pl.pos, view);
  const mid = project2(pose, [pl.pos[0] + w / 2, pl.pos[1] + h / 2], view);
  return { ...mid, box: [corner.x, corner.y, w * pose.zoom, h * pose.zoom] };
};

export type KeepSizeProps = {
  /** Where it sits, in board units: its top-left corner, or its middle with `center`. */
  pos: number[];
  center?: boolean;
  children?: ReactNode;
};

/**
 * A child of a <Board> that keeps its size on screen while the drawing around it zooms: the way to put a name or a
 * number on a part of a wide drawing. Everything else on a board is in board units and scales with the zoom, so a
 * plain 30 px name would shrink below the smallest type size in a wide shot and grow in a close one. It is drawn
 * with the board (under what comes after it, clipped to the board, dimmed by the colours it is given); its content
 * is in layout pixels, so textStyle(th, 's') is 30 px on screen at every zoom.
 */
export const KeepSize = ({ pos, center = false, children }: KeepSizeProps) => {
  const stage = useStage();
  if (stage.kind !== 'board')
    throw new Error('<KeepSize> belongs among the children of a <Board>; on a <Stage>, put names in the "overlay" prop (Pin, Label)');
  if (!Array.isArray(pos) || pos.length !== 2 || !pos.every(Number.isFinite))
    throw new Error(`<KeepSize> needs "pos": [x, y] in board units, not ${JSON.stringify(pos)}`);
  const zoom = (stage.pose as Pose2).zoom;
  // scaled about its own anchor by the inverse of the zoom; the translate is applied first, so `center` stays exact
  return (
    <div style={{ position: 'absolute', left: pos[0], top: pos[1], transformOrigin: '0 0', whiteSpace: 'nowrap',
      transform: `scale(${1 / zoom})${center ? ' translate(-50%, -50%)' : ''}` }}>
      {children}
    </div>
  );
};

export const Board = ({ v, places: more, rect, overlay, children }: BoardProps) => {
  if (useContext(InCanvas)) throw new Error('a <Board> is HTML: it cannot sit among the 3D children of a <Stage>');
  const { line, here } = useWorldLine();
  const visual = v ?? here.scene.visual;
  const moreKey = JSON.stringify(more ?? null);
  const rectKey = JSON.stringify(rect ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const view = useMemo(() => viewOf(rect), [rectKey]);
  const places = useMemo(() => {
    const all: Places = { ...line.decl.places, ...more };
    for (const [name, p] of Object.entries(all))
      if (!Array.isArray(p?.pos) || p.pos.length !== 2)
        throw new Error(`the place "${name}" needs "pos": [x, y] on a <Board> (a place with [x, y, z] belongs to a <Stage>)`);
    return all;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line, moreKey]);
  const stamp = useMemo(() => ({}), [places, view]);
  const { pose, entries, atRest, follow } = useShots<Pose2>(visual, { rest: (shot) => settle2(shot, places, view), mix: mixPose2, stamp });

  const state = useMemo<StageState>(
    () => ({ kind: 'board', pose, project: (ref) => onBoard(pose, ref, places, view), places, rect: [view.x, view.y, view.w, view.h],
      area: [view.x + view.area[0], view.y + view.area[1], view.area[2], view.area[3]] as Rect }),
    [pose, places, view],
  );
  const run: StageRun = { count: entries.length, stamp, projectAt: (i, ref) => onBoard(atRest(i), ref, places, view), follow };

  // board point (x, y) goes to the middle of the stage: move the origin there, then scale about it
  const [tx, ty] = [view.w / 2 - pose.x * pose.zoom, view.h / 2 - pose.y * pose.zoom];
  return (
    <StageContext.Provider value={state}>
      <StageRunContext.Provider value={run}>
        <div style={{ position: 'absolute', left: view.x, top: view.y, width: view.w, height: view.h, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${pose.zoom})` }}>
            {children}
          </div>
        </div>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, pointerEvents: 'none' }}>
          <DataLabels labels={visual?.labels} />
          {overlay}
        </div>
      </StageRunContext.Provider>
    </StageContext.Provider>
  );
};
