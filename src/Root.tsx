/**
 * @file Root.tsx
 * @description Declares the compositions. "Explainer" is the video: its length comes from props.duration, which
 *   make.py sets from the synthesized narration. "Strip" is a one-frame review still of one scene
 *   (make.py --strip N), sized by props.strip.
 */
import React from 'react';
import { Composition } from 'remotion';
import { Explainer } from './Explainer';
import { Strip } from './Strip';
import type { StripInfo } from './Strip';
import { Sheet } from './Sheet';
import type { SheetProps } from './Sheet';
import type { Props } from './types';

const preview: Props = {
  title: 'Preview',
  fps: 30,
  duration: 4,
  scenes: [
    { start: 0, dur: 4, visual: { type: 'title', title: 'Explainer engine', subtitle: 'make.py renders real specs' } },
  ],
  captions: [],
};

const frames = (p: Props) => Math.max(1, Math.ceil(p.duration * (p.fps || 30)));

export const Root = () => (
  <>
    <Composition
      id="Explainer"
      component={Explainer}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={120}
      defaultProps={preview}
      calculateMetadata={({ props }) => ({ fps: props.fps || 30, durationInFrames: frames(props) })}
    />
    <Composition
      id="Strip"
      component={Strip}
      width={1240}
      height={1400}
      fps={30}
      durationInFrames={120}
      defaultProps={preview as Props & { strip?: StripInfo }}
      calculateMetadata={({ props }) => ({
        fps: props.fps || 30,
        durationInFrames: frames(props),
        width: props.strip?.width ?? 1240,
        height: props.strip?.height ?? 1400,
      })}
    />
    <Composition id="Sheet" component={Sheet} width={1920} height={1080} fps={30} durationInFrames={1}
      defaultProps={{ title: 'Contact sheet', items: [] } as SheetProps} />
  </>
);
