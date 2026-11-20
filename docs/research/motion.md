# Research: motion (2026-11-14, v0.2 sweep)

(A) MOTION TOKENS

Source numbers:
- Material 3 durations: short1-4 50/100/150/200 ms, medium1-4 250-400 ms, long1-4 450-600 ms, extra-long1-4 700-1000 ms. Easings: emphasized/standard cubic-bezier(0.2,0,0,1), emphasized-decelerate (0.05,0.7,0.1,1), emphasized-accelerate (0.3,0,0.8,0.15), standard-decelerate (0,0,0,1), standard-accelerate (0.3,0,1,1). https://github.com/material-components/material-web/blob/main/tokens/versions/v0_192/_md-sys-motion.scss
- M3 springs (damping ratio / stiffness). Standard spatial: 0.9 at 1400/700/300 (fast/default/slow). Effects: 1.0 at 3800/1600/800. https://raw.githubusercontent.com/androidx/androidx/androidx-main/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens/StandardMotionTokens.kt Expressive spatial: 0.6/800, 0.8/380, 0.8/200. Effects are the same as standard. https://raw.githubusercontent.com/androidx/androidx/androidx-main/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens/ExpressiveMotionTokens.kt Google allows overshoot only on spatial springs (position and scale). Effects springs (opacity, colour) are always critically damped.
- Carbon durations: 70, 110, 150, 240, 400, 700 ms (background dimming). Productive standard (0.2,0,0.38,0.9), entrance (0,0,0.38,0.9), exit (0.2,0,1,0.9). Expressive standard (0.4,0.14,0.3,1), entrance (0,0,0.3,1), exit (0.4,0.14,1,1). Expressive is for "significant moments" and should be used sparingly. https://carbondesignsystem.com/elements/motion/overview/
- NN/g: most motion takes 100-400 ms, and 500 ms or more "feels like a drag" in UI. Entrances should run longer than exits (300 ms in, 200-250 ms out). Ease-out for entrances, ease-in for exits. Animations are more often too long than too short. https://www.nngroup.com/articles/animation-duration/
- manim defaults: run_time 1.0 s, rate_func smooth (a sigmoid with inflection 10), lag_ratio 0. lag_ratio staggers sub-items inside the same total run_time. there_and_back = smooth(2t) mirrored, which suits pulses and highlights. https://docs.manim.community/en/stable/reference/manim.animation.animation.Animation.html https://github.com/ManimCommunity/manim/blob/main/manim/utils/rate_functions.py
- Pacing guides (secondary sources): hold 0.15-0.30 s before an element moves, an end hold of 6-12 frames at 24 fps (longer for key text), and a stagger of 2-6 frames. About 2 s to read a short line. Narration around 150 wpm. https://editframe.com/skills/motion-design/3-attention

Proposed explainer tokens. This is my synthesis: video runs about 1.5-2x the UI values because the viewer did not trigger the motion.

| Token | Duration | Curve |
|---|---|---|
| micro (highlight, colour) | 250 ms | standard (0.2,0,0,1) or there_and_back |
| enter | 500 ms | emphasized-decelerate (0.05,0.7,0.1,1) |
| exit | 350 ms (about 0.7 x enter) | emphasized-accelerate (0.3,0,0.8,0.15) |
| transform or morph in place | 800-1000 ms | emphasized (0.2,0,0,1), like manim smooth |
| camera pan or zoom | 1200-1500 ms | emphasized; one move per beat |
| scene transition | 500-700 ms | fade, linear opacity |
| dim background | 700 ms | Carbon slow-02 |
| stagger per item | 80 ms (5 f at 60 fps), group capped at 600 ms | none |
| settle before narration names it | 300-500 ms | none |
| end hold | at least 1.5 s, and 2 s per line of text | none |

Springs: Remotion takes absolute damping, so with mass 1, damping = 2*zeta*sqrt(stiffness). That gives M3 standard spatial default ≈ 47.6/700, expressive ≈ 31.2/380, and effects = 80/1600 (all derived). Avoid bounce and elastic easing. Overshoot draws the eye to the motion itself rather than to the idea. It also repeats on every element, and Carbon and M3 keep expressive overshoot rare and spatial only.

(B) REMOTION 4.0.x

Version warning: the live docs now go up to 4.0.544. Several features are newer than the pinned 4.0.499 and will not work there:
- `TransitionSeries` `durationInFrames` (4.0.533)
- Lottie inheriting Sequence props (4.0.528)
- `@remotion/effects` lightLeak (4.0.500)

**Transitions**
- `import {TransitionSeries, linearTiming, springTiming} from '@remotion/transitions'`
- Presentations: `fade` from '@remotion/transitions/fade'; `slide({direction:'from-left'|'from-right'|'from-top'|'from-bottom'})` from '/slide'; `wipe` from '/wipe'; `clockWipe({width,height})` from '/clock-wipe'. iris and none sit in the same folder pattern (I did not verify those two).
- `<TransitionSeries.Transition timing presentation?>`: the presentation defaults to slide. Both scenes render during the overlap.
- Total length = sum of sequences minus sum of transitions. `<TransitionSeries.Overlay>` (4.0.415+) does not shorten the timeline.
- Rules: a transition cannot be longer than its neighbour scenes; no two transitions in a row; no transition next to an overlay.
- `springTiming({config, durationInFrames, durationRestThreshold, reverse})`. The default threshold 0.005 can cut the end visibly; use 0.001. Each timing has `getDurationInFrames({fps})`.
- Custom presentation: `TransitionPresentation` and `TransitionPresentationComponentProps` give `presentationProgress`, `presentationDirection` ('entering'|'exiting'), `presentationDurationInFrames` and `passedProps`.
- Audio: the docs do not cover narration. My inference: per-scene audio placed inside a Sequence overlaps the next scene during a transition. Put narration in top-level `<Sequence from>` blocks outside the TransitionSeries, starting at the cumulative frame minus earlier transition frames, or use Overlays, which shift nothing.
https://www.remotion.dev/docs/transitions/transitionseries https://www.remotion.dev/docs/transitions/timings/springtiming https://www.remotion.dev/docs/transitions/presentations/custom https://www.remotion.dev/docs/transitions/presentations/slide https://www.remotion.dev/docs/transitions/presentations/clock-wipe

**@remotion/paths**
- `evolvePath(progress, path)` returns `{strokeDasharray, strokeDashoffset}`.
- `interpolatePath(value, a, b)` returns a string. It does not clamp, so values outside 0-1 extrapolate. For keyframes, use `interpolatePaths`.
- `getLength(path)` returns a number.
- `getPointAtLength(path, len)` returns `{x,y}`, and `getTangentAtLength(path, len)` returns `{x,y}`. Since 4.0.498 both return null when len is past the end, which affects the pin, so clamp len.
- `normalizePath(path)` converts relative commands to absolute; invalid input throws "Malformed path data".
https://www.remotion.dev/docs/paths/evolve-path https://www.remotion.dev/docs/paths/interpolate-path https://www.remotion.dev/docs/paths/get-point-at-length https://www.remotion.dev/docs/paths/get-tangent-at-length https://www.remotion.dev/docs/paths/normalize-path

**@remotion/layout-utils** (browser only; load fonts first)
- `fitText({text, withinWidth, fontFamily, fontWeight?, letterSpacing?, textTransform?, validateFontIsLoaded?})` returns `{fontSize}` with no upper limit, so clamp it. Subtract any border from the width.
- `measureText({...same, fontSize})` returns `{width, height}` and caches results.
- `fillTextBox({maxBoxWidth, maxLines}).add({text, fontFamily, fontSize})` returns `{exceedsBox, newLine}`.
- Set `validateFontIsLoaded: true` so a fallback font throws instead of mismeasuring silently.
https://www.remotion.dev/docs/layout-utils/fit-text https://www.remotion.dev/docs/layout-utils/measure-text https://www.remotion.dev/docs/layout-utils/fill-text-box

**@remotion/lottie**
- Peer dependency `lottie-web ^5`. https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/lottie/package.json
- `<Lottie animationData loop? direction? playbackRate? renderer? ('svg' default) preserveAspectRatio? assetsPath? onAnimationLoaded?>`. Memoize animationData; a new object identity re-initializes the animation.
- Loading: `delayRender` in useState, then `fetch(staticFile(name))`, then setState and `continueRender`, with `cancelRender` on error.
- `getLottieMetadata(data)` returns `{width, height, fps, durationInFrames, durationInSeconds}` or null.
https://www.remotion.dev/docs/lottie/lottie https://www.remotion.dev/docs/lottie/staticfile https://www.remotion.dev/docs/lottie/getlottiemetadata

**Fonts**
- `@remotion/fonts` `loadFont({family, url: staticFile(...), weight?, style?, format?})` returns a Promise (4.0.164+). It blocks rendering automatically when called at top level; a 404 fails the render.
- The Fontsource packages are not covered in the docs, so prefer local files with loadFont.
https://www.remotion.dev/docs/fonts-api/load-font https://www.remotion.dev/docs/fonts

**Render flags**
- `--scale` goes up to 16.
- `--gl`: angle, egl, swiftshader, swangle, vulkan, angle-egl. The 4.0 local default is null (Chrome decides). Use angle with a GPU. angle leaks memory on long renders, so render in chunks. swangle is software and slow. https://www.remotion.dev/docs/gl-options
- `--concurrency`: up to the thread count, or a percentage.
- `--x264-preset`: default medium.
- `--crf`: cannot be combined with `--video-bitrate` or hardware encoding.
- `--image-format`: jpeg (default) or png.
- `--jpeg-quality`: 0-100. https://www.remotion.dev/docs/cli/render
- `--hardware-acceleration`: disable (default), if-possible or required. NVENC works on Windows and Linux from 4.0.484, h264 and h265 only; the bundled ffmpeg includes h264_nvenc and hevc_nvenc and needs driver 525+. It cannot use crf, so use `--video-bitrate`, and files come out "significantly larger". https://www.remotion.dev/docs/hardware-acceleration
- `ffmpegOverride` exists, but Remotion discourages it because its args change between patch versions. https://www.remotion.dev/docs/renderer/render-media

**Recommended pipeline (a laptop with an NVIDIA GPU)**
1. Set fps 60 in the Composition. 60 fps doubles the frame count, and `--scale=2` quadruples the pixels per frame, so expect roughly 8x the current 1080p30 render time (inference). Run it in the background, in chunks with `--frames`.
2. Mezzanine render: `npx remotion render --scale=2 --gl=angle --concurrency=50% --image-format=jpeg --jpeg-quality=95 --codec=h264 --crf=12 --x264-preset=veryfast`. The near-lossless h264 keeps the CPU free for Chrome. Tune concurrency with `npx remotion benchmark`. https://www.remotion.dev/docs/cli/benchmark
3. Final encode with the system ffmpeg 7.1.1: `-c:v hevc_nvenc -preset p7 -tune hq -rc vbr -cq 19 -b:v 0 -spatial-aq 1 -aq-strength 8 -temporal-aq 1 -rc-lookahead 32 -bf 3 -b_ref_mode middle -g 120 -pix_fmt yuv420p -tag:v hvc1 -c:a copy`. NVIDIA's own HQ recipe is p6 tune hq, bf 3, b_ref_mode middle, temporal-aq, lookahead 20; spatial-aq lowers PSNR. https://docs.nvidia.com/video-technologies/video-codec-sdk/13.0/ffmpeg-with-nvidia-gpu/index.html
4. No official cq-to-crf mapping exists. ASWF uses nvenc `-rc vbr -cq 19` alongside x264 `-crf 18`. Check cq 18-21 against libx264 crf 18-22 with VMAF on one scene before fixing the value. https://academysoftwarefoundation.github.io/EncodingGuidelines/Encodeh264.html
5. Make the 720p30 page copies from the master with `scale` and `fps=30`.
