# The second voice: ZONOS3-Mini (optional, experimental)

Kokoro is the default voice and needs nothing beyond `setup.ps1`. A second voice, ZONOS3-Mini by Zyphra, can read a
video instead: `"voice": "zonos3:savannah"` in spec.json (or a scene), or `make.py videos\<slug> --voice
zonos3:savannah` (SPEC.md part 3). It needs a local build that this repository does not ship. Without it, make.py
stops with one line that names what is missing and suggests `"voice": "kokoro"`.

Status in 0.4.0: experimental. It was built and used on Windows only (MSVC). zonos.py expects the server binary
without `.exe` elsewhere, but no other system has been tried.

## What zonos.py does with it

Each scene's spoken text is cut at sentence ends into pieces of at most 48 words. A local `zonos3-server`, started
once per run (on the GPU when the card is free, else on the CPU), reads each piece with a fixed seed. Each take is
trimmed, resampled and brought to Kokoro's loudness; then a forced aligner (wav2vec2) finds every word's time, which
the captions and cues need, and a gate compares what was said with the text. A take that skips or garbles words is
taken again with the next seed, up to 3 times; a piece that still fails is used and named in the report. Every take
is cached under the video's `build\tts`, so a second run synthesizes nothing it has seen. ZONOS3 skips bracket
tokens such as `[INST]`: give them spoken words (F-013).

## What has to be in place

All of it lives under `tools\`, which git ignores, at these paths (zonos.py looks for exactly these):

| Path | What | Where it comes from |
|---|---|---|
| `tools\zonos3\src\` | the ZONOS3-Mini code, with its stock voices in `src\assets\default_voices\` | `git clone https://github.com/Zyphra/ZONOS3-Mini.git tools\zonos3\src`, then `git submodule update --init servers/ggml/ggml third_party/zyphra-textnorm` inside it |
| `tools\zonos3\models\` | `backbone-ptq.gguf` (about 663 MB), `zac-keep2.gguf` (about 452 MB), `spk-encoder.gguf` (about 45 MB) | the `gguf/` folder of the model repository Zyphra/ZONOS3-Mini on Hugging Face |
| `tools\zonos3\build-cpu\` | `zonos3-server.exe`, with the ggml libraries in `build-cpu\bin\` | the CPU build below (required: the CPU build is the fallback) |
| `tools\zonos3\build-cuda\` | the same, built with CUDA | the GPU build below (optional) |
| `tools\voice-compare\models\wav2vec2-base-960h\` | the aligner model (`model.safetensors` and its config and processor files) | the model repository facebook/wav2vec2-base-960h on Hugging Face |

Licences: the ZONOS3-Mini code is MIT and its weights Apache-2.0 (Zyphra); wav2vec2-base-960h is Apache-2.0. None of
it is copied into this repository.

## Build

Needs: Visual Studio 2022 Build Tools (the C++ workload, with its CMake and Ninja), Rust (cargo builds Zyphra's text
normaliser), and for the GPU build the CUDA toolkit (12.6 was used). Read `tools\zonos3\src\servers\ggml\README.md`
first: the configure step applies the patches in its `patches` folder to the ggml tree.

CPU build, in a "x64 Native Tools" prompt (or after calling `vcvars64.bat`), from the engine folder:

```bat
cmake -G Ninja -S tools\zonos3\src\servers\ggml -B tools\zonos3\build-cpu -DCMAKE_BUILD_TYPE=Release -DBUILD_TESTING=OFF
cmake --build tools\zonos3\build-cpu -j 8 --target zonos3-cli zonos3-server
```

GPU build: the same into `tools\zonos3\build-cuda`, with `-DGGML_CUDA=ON -DCMAKE_CUDA_ARCHITECTURES=<your card's
compute capability>` (for example 86 for an RTX 30 series card; the repository's default, 90, does not run on
consumer cards). zonos.py puts `%CUDA_PATH%\bin` on the server's PATH for the GPU build. If nvcc fails at configure
with no message, point `TEMP` and `TMP` at a short folder of your own and run again.

Measured once: the CPU build took about 9 minutes (most of it the text normaliser), the CUDA build about 15.

## Check it

- `.venv\Scripts\python make.py videos\_kit_core --no-render --voice zonos3:savannah` reads the demo's narration and
  reports the voice (takes, retakes, pieces that failed).
- `$env:EXPLAINER_ZONOS3_DEVICE = "gpu"` (or `"cpu"`) forces one build when you want to compare them.
- Stock voices: 30, of which the English ones are AmericanFemale, AmericanMale, BritishFemale, Cillian, Imogen,
  Jett, Morgana, Rupert, Sakura, Savannah, Thaddeus, Willow and Wyatt; a name that does not exist stops the run and
  lists the names there are.

## What it costs (measured once, on a laptop)

- CPU: about 0.5 to 0.6 x real time, about 2 GB of memory for the server.
- GPU: about 0.15 x real time, about 1.3 GB of video memory.
- The aligner: about 7 s to load, then about 0.11 x real time on the CPU.
- Disk: about 2.4 GB for tools\zonos3 with both builds, about 0.4 GB for the aligner, and the Rust toolchain.
