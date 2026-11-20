/**
 * @file kit/canvas.tsx
 * @description The kit's own host for a react-three-fiber canvas (architecture section 6.8). <Stage> uses it;
 *   scene code never does. It exists because the library's wrapper (@remotion/three's ThreeCanvas) draws from
 *   its FIRST child and only when the frame number changes: whatever a later sibling sets in its own effect is
 *   one frame late, and anything that commits without a frame change is never drawn at all. That was the
 *   cause of the blank textures in every v0.2 filmstrip.
 *   What this host does instead:
 *   - The frame loop is off. A <Draw> component, the LAST child, draws the picture in a layout effect on every
 *     commit of the 3D tree, after the layout effects of everything before it. That is why three objects may be
 *     changed during render or in useLayoutEffect and never in useEffect.
 *   - Every frame, the first included, is held by a delayRender handle until <Draw> has drawn it.
 *   - The layout size is fixed in layout pixels, whatever CSS scale the frame is shown at (a filmstrip cell).
 *   - The pixel ratio is the render scale, clamped to 0.5..2: half in a preview, two in a 4K master, and half in
 *     a filmstrip cell, which is shown at less than a third of its size.
 *   - Errors leave the canvas as data. react-three-fiber reports every error it catches as a global error
 *     event, and Remotion stops a render on any such event. So a guard inside the canvas records the error
 *     (src/custom.tsx cancels the global event of exactly those errors) and hands it to the DOM side, which
 *     throws it there, where the scene's own boundary turns it into the plain card and a report line.
 *     A lost WebGL context and a shader that does not compile become errors of the same kind.
 */
import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Internals, useCurrentFrame, useDelayRender, useVideoConfig } from 'remotion';
import { recordError, useVideo } from '../custom';
import { InCanvas } from './staging';

type GuardProps = { frame: number; onError: (e: unknown) => void; children: ReactNode };
type GuardState = { error: unknown; frame: number };

/** Catches what the 3D children throw, inside the canvas, and passes it out. Each frame is judged on its own. */
class Guard extends React.Component<GuardProps, GuardState> {
  state: GuardState = { error: null, frame: this.props.frame };
  static getDerivedStateFromError(error: unknown) {
    // recorded here, during render, because react-three-fiber dispatches it globally in the commit that follows
    recordError(error);
    return { error: error ?? new Error('a 3D child threw nothing') };
  }
  static getDerivedStateFromProps(p: GuardProps, s: GuardState) {
    return p.frame === s.frame ? null : { error: null, frame: p.frame };
  }
  componentDidCatch(error: unknown) {
    this.props.onError(error);
  }
  render() {
    return this.state.error ? null : this.props.children;
  }
}

/**
 * Pins the canvas to its layout size. react-three-fiber measures its container on screen, and a filmstrip
 * shows the frame scaled down by CSS, so its own measurement would shrink the drawing buffer and the camera.
 */
const FixedSize = ({ width, height }: { width: number; height: number }) => {
  const set = useThree((s) => s.set);
  const live = useThree((s) => s.setSize);
  const [setSize] = useState(() => live);
  useLayoutEffect(() => {
    setSize(width, height);
    set({ setSize: () => null });
    return () => set({ setSize });
  }, [setSize, width, height, set]);
  return null;
};

/**
 * Turns what three.js and the browser only log into errors of the scene: a shader that does not compile (three.js
 * logs it and the mesh goes missing) and a WebGL context lost while the stage is on screen. The FIRST child: its
 * layout effect runs before <Draw>'s, so it is in place for the first draw, where shaders compile. (The library's
 * onCreated comes after that first draw, which is too late.)
 */
const Watch = ({ fail }: { fail: (e: unknown) => void }) => {
  const gl = useThree((s) => s.gl);
  useLayoutEffect(() => {
    gl.debug.onShaderError = (ctx, _program, vertex, fragment) => {
      const log = ctx.getShaderInfoLog(vertex) || ctx.getShaderInfoLog(fragment) || 'no log';
      // the driver's log may end in a NUL character: control characters become spaces
      fail(new Error(`a shader of this stage did not compile: ${log.replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, 200)}`));
    };
    const canvas = gl.domElement;
    const lost = () => {
      if (canvas.isConnected) fail(new Error('the WebGL context of this stage was lost during the render. Render again; if it comes back, lower the concurrency.'));
    };
    canvas.addEventListener('webglcontextlost', lost);
    // removed before the library drops the context itself on unmount, which is no error
    return () => {
      canvas.removeEventListener('webglcontextlost', lost);
      gl.debug.onShaderError = null;
    };
  }, [gl, fail]);
  return null;
};

/** Draws the picture. Last in the canvas, so every layout effect of the scene has already run. */
const Draw = ({ frame, seconds, drawn }: { frame: number; seconds: number; drawn: (frame: number) => void }) => {
  const advance = useThree((s) => s.advance);
  const gl = useThree((s) => s.gl);
  // no dependency list: every commit of the 3D tree is drawn, also one a child causes by setting state in a layout effect
  useLayoutEffect(() => {
    if (gl.getContext().isContextLost())
      throw new Error('the WebGL context of this stage was lost, so the frame would be blank. Render again; if it comes back, lower the concurrency.');
    // the store's own advance draws this canvas only; the timestamp is the frame's time, so its clock follows the video
    advance(seconds);
    drawn(frame);
  });
  return null;
};

/** Shadow filtering, fixed: the library's default soft filter is noisier and differs between drivers. */
const SHADOWS = { type: THREE.PCFShadowMap };
const GL = { alpha: true, antialias: true, powerPreference: 'high-performance' as const };

export type HostProps = {
  /** Layout pixels: the canvas is exactly this large on the 1920x1080 frame. */
  width: number;
  height: number;
  /** The stage's own camera. It is marked `manual`, so react-three-fiber never resizes or re-projects it. */
  camera: THREE.PerspectiveCamera;
  children?: ReactNode;
};

export const CanvasHost = ({ width, height, camera, children }: HostProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { strip, only2d } = useVideo();
  // The backstop of make.py's 2D check, which reads the scene code as text: a <Stage> it could not see still stops here
  if (only2d)
    throw new Error('this scene draws in 3D (a <Stage>), but the direction holds the video to 2D ("2d-only" or form "2d"): ' +
      'redraw it on a <Board> or with a 2D template, or change the direction');
  const { delayRender, continueRender } = useDelayRender();
  const contexts = Internals.useRemotionContexts();
  const [failed, setFailed] = useState<{ error: unknown; frame: number } | null>(null);

  // One handle per frame, taken here and let go by <Draw>. Either may come first (the 3D tree can commit inside this
  // component's own commit, before its layout effect), so both look at the frame number. A draw of an earlier frame
  // that arrives late never lets go of the handle of a later one.
  const hold = useRef<number | null>(null);
  const done = useRef(-1);
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const release = useCallback(() => {
    if (hold.current !== null) continueRender(hold.current);
    hold.current = null;
  }, [continueRender]);
  useLayoutEffect(() => {
    // the label is plain on purpose: make.py lifts every console line that carries the kit's error mark
    if (done.current !== frame) hold.current = delayRender(`kit canvas: drawing the 3D stage, frame ${frame}`);
    return release;
  }, [frame, delayRender, release]);
  const fail = useCallback((error: unknown) => {
    recordError(error);
    setFailed({ error, frame: frameRef.current });
  }, []);
  // A frame in which something failed keeps its handle: the card replaces the stage before the frame is taken, and
  // the handle goes when the stage unmounts. Without this, <Draw> would let a picture with a missing mesh through.
  const failedAt = useRef(-1);
  const drawn = useCallback((f: number) => {
    done.current = f;
    if (f === frameRef.current && failedAt.current !== f) release();
  }, [release]);
  const watchFail = useCallback((error: unknown) => {
    failedAt.current = frameRef.current;
    fail(error);
  }, [fail]);

  // thrown on the DOM side, where the scene's boundary draws the card; only for the frame it happened in
  if (failed && failed.frame === frame) throw failed.error;

  const dpr = strip ? 0.5 : Math.max(0.5, Math.min(2, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1));
  return (
    <Canvas frameloop="never" flat shadows={SHADOWS} dpr={dpr} camera={camera} gl={GL}
      style={{ position: 'absolute', left: 0, top: 0, width, height }}>
      <Internals.RemotionContextProvider contexts={contexts}>
        <InCanvas.Provider value>
          <Guard frame={frame} onError={fail}>
            <Watch fail={watchFail} />
            <FixedSize width={width} height={height} />
            {children}
            <Draw frame={frame} seconds={frame / fps} drawn={drawn} />
          </Guard>
        </InCanvas.Provider>
      </Internals.RemotionContextProvider>
    </Canvas>
  );
};
