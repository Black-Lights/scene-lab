/**
 * @file kit/index.ts
 * @description Everything scene code may import, as `@kit` (videos/<slug>/scenes/*.tsx, v0.3). The kit is
 *   topic-free (F-010): a video's own geometry, data and builders live in its folder, never here.
 *   One line per module, and every module of the kit is here from the first day, the ones still empty too:
 *   an author who fills a module never has to touch this file (architecture section 1, "Ownership").
 *   The scene author's page for the core: ../../docs/kit/core.md. Design: ../../docs/v0.3-architecture.md.
 */
// ---- core ----
// time: scene seconds, named beats, keyframes, the words of the narration
export * from './time';
// colour references resolved against the video's design
export * from './paint';
// the three type sizes, the data face, measuring text
export * from './type';
// world state: tracks, places, focus
export * from './world';
// the camera as pure math: shots, poses, projection
export * from './camera';
// the preload gate: what an asset is, and how a work package adds a loader for a kind (useAsset is in ./world)
export { registerLoader } from './preload';
export type { Asset, Loader } from './preload';
// the 3D stage, the 2D board, what they share (useStage)
export * from './stage';
export * from './board';
export { CONTENT, FRAME, useStage } from './staging';
export type { OnStage, StageState } from './staging';
// HTML above a stage: Pin, Label, Counter
export * from './overlay';
// ---- work packages (architecture section 6.7) ----
export * from './lights'; // A1
export * from './labels'; // A1
export * from './parts2d'; // A2
export * from './textcard'; // A2: TextCard
export * from './capacity'; // A2: CapacityBar
export * from './beats'; // A2: beats across scenes, highlight
export * from './codeblock'; // A2: CodeBlock
export * from './ledger'; // A2: Ledger, LedgerSlip
export * from './lanes'; // A2: Lanes
export * from './phrasecard'; // A2: PhraseCard
export * from './pane'; // A2: OutputPane
export * from './chart'; // A2: Bars
export * from './shapes'; // B
export * from './materials'; // B
export * from './flow'; // B
export * from './random'; // B
export * from './assets'; // C
export * from './media'; // C
// ---- the engine, for scene code ----
// a scene's place in the video, what a scene component receives, the error channel
export { report, useReport, useScene, useVideo } from '../custom';
export type { SceneInfo, SceneProps, VideoInfo } from '../custom';
export type { Place, Scene, TrackValue, Visual, Word, WorldDecl } from '../types';
// the video's design and the engine's motion language (prog, with easing by name, comes from ./time)
export { AREA, useTheme } from '../theme';
export type { Theme } from '../theme';
export { DUR, EASE, clamp01, lerp } from '../motion';
// 2D drawing shared with the templates
export { DrawPath, Glyph, HArrow } from '../draw';
export { SceneTitle, fitSize } from '../templates/common';
