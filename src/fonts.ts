/**
 * @file fonts.ts
 * @description Loads the typefaces the themes use from local Fontsource files (no network at render time).
 *   @remotion/fonts loadFont blocks rendering until each face is ready, so the first frame is already right.
 *   Variable fonts: one file covers the whole weight range (and Recursive's casual and mono axes).
 */
import { loadFont } from '@remotion/fonts';
import atkinson from '@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-normal.woff2';
import atkinsonMono from '@fontsource-variable/atkinson-hyperlegible-mono/files/atkinson-hyperlegible-mono-latin-wght-normal.woff2';
import recursive from '@fontsource-variable/recursive/files/recursive-latin-full-normal.woff2';
import archivo from '@fontsource-variable/archivo/files/archivo-latin-standard-normal.woff2';

const FACES: [string, string, string][] = [
  ['Atkinson Hyperlegible Next', atkinson, '200 800'],
  ['Atkinson Hyperlegible Mono', atkinsonMono, '200 800'],
  ['Recursive', recursive, '300 1000'],
  ['Archivo', archivo, '100 900'],
];

for (const [family, url, weight] of FACES) {
  loadFont({ family, url, weight, format: 'woff2' }).catch((e) => {
    throw new Error(`font ${family} failed to load: ${e}`);
  });
}
