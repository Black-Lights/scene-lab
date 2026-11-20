/**
 * @file remotion.config.ts
 * @description Remotion CLI configuration, read from the repo root by render, still, bundle and studio.
 *   Gives scene code one import path for the toolkit: `@kit` is src/kit (the same alias is in tsconfig.json for
 *   the typecheck). Scene files live outside src (videos/<slug>/scenes), so a relative path would be fragile.
 *   One engine (docs/v0.3-architecture.md section 6.8): every path is built from the real path of the repo root,
 *   and three, @react-three/fiber and @remotion/three are pinned to the root's own copies. On Windows one folder
 *   can be reached with its drive letter in upper and in lower case (C: and c:), and webpack takes two spellings
 *   for two modules: the kit,
 *   src/custom.tsx and the 3D libraries would each load twice, with two registries and two sets of contexts, and
 *   a 3D child would read the wrong theme or clock without any error. realpathSync.native returns the one spelling
 *   the file system itself uses. src/custom.tsx throws if it is loaded twice all the same.
 *   The two source paths of three that @remotion/three loads lazily go to src/threeShim.ts, so no second copy of
 *   three's classes reaches the bundle.
 */
import fs from 'fs';
import path from 'path';
import { Config } from '@remotion/cli/config';

// make.py and the studio run Remotion from the repo root
const ROOT = fs.realpathSync.native(process.cwd());
const lib = (...parts: string[]) => path.join(ROOT, 'node_modules', ...parts);

Config.overrideWebpackConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: {
      ...(config.resolve?.alias ?? {}),
      '@kit': path.join(ROOT, 'src', 'kit'),
      // exact matches ($), so a deep import such as three/examples/jsm/... still resolves inside the same package
      three$: lib('three', 'build', 'three.module.js'),
      '@react-three/fiber$': lib('@react-three', 'fiber', 'dist', 'react-three-fiber.esm.js'),
      '@remotion/three$': lib('@remotion', 'three', 'dist', 'esm', 'index.mjs'),
      // @remotion/three's texture hooks import two classes by three's source path: both come from the one build
      'three/src/loaders/TextureLoader.js$': path.join(ROOT, 'src', 'threeShim.ts'),
      'three/src/textures/VideoTexture.js$': path.join(ROOT, 'src', 'threeShim.ts'),
    },
  },
}));
