/**
 * @file videos/_kit_errors/scenes/Broken.tsx
 * @description Error case 5 of 5: a scene file that throws at its top level, while it loads. The generated entry
 *   loads every scene file on its own inside a try/catch (loadScene in src/custom.tsx), so this file becomes the
 *   card of the scene that uses it and one report line, and every other scene of the video still renders.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import type { SceneProps } from '@kit';

// a table built when the file loads, from a list that is empty: reading its first entry throws
const NAMES: string[] = [];
const FIRST = NAMES[0].toUpperCase();

export default function Broken(_: SceneProps) {
  return <AbsoluteFill>{FIRST}</AbsoluteFill>;
}
