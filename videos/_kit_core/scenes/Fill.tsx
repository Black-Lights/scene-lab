/**
 * @file videos/_kit_core/scenes/Fill.tsx
 * @description Smoke test of the core on its 2D path: a free scene ({"type": "custom"}) that declares its own
 *   state tracks and beats in the spec. A glass fills while the narration says so (a "set" entry with a cue and
 *   an "until"), a Counter shows the level, a lamp changes colour (a colour track) and a note appears on a named
 *   beat. Every time and every word on screen comes from the spec; this file holds only the drawing.
 *   Two scenes use this component: each is a world of one scene, so each starts from its own declared state.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { AREA, Counter, SceneTitle, prog, textStyle, useBeat, useClock, useTheme, useWorld } from '@kit';
import type { SceneProps } from '@kit';

// The drawing, in layout pixels of the 1920x1080 frame. The glass stands inside the content area.
const GLASS = { x: AREA.side + 140, y: 300, w: 240, h: 440 };

export default function Fill({ v }: SceneProps) {
  const th = useTheme();
  const t = useClock();
  const w = useWorld();
  const full = useBeat('full');
  const level = w.num('level'); // 0..1, moved by the spec's "set" on the spoken words
  const words = w.props as { level: string; lamp: string; note: string };
  const water = GLASS.h * level;
  return (
    <AbsoluteFill>
      <SceneTitle text={v.title} t={t} />
      {/* the glass: an outline open at the top, and the water inside it */}
      <div style={{ position: 'absolute', left: GLASS.x, top: GLASS.y, width: GLASS.w, height: GLASS.h, boxSizing: 'border-box',
        border: `${th.stroke * 2}px solid ${th.ink}`, borderTop: 'none', borderRadius: `0 0 ${th.radius}px ${th.radius}px`, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: water, background: w.color('water') }} />
      </div>
      <div style={{ position: 'absolute', left: GLASS.x + GLASS.w + 60, top: GLASS.y + GLASS.h - water - 40, ...textStyle(th, 's'), color: th.ink2 }}>
        {words.level}
      </div>
      <div style={{ position: 'absolute', left: GLASS.x + GLASS.w + 60, top: GLASS.y + GLASS.h - water }}>
        <Counter value={level * 100} unit="%" size="l" />
      </div>
      {/* the lamp: its colour is a track, so it cross-fades on the word the spec names */}
      <div style={{ position: 'absolute', left: 1180, top: 380, width: 150, height: 150, borderRadius: 75, background: w.color('lamp') }} />
      <div style={{ position: 'absolute', left: 1180, top: 560, ...textStyle(th, 'm') }}>{words.lamp}</div>
      {/* the note arrives on the named beat */}
      <div style={{ position: 'absolute', left: 1180, top: 640, ...textStyle(th, 'm'), color: th.ink2, opacity: prog(t, full, 0.5) }}>
        {words.note}
      </div>
    </AbsoluteFill>
  );
}
