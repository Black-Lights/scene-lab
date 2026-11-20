/**
 * @file kit/assets.tsx
 * @description FILLED BY WORK PACKAGE C (assets, media, sound), docs/v0.3-architecture.md section 6.7.
 *   Assets a spec declares, in scene code: Model, Environment and useTexture. The core already has the rest:
 *   useAsset(name) (world.ts) returns { src, kind, credit, data } synchronously, because the preload gate
 *   (preload.ts) loads every declared asset before a scene mounts. A new kind gets its loader with
 *   registerLoader(kind, (url, asset) => Promise<data>), called once at module load; pictures are built in.
 *   A model is cloned per mount (architecture section 6.6).
 *   The core created this file empty so that the barrel (index.ts) exports every module of the kit from the
 *   first day: whatever this file exports is importable from `@kit` at once, and nobody but the core author
 *   edits index.ts. Keep the header of this repo (@file, @description) when you fill it in.
 */
export {};
