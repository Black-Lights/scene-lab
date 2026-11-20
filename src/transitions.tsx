/**
 * @file transitions.tsx
 * @description Cuts between scenes, as @remotion/transitions presentations.
 *   glide: the camera pans across one wide canvas to the next scene (scenes inside a chapter sit side by side),
 *   with a slight pull back mid-move so the move reads as a camera, not a slide-in.
 *   rise: into and out of a chapter card, the frame lifts away upward.
 *   Plain fade comes from @remotion/transitions/fade. Every curve is eased, nothing overshoots.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import type { TransitionPresentation, TransitionPresentationComponentProps } from '@remotion/transitions';
import { EASE } from './motion';

type GlideProps = { dx: number; dy: number };

const GlideView: React.FC<TransitionPresentationComponentProps<GlideProps>> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const p = EASE.move(presentationProgress);
  const pull = 1 - 0.07 * Math.sin(Math.PI * p);
  const k = presentationDirection === 'exiting' ? -p : 1 - p;
  return (
    <AbsoluteFill style={{ transform: `scale(${pull}) translate(${k * passedProps.dx}px, ${k * passedProps.dy}px)` }}>
      {children}
    </AbsoluteFill>
  );
};

export const glide = (dx = 2080, dy = 0): TransitionPresentation<GlideProps> => ({ component: GlideView, props: { dx, dy } });

const RiseView: React.FC<TransitionPresentationComponentProps<Record<string, never>>> = ({ children, presentationDirection, presentationProgress }) => {
  if (presentationDirection === 'exiting') {
    const p = EASE.exit(presentationProgress);
    return <AbsoluteFill style={{ opacity: 1 - p, transform: `translateY(${-60 * p}px)` }}>{children}</AbsoluteFill>;
  }
  const p = EASE.enter(presentationProgress);
  return <AbsoluteFill style={{ opacity: p, transform: `translateY(${60 * (1 - p)}px)` }}>{children}</AbsoluteFill>;
};

export const rise = (): TransitionPresentation<Record<string, never>> => ({ component: RiseView, props: {} });
