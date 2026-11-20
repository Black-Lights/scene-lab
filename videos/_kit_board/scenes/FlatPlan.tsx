/**
 * @file videos/_kit_board/scenes/FlatPlan.tsx
 * @description Worked example of a 2D world on a <Board>: the floor plan of a small flat, drawn in board units
 *   (layout pixels at zoom 1, origin top left). The world is declared once in the spec ("worlds.flat"): its rooms
 *   are places, and its state is three kinds of track: a vector (where the walker is), a family of colours (the
 *   light in each room, "light.*") and the reserved focus. Scenes 1, 2 and 4 of the spec are views of it: the
 *   camera frames rooms on spoken words, state carries from one scene to the next, and a room the focus leaves out
 *   steps back toward the ground colour.
 *   The board sits in a rectangle under the scene title (`rect`), so the camera fits the rooms into the content
 *   area below it. Room names come from the world's props: text shown on screen lives in the spec, not here.
 *   Board children scale with the zoom, so each name sits in a <KeepSize>: 30 px on screen in the wide shot and in
 *   the close one, never under the smallest type size.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Board, KeepSize, SceneTitle, mixColour, paint, textStyle, useClock, useTheme, useWorld } from '@kit';
import type { SceneProps } from '@kit';

/** The board's rectangle on the frame: from under the title to the top of the captions. */
const RECT = [0, 180, 1920, 690];
const WALKER = 18; // radius in board units

export default function FlatPlan({ v }: SceneProps) {
  const th = useTheme();
  const t = useClock();
  const w = useWorld();
  const rooms = w.props.rooms as Record<string, string>; // place id -> the room's name on the plan
  const [wx, wy] = w.vec('walker');
  // dimming is a mix toward the ground colour, never opacity: 1 in focus (or no focus), 0.3 out of it
  const ink = (id: string) => mixColour(th.bg, th.ink, w.dim(id));
  return (
    <AbsoluteFill>
      <SceneTitle text={v.title} t={t} />
      <Board v={v} rect={RECT}>
        {Object.keys(rooms).map((id) => {
          const [x, y] = w.places[id].pos;
          const [width, height] = w.places[id].size ?? [0, 0];
          return (
            <div key={id} style={{ position: 'absolute', left: x, top: y, width, height, boxSizing: 'border-box',
              background: mixColour(th.bg, w.color(`light.${id}`), w.dim(id)), border: `${th.stroke}px solid ${ink(id)}` }} />
          );
        })}
        {/* names after every room, so no room covers a name; each keeps its size on screen while the plan zooms,
            and its inset (the padding) is in layout pixels too */}
        {Object.entries(rooms).map(([id, name]) => (
          <KeepSize key={id} pos={w.places[id].pos}>
            <div style={{ padding: '12px 18px', ...textStyle(th, 's'), color: ink(id) }}>{name}</div>
          </KeepSize>
        ))}
        <div style={{ position: 'absolute', left: wx - WALKER, top: wy - WALKER, width: 2 * WALKER, height: 2 * WALKER,
          borderRadius: WALKER, background: paint(th, 'a') }} />
      </Board>
    </AbsoluteFill>
  );
}
