/**
 * @file glyphs.ts
 * @description Standard icons every template may use (lock, key, eye, warning, envelope), resolved by make.py in
 *   the theme's icon set and passed as props.glyphs, so templates never hardcode an icon family.
 */
import { createContext, useContext } from 'react';
import type { IconData } from './draw';

export type Glyphs = Record<string, IconData | null | undefined>;
export const GlyphContext = createContext<Glyphs>({});
export const useGlyphs = () => useContext(GlyphContext);
