"""
@file zonos.py
@description The second narration voice: ZONOS3-Mini with one of its stock voices, chosen by "voice": "zonos3:savannah"
  in spec.json (or a scene) or by make.py --voice. Kokoro stays the default and does not pass through this file.
  ZONOS3 gives audio only, and some takes skip or garble words (a trial of 16 Nov 2026), so
  each scene goes: split at sentence ends into pieces the model reads well -> one request per piece to a local
  zonos3-server (started once per run, on the GPU when the card is free, else on the CPU; stopped by its own
  process handle) with a fixed seed -> trimmed, brought to the engine's sample rate and to Kokoro's loudness ->
  forced alignment of the spoken words with wav2vec2 (the aligner of the trial; numbers expanded to words) for the
  word times make.py needs -> a gate that compares what was said with the text and takes the piece again with the
  next seed, up to RETAKES times. A piece that still fails is used (the best of its takes) and named in the report;
  it never passes silently. Every take is cached under build/tts, keyed on voice, seed and spoken text, with its
  verdict, so a re-run synthesizes nothing it has seen.
@see make.py (calls Voice.synth per scene and puts stats() in the report), docs/voice-zonos3.md (how to build
  tools/zonos3: binaries, models, stock voices; and where the aligner model goes), SPEC.md section 3
"""
from __future__ import annotations

import difflib
import hashlib
import json
import os
import re
import socket
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent
TOOLS = ROOT / "tools" / "zonos3"
BACKBONE = TOOLS / "models" / "backbone-ptq.gguf"
VOICES_DIR = TOOLS / "src" / "assets" / "default_voices"
BUILDS = {"gpu": TOOLS / "build-cuda", "cpu": TOOLS / "build-cpu"}
# The CUDA toolkit the GPU build was made with (12.6): its installer sets CUDA_PATH_V12_6 and CUDA_PATH
CUDA_BIN = Path(os.environ.get("CUDA_PATH_V12_6") or os.environ.get("CUDA_PATH") or ".") / "bin"
EXE = ".exe" if os.name == "nt" else ""  # the server binary's name ends in .exe on Windows
ALIGN_MODEL = ROOT / "tools" / "voice-compare" / "models" / "wav2vec2-base-960h"
Z_SR = 44100             # what the server returns (X-Audio-Sample-Rate)
TARGET_LUFS = -25.4      # Kokoro's narration, measured 16 Nov 2026 (ffmpeg ebur128): _kit_core -25.5, _demo -25.2, a 12-minute video -25.5
PEAK_MAX = 0.89          # -1 dBFS: a gain that would pass it is cut back, and the scene is named in the report
SEED0, RETAKES = 1, 3    # the first take of every piece uses seed 1; a failed take is taken again with 2, 3, 4
# Pieces: the trial read 75-word paragraphs without a cut-off, and the one skip it found was in a 75-word GPU take;
# shorter pieces make a retake cheaper and a skip rarer, and sentence ends keep the prosody whole
PIECE_WORDS, PIECE_CHARS = 48, 300
MAX_ROWS = 1200          # the server's frame cap (15 rows per second = 80 s), far above a piece
HEAD_S, GAP_S, TAIL_S = 0.12, 0.38, 0.25  # silence kept before a scene's speech, between its pieces, after it
SILENT_DB = -50.0        # 20 ms frames below this are silence (the trial's trim)
# The gate, calibrated on a long narration (44 pieces, GPU) and on takes made bad on purpose: a quarter cut out,
# 1 s cut out, one word cut out, the wrong text, and bracket tokens the voice skips. All failed except a short word cut
# out ("own", a short name), which the alignment absorbs into its neighbours. The one real retake was a take that ended mid-word.
GATE_MEAN = -0.45        # mean log-probability per frame of the forced alignment; good takes -0.05..-0.15, a skipped paragraph -0.33..-1.24
GATE_WORDS = -2.2        # mean word score over GATE_WIN plain words in a row; below it the passage is skipped or garbled
GATE_WIN = 3
GATE_WORD = -6.0         # one plain word of 3+ letters this badly placed was not said (1,690 words of good takes: none below -3.93)
GATE_WORD_OTHER = -9.0   # the same for a number, an acronym or a symbol, which the voice may read its own way
GATE_SKIP = 4            # this many reference words in a row that the transcript does not hear (and it hears under half as many)
GATE_STALL_S = 1.6       # a silence this long inside a piece is a stall


class Unavailable(RuntimeError):
    """tools/zonos3 or the aligner model is missing, or the server could not start: one line for the user."""


class NoSuchVoice(Unavailable):
    """The stock voice named after "zonos3:" does not exist; the other backend would not have it either."""


def parse(voice: str) -> str | None:
    """"zonos3:savannah" -> "savannah"; any other voice (Kokoro) -> None."""
    if isinstance(voice, str) and voice.lower().startswith("zonos3:"):
        return voice.split(":", 1)[1].strip().lower() or None
    return None


def missing() -> str | None:
    """The one line that says what is missing for a ZONOS3 voice, or None when everything is there."""
    need = [BACKBONE, TOOLS / "models" / "zac-keep2.gguf", VOICES_DIR, BUILDS["cpu"] / f"zonos3-server{EXE}"]
    gone = [p for p in need if not p.exists()]
    if gone:
        return (f"voice zonos3: tools/zonos3 is missing or incomplete (no {gone[0].relative_to(ROOT).as_posix()}); build "
                f"it as docs/voice-zonos3.md says, or use \"voice\": \"kokoro\"")
    if not (ALIGN_MODEL / "model.safetensors").exists():
        return (f"voice zonos3: the aligner model {ALIGN_MODEL.relative_to(ROOT).as_posix()} is missing (word times need "
                f"it); docs/voice-zonos3.md says where to get it, or use \"voice\": \"kokoro\"")
    return None


# ---------- text: pieces, and the words the aligner expects

def pieces(text: str) -> list:
    """The spoken text -> pieces cut at sentence ends (then at commas, then between words) so each stays within
    PIECE_WORDS and PIECE_CHARS. The pieces' words, in order, are exactly text.split()."""
    text = text.strip()
    cuts = [m.end() for m in re.finditer(r"[.!?…][\"'”’)\]]*(?=\s)", text)]  # after a sentence end and its closing quote
    bounds = [0] + cuts + [len(text)]
    out, units = [], []
    for seg in (text[a:b].strip() for a, b in zip(bounds, bounds[1:])):
        if not seg:
            continue
        if fits(seg):
            units.append(seg)
            continue
        for part in re.split(r"(?<=[,;:])\s+", seg):  # a long sentence: at its commas
            if fits(part):
                units.append(part)
            else:
                w = part.split()
                units += [" ".join(w[i:i + PIECE_WORDS]) for i in range(0, len(w), PIECE_WORDS)]
    for u in units:  # pack whole units up to the limits
        if out and fits(out[-1] + " " + u):
            out[-1] += " " + u
        else:
            out.append(u)
    return out


def fits(s: str) -> bool:
    return len(s.split()) <= PIECE_WORDS and len(s) <= PIECE_CHARS


ONES = ("zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen "
        "seventeen eighteen nineteen").split()
TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()
ORD = {"one": "first", "two": "second", "three": "third", "five": "fifth", "eight": "eighth", "nine": "ninth",
       "twelve": "twelfth"}


def n2w(n: int) -> str:
    if n < 20:
        return ONES[n]
    if n < 100:
        return TENS[n // 10] + ("" if n % 10 == 0 else " " + ONES[n % 10])
    if n < 1000:
        return ONES[n // 100] + " hundred" + ("" if n % 100 == 0 else " " + n2w(n % 100))
    for big, name in ((10 ** 9, "billion"), (10 ** 6, "million"), (1000, "thousand")):
        if n >= big:
            return n2w(n // big) + " " + name + ("" if n % big == 0 else " " + n2w(n % big))
    return str(n)


def ordinal(n: int) -> str:
    w = n2w(n).split()
    last = w[-1]
    w[-1] = ORD.get(last) or (last[:-1] + "ieth" if last.endswith("y") else last + "th")
    return " ".join(w)


def said(token: str) -> list:
    """One word of the spoken text -> the words the aligner listens for (letters and apostrophes, numbers in words),
    as the server's own text normaliser reads them; [] for a token with nothing to say (a dash)."""
    core = token.strip(".,;:!?\"'“”‘’()[]…")
    core = re.sub(r"(\d),(\d)", r"\1\2", core).replace("%", " percent").replace("&", " and ").replace("+", " plus ")
    out = []
    for piece in re.split(r"[-–/\s]+", core):
        if not piece:
            continue
        m = re.fullmatch(r"(\d+)(st|nd|rd|th)", piece, re.I)
        if m:
            out += ordinal(int(m.group(1))).split()
        elif re.fullmatch(r"\d+\.\d+", piece):
            a, b = piece.split(".")
            out += n2w(int(a)).split() + ["point"] + [ONES[int(c)] for c in b]
        elif re.fullmatch(r"\d+s", piece):  # 1990s
            out += n2w(int(piece[:-1])).split()
        elif piece.isdigit():
            out += n2w(int(piece)).split() if len(piece) < 10 else [ONES[int(c)] for c in piece]
        else:
            m = re.match(r"\$(\d+)", piece)
            if m:
                out += n2w(int(m.group(1))).split() + ["dollars"]
                continue
            p = re.sub(r"[^a-z']", "", piece.lower()).strip("'")
            if p:
                out.append(p)
    return out


def plain(token: str) -> bool:
    """A word the aligner hears reliably: letters only and not an acronym (GPU is read as letters, 42 as words that
    the normaliser may phrase its own way). The garble window only counts these."""
    core = token.strip(".,;:!?\"'“”‘’()[]…")
    return bool(core) and core.replace("'", "").replace("’", "").isalpha() and not (len(core) > 1 and core.isupper())


# ---------- audio helpers (ffmpeg: no resampler or loudness meter in .venv)

def ffmpeg_f32(a: np.ndarray, sr_in: int, sr_out: int) -> np.ndarray:
    if sr_in == sr_out:
        return a.astype("float32")
    r = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-f", "f32le", "-ar", str(sr_in), "-ac", "1",
                        "-i", "pipe:0", "-af", f"aresample={sr_out}", "-f", "f32le", "pipe:1"],
                       input=a.astype("<f4").tobytes(), capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype="<f4").copy()


def lufs(a: np.ndarray, sr: int) -> float | None:
    """Integrated loudness (EBU R128, ffmpeg's ebur128); None when the clip is too short or silent to measure."""
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-f", "f32le", "-ar", str(sr), "-ac", "1", "-i", "pipe:0",
                        "-af", "ebur128", "-f", "null", "-"], input=a.astype("<f4").tobytes(), capture_output=True)
    s = r.stderr.decode("utf-8", "replace")
    m = re.search(r"I:\s+(-?[\d.]+) LUFS", s[s.rfind("Summary:"):])
    v = float(m.group(1)) if m else None
    return v if v is not None and v > -60 else None


def frames_db(a: np.ndarray, sr: int, win: float = 0.02) -> np.ndarray:
    n = max(1, int(win * sr))
    k = len(a) // n
    if not k:
        return np.full(1, -120.0)
    x = a[: k * n].reshape(k, n)
    return 20 * np.log10(np.sqrt((x ** 2).mean(1)) + 1e-9)


def trim(a: np.ndarray, sr: int) -> tuple:
    """-> (the take cut to its speech plus 40 ms each side, the longest silence inside it in seconds)."""
    db = frames_db(a, sr)
    on = np.nonzero(db >= SILENT_DB)[0]
    if not len(on):
        return a[:0], 0.0
    n = int(0.02 * sr)
    i0, i1 = max(0, on[0] * n - int(0.04 * sr)), min(len(a), (on[-1] + 1) * n + int(0.04 * sr))
    quiet, longest, run = db[on[0]:on[-1] + 1] < SILENT_DB, 0, 0
    for q in quiet:
        run = run + 1 if q else 0
        longest = max(longest, run)
    return a[i0:i1], longest * 0.02


# ---------- the aligner (wav2vec2 CTC forced alignment, as in the trial)

_m: dict = {}


def model() -> dict:
    if not _m:
        import torch
        import transformers
        from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor
        transformers.logging.set_verbosity_error()  # its load report (an unused training key) would land in make.py's output
        transformers.logging.disable_progress_bar()
        torch.set_num_threads(max(1, min(8, (os.cpu_count() or 2) // 2)))  # other renders share the machine
        _m["proc"] = Wav2Vec2Processor.from_pretrained(str(ALIGN_MODEL))
        _m["model"] = Wav2Vec2ForCTC.from_pretrained(str(ALIGN_MODEL)).eval()
        _m["vocab"] = _m["proc"].tokenizer.get_vocab()
        _m["inv"] = {v: k for k, v in _m["vocab"].items()}
    return _m


def emissions(x16: np.ndarray) -> np.ndarray:
    import torch
    m = model()
    iv = m["proc"](x16, sampling_rate=16000, return_tensors="pt").input_values
    with torch.inference_mode():
        lg = m["model"](iv).logits[0]
    return torch.log_softmax(lg, -1).numpy()  # [T, C], 20 ms per frame


def greedy(em: np.ndarray) -> list:
    m = model()
    s, prev, pad = [], -1, m["vocab"]["<pad>"]
    for i in em.argmax(-1):
        if i != prev and i != pad:
            s.append(m["inv"][int(i)])
        prev = i
    return "".join(s).replace("|", " ").lower().split()


def ctc_align(em: np.ndarray, tokens: list, blank: int = 0) -> tuple:
    """Viterbi path of the CTC states over the frames -> (state per frame, label per state, mean log-prob per frame)."""
    T, L = em.shape[0], len(tokens)
    S = 2 * L + 1
    lab = np.full(S, blank)
    lab[1::2] = tokens
    neg = -1e30
    dp = np.full(S, neg)
    dp[0] = em[0, blank]
    dp[1] = em[0, lab[1]]
    bp = np.zeros((T, S), dtype=np.int8)
    can_skip = np.zeros(S, bool)
    can_skip[3::2] = lab[3::2] != lab[1:-2:2]
    for t in range(1, T):
        a1 = np.concatenate([[neg], dp[:-1]])
        a2 = np.where(can_skip, np.concatenate([[neg, neg], dp[:-2]]), neg)
        st = np.stack([dp, a1, a2])
        k = st.argmax(0)
        dp = st[k, np.arange(S)] + em[t, lab]
        bp[t] = k
    s = S - 1 if dp[S - 1] >= dp[S - 2] else S - 2
    path = np.empty(T, int)
    for t in range(T - 1, -1, -1):
        path[t] = s
        s -= int(bp[t, s])
    return path, lab, float(max(dp[S - 1], dp[S - 2])) / T


def align(audio: np.ndarray, sr: int, text: str) -> dict:
    """Times and scores of every word of `text` in `audio` -> {"words": [{w, s, e}], "scores": [per word or None],
    "mean": mean log-prob per frame, "heard": greedy transcript, "ref": the words the aligner listened for}."""
    toks_text = text.split()
    subs = [said(t) for t in toks_text]
    x16 = ffmpeg_f32(audio, sr, 16000)
    pad = np.zeros(int(0.1 * 16000), "float32")  # room before and after the first and last word
    em = emissions(np.concatenate([pad, x16, pad]))
    off = -0.1
    vocab = model()["vocab"]
    ids, owner = [], []
    for wi, sub in enumerate(subs):
        if not sub:
            continue
        for ch in "|".join(sub).upper():
            if ch in vocab:
                ids.append(vocab[ch])
                owner.append(wi)
        ids.append(vocab["|"])
        owner.append(-1)
    ids, owner = ids[:-1], owner[:-1]
    ref = [w for sub in subs for w in sub]
    heard = greedy(em)
    if not ids or em.shape[0] < len(ids):  # nothing to align, or far too little audio for the text
        return {"words": [{"w": t, "s": 0.0, "e": 0.0} for t in toks_text], "scores": [None] * len(toks_text),
                "mean": -9.0, "heard": heard, "ref": ref}
    path, lab, mean = ctc_align(em, ids)
    first, last, frame_lp = {}, {}, em[np.arange(len(path)), lab[path]]
    for t, st in enumerate(path):
        if st % 2 == 1:
            wi = owner[st // 2]
            if wi >= 0:
                first.setdefault(wi, t)
                last[wi] = t
    words, scores, prev_e = [], [], 0.0
    for wi, t in enumerate(toks_text):
        if wi in first:
            s, e = max(0.0, off + first[wi] * 0.02), max(0.0, off + (last[wi] + 1) * 0.02)
            scores.append(float(frame_lp[first[wi]:last[wi] + 1].mean()))
        else:  # a token with nothing to say sits at the end of the word before it, as Kokoro's glued tokens do
            s = e = prev_e
            scores.append(None)
        words.append({"w": t, "s": round(s, 3), "e": round(e, 3)})
        prev_e = e
    return {"words": words, "scores": scores, "mean": round(mean, 4), "heard": heard, "ref": ref}


def judge(al: dict, text: str, stall: float) -> list:
    """What is wrong with a take, as short phrases; [] when it passes. Four checks, each seen in the trial: a run of
    words the transcript does not hear (a skip), a run of words the alignment can barely place (a skip or a garble),
    a low score over the whole take, and a long silence inside it (a stall)."""
    bad = []
    if al["mean"] < GATE_MEAN:
        bad.append(f"low alignment score {al['mean']:.2f}")
    ref, heard = al["ref"], al["heard"]
    sm = difflib.SequenceMatcher(None, ref, heard, autojunk=False)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag in ("delete", "replace") and i2 - i1 >= GATE_SKIP and (j2 - j1) * 2 < (i2 - i1):
            bad.append(f"not heard: '{' '.join(ref[i1:i2])}'")
    toks = text.split()
    run = []
    for wi, t in enumerate(toks):
        sc = al["scores"][wi]
        if sc is not None and sc < (GATE_WORD if plain(t) else GATE_WORD_OTHER) and len(re.sub(r"\W", "", t)) >= 3:
            bad.append(f"not said: '{t}'")
        if sc is None or not plain(t):
            run = []
            continue
        run.append((wi, sc))
        if len(run) >= GATE_WIN:
            win = run[-GATE_WIN:]
            if sum(s for _, s in win) / GATE_WIN < GATE_WORDS:
                bad.append(f"garbled or skipped: '{' '.join(toks[w] for w, _ in win)}'")
                run = []
    if stall >= GATE_STALL_S:
        bad.append(f"stall of {stall:.1f} s")
    return list(dict.fromkeys(bad))


# ---------- the server

def gpu_free() -> bool:
    """The card is free when it has room for the model (about 1.4 GB measured) and is not busy."""
    if not (BUILDS["gpu"] / f"zonos3-server{EXE}").exists():
        return False
    try:
        r = subprocess.run(["nvidia-smi", "--query-gpu=memory.total,memory.used,utilization.gpu",
                            "--format=csv,noheader,nounits"], capture_output=True, text=True, timeout=10)
        tot, used, util = (float(x) for x in r.stdout.strip().splitlines()[0].split(","))
    except (OSError, ValueError, IndexError, subprocess.TimeoutExpired):
        return False
    return tot - used >= 2500 and util < 40


class Voice:
    """One ZONOS3 stock voice for one make.py run. Nothing heavy happens until a piece is not in the cache."""

    def __init__(self, name: str, cache: Path, sr: int, log_dir: Path):
        self.name, self.cache, self.sr, self.log_dir = name, cache, sr, log_dir
        self.proc, self.base, self.backend, self.speaker = None, None, None, None
        # audio_s: the narration this run hands make.py; take_audio_s: the speech it synthesized (failed takes too)
        self.t = {"server_start_s": 0.0, "synth_s": 0.0, "align_s": 0.0, "audio_s": 0.0, "take_audio_s": 0.0,
                  "takes": 0, "cached_takes": 0}
        self.retaken, self.failed, self.notes = [], [], []

    # -- server lifecycle
    def start(self) -> None:
        line = missing()
        if line:
            raise Unavailable(line)
        want = os.environ.get("EXPLAINER_ZONOS3_DEVICE", "").lower()  # gpu or cpu, to force a backend when measuring
        order = [want] if want in BUILDS else (["gpu", "cpu"] if gpu_free() else ["cpu"])
        errs = []
        for be in order:
            try:
                self._launch(be)
                return
            except NoSuchVoice:
                raise
            except Unavailable as exc:
                errs.append(str(exc))
                self.stop()
        raise Unavailable("voice zonos3: the server did not start: " + " | ".join(errs))

    def _launch(self, be: str) -> None:
        t0 = time.time()
        s = socket.socket()
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
        s.close()
        env = dict(os.environ)
        extra = [str(BUILDS[be] / "bin")] + ([str(CUDA_BIN)] if be == "gpu" and CUDA_BIN.exists() else [])
        env["PATH"] = os.pathsep.join(extra + [env.get("PATH", "")])  # the ggml DLLs (and CUDA's) live beside the exe
        if be == "cpu":
            env["ZAC_THREADS"] = "8"  # the decoder at 8 threads: 0.49x real time instead of 0.63x (trial)
        self.log_dir.mkdir(parents=True, exist_ok=True)
        log = open(self.log_dir / f"zonos3-server-{be}.log", "wb")
        self.proc = subprocess.Popen(
            [str(BUILDS[be] / f"zonos3-server{EXE}"), str(BACKBONE), f"--{be}", "--host", "127.0.0.1", "--port", str(port),
             "--batch", "1", "--zac-threads", "1", "--max", str(MAX_ROWS), "--tts-default-voices-dir", str(VOICES_DIR)],
            env=env, stdout=log, stderr=subprocess.STDOUT, cwd=str(TOOLS),
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        log.close()
        self.base, self.backend = f"http://127.0.0.1:{port}", be
        while True:
            if self.proc.poll() is not None:
                raise Unavailable(f"{be} server exited with code {self.proc.returncode} (log: {self.log_dir / f'zonos3-server-{be}.log'})")
            try:
                if json.loads(urllib.request.urlopen(self.base + "/v2/health", timeout=2).read()).get("status") == "ok":
                    break
            except (OSError, ValueError):
                pass
            if time.time() - t0 > 120:
                raise Unavailable(f"{be} server not ready after 120 s")
            time.sleep(0.25)
        speakers = json.loads(urllib.request.urlopen(self.base + "/v2/speakers", timeout=10).read())["speakers"]
        hit = [x for x in speakers if x.get("is_default") and x["label"].lower().split()[0] == self.name]
        if not hit:
            names = sorted({x["label"].split()[0] for x in speakers if x.get("is_default")})
            self.stop()
            raise NoSuchVoice(f"voice zonos3: no stock voice '{self.name}' (have: {', '.join(names)})")
        self.speaker = hit[0]["id"]
        self.t["server_start_s"] += round(time.time() - t0, 2)

    def stop(self) -> None:
        """Stop the server this run started, by its own process handle (never by name: other runs share the machine)."""
        p, self.proc = self.proc, None
        if p and p.poll() is None:
            p.terminate()
            try:
                p.wait(15)
            except subprocess.TimeoutExpired:
                p.kill()
                p.wait(5)

    def generate(self, text: str, seed: int) -> np.ndarray:
        if self.proc is None:
            self.start()
        body = {"text": text, "speaker_embedding_id": self.speaker, "speaker_mode": "embedding", "seed": seed,
                "stream": False, "format": "pcm"}
        req = urllib.request.Request(self.base + "/v2/generate", data=json.dumps(body).encode("utf-8"),
                                     headers={"Content-Type": "application/json"})
        t0 = time.time()
        try:
            r = urllib.request.urlopen(req, timeout=900)
            data = r.read()
        except urllib.error.HTTPError as exc:
            raise Unavailable(f"voice zonos3: the server refused a piece ({exc.code}: {exc.read()[:300]!r})")
        self.t["synth_s"] += time.time() - t0
        return np.frombuffer(data, dtype="<f4").copy()

    # -- one piece, one seed
    def take(self, text: str, seed: int) -> dict:
        key = hashlib.sha1(f"zonos3|{self.name}|{seed}|{text}".encode("utf-8")).hexdigest()[:16]
        wav_p, js_p = self.cache / f"z-{key}.wav", self.cache / f"z-{key}.json"
        if wav_p.exists() and js_p.exists():
            self.t["cached_takes"] += 1
            a, _ = sf.read(wav_p, dtype="float32")
            return {**json.loads(js_p.read_text("utf-8")), "audio": a}
        raw = self.generate(text, seed)
        cut, stall = trim(raw, Z_SR)
        a = ffmpeg_f32(cut, Z_SR, self.sr) if len(cut) else np.zeros(int(0.1 * self.sr), "float32")
        before = lufs(a, self.sr)
        gain = 10 ** ((TARGET_LUFS - before) / 20) if before is not None else 1.0
        peak = float(np.abs(a).max()) if len(a) else 0.0
        limited = peak * gain > PEAK_MAX
        if limited:
            gain = PEAK_MAX / peak
        a = (a * gain).astype("float32")
        t0 = time.time()
        al = align(a, self.sr, text)
        self.t["align_s"] += time.time() - t0
        bad = judge(al, text, stall)
        info = {"seed": seed, "backend": self.backend, "words": al["words"], "scores": al["scores"], "mean": al["mean"],
                "bad": bad, "lufs_before": before, "gain_db": round(20 * np.log10(gain), 2), "limited": limited,
                "heard": " ".join(al["heard"]), "stall_s": stall}
        sf.write(wav_p, a, self.sr)
        js_p.write_text(json.dumps(info), "utf-8")
        self.t["takes"] += 1
        self.t["take_audio_s"] += len(a) / self.sr
        return {**info, "audio": a}

    # -- one scene
    def synth(self, text: str, n: int):
        """A scene's spoken text -> (audio at the engine's rate, words with times in seconds of that audio), as make.py's
        Kokoro synth returns them. Each piece is taken with SEED0, then again with the next seed while the gate fails."""
        parts, words, pos = [np.zeros(int(HEAD_S * self.sr), "float32")], [], HEAD_S
        for k, piece in enumerate(pieces(text), 1):
            takes = []
            for r in range(RETAKES + 1):
                tk = self.take(piece, SEED0 + r)
                takes.append(tk)
                if not tk["bad"]:
                    break
            best = takes[-1] if not takes[-1]["bad"] else max(takes, key=lambda x: x["mean"])
            where = {"scene": n, "piece": k, "words": len(piece.split()), "text": piece[:60] + ("..." if len(piece) > 60 else "")}
            if len(takes) > 1:
                self.retaken.append({**where, "takes": [{"seed": x["seed"], "bad": x["bad"]} for x in takes],
                                     "kept_seed": best["seed"]})
            if best["bad"]:
                self.failed.append({**where, "kept_seed": best["seed"], "bad": best["bad"]})
            if best.get("limited"):
                self.notes.append(f"scene {n} piece {k}: gain held back to keep the peak under -1 dBFS")
            if k > 1:
                parts.append(np.zeros(int(GAP_S * self.sr), "float32"))
                pos += GAP_S
            a = best["audio"]
            words += [{"w": w["w"], "s": round(pos + w["s"], 3), "e": round(pos + w["e"], 3)} for w in best["words"]]
            parts.append(a)
            pos += len(a) / self.sr
        parts.append(np.zeros(int(TAIL_S * self.sr), "float32"))
        audio = np.concatenate(parts).astype("float32")
        self.t["audio_s"] += len(audio) / self.sr
        return audio, words

    def stats(self) -> dict:
        """The report's "voice" entry: the backend, the time each stage took, every retaken piece and every piece that
        still fails."""
        out = {"voice": f"zonos3:{self.name}", "backend": self.backend or "none (every take was cached)",
               **{k: round(v, 2) if isinstance(v, float) else v for k, v in self.t.items()}}
        if self.t["take_audio_s"]:  # synthesis and alignment per second of speech made (the server start is apart)
            out["seconds_per_audio_second"] = round((self.t["synth_s"] + self.t["align_s"]) / self.t["take_audio_s"], 3)
        out["retaken"] = self.retaken
        out["failed"] = self.failed
        if self.notes:
            out["notes"] = self.notes
        return out
