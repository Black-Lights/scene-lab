/**
 * @file threeShim.ts
 * @description The two parts of three that @remotion/three's texture hooks load lazily by their source path
 *   ("three/src/loaders/TextureLoader.js", "three/src/textures/VideoTexture.js"). remotion.config.ts points both
 *   paths here, so the classes come from the one built copy of three the renderer uses. Without this, a lazy chunk
 *   carried three's source modules beside the build: a second Texture class and a second ColorManagement, which a
 *   texture made by those hooks would bring into the renderer.
 */
export { TextureLoader, VideoTexture } from 'three';
