/**
 * @file templates/index.ts
 * @description Every visual.type and its template. All templates are full-frame, theme-driven and built on
 *   motion.ts. A template gets { v (the visual), dur (seconds), index, prev (the previous scene, for continuity), scene }.
 *   New template = component here + TYPES in make.py + a row in SPEC.md + a scene in videos/_demo/spec.json.
 */
import type React from 'react';
import { Sequence } from './sequence';
import { Chapter } from './chapter';
import { Diagram, Flow } from './diagram';
import { Plot } from './plot';
import { Analogy } from './analogy';
import { Stage3D } from './stage3d';
import { Chart, Code, Compare, ImageScene, Points, Quote, Stat, Svg, Timeline, TitleScene } from './basic';
import { CustomScene } from '../custom';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TEMPLATES: Record<string, (p: any) => React.ReactElement | null> = {
  title: TitleScene,
  points: Points, list: Points, recap: Points,
  analogy: Analogy,
  flow: Flow, steps: Flow,
  diagram: Diagram,
  sequence: Sequence,
  stage3d: Stage3D,
  plot: Plot,
  compare: Compare,
  stat: Stat, number: Stat,
  chart: Chart, bars: Chart,
  timeline: Timeline,
  quote: Quote, big: Quote, definition: Quote,
  code: Code,
  image: ImageScene,
  svg: Svg,
  chapter: Chapter,
  custom: CustomScene, // scene code written per video: videos/<slug>/scenes/<component>.tsx (custom.tsx)
};
