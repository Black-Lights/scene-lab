/**
 * @file index.ts
 * @description Remotion entry point. Registers the single "Explainer" composition (see Root.tsx).
 * @see ../make.py, which renders it with --props=build/props.json --public-dir=build/public
 */
import { registerRoot } from 'remotion';
import { Root } from './Root';

registerRoot(Root);
