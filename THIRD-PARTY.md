# Third-party software, models and content

Scene Lab's own code is licensed under Apache-2.0 (see LICENSE). That licence covers the files of this repository
and nothing else. Nothing listed on this page is part of the repository: npm and pip install it on your machine,
or the engine fetches it when a video needs it. Each piece keeps its own licence, and you accept that licence when
you install or use it.

The licences below were read on 19 November 2026 from the installed packages, at the versions pinned in
package.json and requirements.txt. A project can change its licence, so its own licence file is the source, not
this page.

## Remotion is not open source

Remotion renders every frame of every video, so everyone who uses Scene Lab uses Remotion. Remotion is
source-available under the Remotion License. Its terms, as the licence file of version 4.0.499 states them
(`node_modules/remotion/LICENSE.md`):

- You may use it free of charge if you are an individual, a for-profit organisation with up to 3 employees, a
  non-profit or not-for-profit organisation, or if you are evaluating Remotion and do not yet use it commercially.
  Free use includes making commercial videos and images, and changing Remotion for your own use case or to
  contribute a fix back.
- Everyone else needs a Remotion Company License. In practice that is a for-profit organisation with 4 or more
  employees. Remotion sells it at remotion.pro.
- Nobody may copy or modify Remotion code in order to sell, rent, license, relicense or sublicense a derivative of
  Remotion.
- The file says the licence will change slightly in Remotion 5.0.
- Remotion's licence FAQ, read on 19 November 2026, adds a condition the licence file does not spell out. Five
  kinds of organisation must ask Remotion for written permission before they use the free licence: government
  entities and public-sector bodies, educational institutions, commercial subsidiaries, trade associations and
  industry groups, and organisations primarily serving commercial interests. A non-profit outside these groups
  need not ask; it counts as one when it is formed and run mainly for charitable, educational, scientific,
  artistic or public-benefit purposes, and a company does not count merely because it makes no profit. The FAQ
  also says how people are counted when several organisations work on one project:
  https://www.remotion.dev/docs/license/faq

Remotion's licence page: https://www.remotion.dev/docs/license
The licence file: https://github.com/remotion-dev/remotion/blob/main/LICENSE.md

Check which group you are in before you install. Scene Lab contains no Remotion code, and its Apache-2.0 licence
gives you no rights to Remotion.

Under the Remotion License: `remotion`, `@remotion/cli`, `@remotion/lottie`, and the packages they bring in
(`@remotion/bundler`, `renderer`, `player`, `web-renderer`, `media-parser`, `canvas-capture`, `drag-and-drop`).
`@remotion/transitions` says "UNLICENSED" in its package.json and ships no licence file. It comes from the
Remotion repository, so treat it as under the Remotion License. The same holds for
`@remotion/compositor-win32-x64-msvc`, the renderer's native part on Windows, which states no licence; it carries
an FFmpeg build (`ffmpeg.exe`, `ffprobe.exe` and the libav, libvpx and zlib libraries). Under MIT:
`@remotion/three`, `paths`, `shapes`, `fonts` and `layout-utils`, and the other `@remotion` packages npm brings in
(`licensing`, `media-utils`, `streaming`, `studio`, `studio-server`, `studio-shared`, `timeline-utils`,
`zod-types`).

## npm packages

| Package | Version | Licence |
|---|---|---|
| remotion, @remotion/cli, @remotion/lottie | 4.0.499 | Remotion License |
| @remotion/transitions | 4.0.499 | no licence stated (see above) |
| @remotion/three, paths, shapes, fonts, layout-utils | 4.0.499 | MIT |
| react, react-dom | 19.2.8 | MIT |
| three | 0.186.1 | MIT |
| @react-three/fiber | 9.8.2 | MIT |
| @dagrejs/dagre | 3.1.3 | MIT |
| lottie-web | 5.13.0 | MIT |
| @fontsource-variable/archivo, atkinson-hyperlegible-next, atkinson-hyperlegible-mono, recursive | 5.3.0 | OFL-1.1 |
| typescript (development only) | 5.9.3 | Apache-2.0 |
| @types/react, @types/three (development only) | 19.2.7, 0.186.0 | MIT |

`npm ci` installed 285 packages on Windows when this page was written (the lock file lists 330, among them
builds for other systems). Apart from the Remotion packages they are under
MIT, ISC, BSD, Apache-2.0 and similar permissive licences. The ones that differ: the four font packages (OFL-1.1),
`mediabunny` and its three audio encoders (MPL-2.0, brought in by Remotion), and `caniuse-lite` (data under
CC-BY-4.0).

## Python packages

| Package | Version | Licence |
|---|---|---|
| kokoro | 0.9.4 | Apache-2.0 |
| misaki[en] | 0.9.4 | Apache-2.0 |
| soundfile | 0.13.1 | BSD-3-Clause |
| torch (CPU wheel) | 2.15.0 | BSD-3-Clause, with parts under Apache-2.0 and other permissive licences |
| numpy | 2.5.4 | BSD-3-Clause AND 0BSD AND MIT AND Zlib AND CC0-1.0 |
| transformers | 5.23.0 | Apache-2.0 |
| certifi | 2026.10.23 | MPL-2.0 |

pip brings in more with these. The ones you might care about: huggingface_hub (Apache-2.0), spaCy (MIT), loguru
(MIT), tqdm (MPL-2.0 AND MIT), num2words (LGPL).

Two of them are under GPL-3.0-or-later: `phonemizer-fork`, and the espeak-ng library, which `espeakng-loader`
carries (`espeakng-loader` itself states no licence). `misaki[en]` needs both for English. pip installs them on your machine. Scene Lab does not distribute
them and does not change them.

## Models and programs downloaded on first use

- Kokoro-82M (hexgrad/Kokoro-82M on Hugging Face), the voice model and its voices: Apache-2.0 according to its
  model card. The first narration downloads it, about 330 MB.
- spaCy's `en_core_web_sm`: MIT. misaki downloads it on first use.
- Chrome Headless Shell, which Remotion draws the frames in: `npx remotion browser ensure` downloads it from
  Google. It is built from Chromium, under Chromium's BSD-style licence and the licences of its components.
- FFmpeg: Remotion's compositor package brings its own build, which Remotion uses. Scene Lab also needs ffmpeg
  and ffprobe on the PATH for its own encode, and those you install, under LGPL or GPL depending on the build you
  choose.

## Fonts

The four font families in the npm table are the type of the three stock themes. The saved theme `layout-dark`
uses IBM Plex Sans (OFL-1.1), which make.py fetches from Fontsource as described next. A video's design can name
any other family on Fontsource. make.py then fetches its files from the Fontsource API (api.fontsource.org) when the video is
built. Each family has its own licence, which is OFL-1.1 for nearly all of them. The family's page on
fontsource.org shows it.

## Icons

Icons come from the Iconify API (api.iconify.design) by name, and none is stored in this repository. The stock
themes use these sets:

| Set | Used by | Licence |
|---|---|---|
| Bootstrap Icons (`bi`) | the `plate` theme | MIT |
| Phosphor (`ph`) | the `stage` theme | MIT |
| Tabler Icons (`tabler`) | the `layout-dark` theme | MIT |
| Remix Icon (`ri`) | the `ground` theme | see below |

Remix Icon changed its licence. Iconify still lists its copy of the set (4.8.0) as Apache-2.0. The project's own
repository now carries the Remix Icon License v1.0, dated January 2026. That licence allows personal and
commercial use, including in presentations, documentation and marketing material. It forbids selling the icons as
an icon pack, building a competing icon library from them, and using one as a logo or trademark. Read it before
you use the set for anything beyond a picture in a video:
https://github.com/Remix-Design/RemixIcon/blob/master/License

A design can name any other Iconify set. Each video's `ledger.json` records the set, its author and its licence
for every icon the video uses.

## Pictures, video, sound and 3D assets from providers

Scene Lab ships no pictures and no sounds. A spec can ask for them by kind and query, and the engine then
searches these providers:

- No key needed: Iconify, Wikimedia Commons, Openverse, the NASA Image and Video Library, The Met, the Art
  Institute of Chicago, the Cleveland Museum of Art, the Wellcome Collection, the lottie-web test files, Fontsource
  and Poly Haven.
- With your own key: The Noun Project, NASA APOD, Smithsonian Open Access, Europeana, Pixabay, Unsplash, Freesound,
  Jamendo and Sketchfab.

You bring your own keys, in a `.env` file that git ignores, and you accept each provider's terms when you sign up
for one. docs/asset-sources.md records what each provider allows and how the code follows it: what may be cached,
what must be credited, which licences are filtered out. Every asset a video uses is written to that video's
`ledger.json` with its source, author, licence and URL, and the ledger feeds the credits. Assets under NC, ND or
SA terms are flagged in the report. Whether a given picture may be used in your video is your decision.

## Optional tools

Neither is installed by setup.ps1, and the engine works without them.

- Blender 5.2.4 LTS, for a still that needs real materials and light: GPL-3.0-or-later. `blender/install.ps1`
  downloads it from download.blender.org into `tools/blender`, which git ignores. The Blender Lab MCP server that
  `blender/install-mcp.ps1` sets up is GPL-3.0-or-later too. See docs/blender.md.
- ZONOS3-Mini by Zyphra, the second voice: code under MIT, model weights under Apache-2.0. Its aligner,
  facebook/wav2vec2-base-960h, is under Apache-2.0. You build and download these yourself. See docs/voice-zonos3.md.
