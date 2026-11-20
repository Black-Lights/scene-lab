"""
@file render.py
@description Everything make.py does with the Remotion CLI and ffmpeg once the props exist (v0.3,
  docs/v0.3-architecture.md section 3):
  - one function runs Remotion, streams its output to the terminal and lifts every "[kit]" line into a Channel
    (the error channel: kit code and the scene error boundary write console.error("[kit] scene <n> <Name>: ..."));
  - the bundle cache: "remotion bundle" once per state of the code, into build/bundle-<hash>; the public folder is
    mirrored into the bundle before every render or still, so an edit of the spec alone never bundles;
  - sound outside the picture: Remotion renders muted, the raw render is kept as build/render-<mode>-<key>.mp4 and
    reused while nothing visible changed, and ffmpeg muxes the sound in the final encode.
  Where console.error reaches the CLI (measured on Remotion 4.0.499, output piped): "render" prints it at every
  log level, as "Tab n, file:line  message". "still" prints it at no level through its own logger (it only feeds a
  terminal progress display), so stills run with --log=verbose, where Chrome's own stderr carries the console, and
  this module shows only what matters from that flood.
@see make.py (the only caller), custom.py (what runs before a render), src/custom.tsx (writes the [kit] lines)
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import time
from collections import deque
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CLI = ROOT / "node_modules" / "@remotion" / "cli" / "remotion-cli.js"
ANSI = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")
KIT = re.compile(r"\[kit\]\s*(.*)")
CHROME_TAIL = re.compile(r"\"?,\s*source:\s*\S+\s*\(\d+\)\s*$")  # how Chrome's stderr ends a console line
PROGRESS = re.compile(r"^(Rendered|Encoded|Stitched|Bundled|Copied)\b\D*(\d+)\s*/\s*(\d+)")
NOISE = re.compile(r"INFO:CONSOLE|delayRender\(\)|^\s*$")  # verbose lines that say nothing about a failure
SOUND_KINDS = ("sound", "music")
FILE_NAME = re.compile(r"\.[A-Za-z0-9]{2,5}$")  # a string that ends like a file name is looked up in the public folder
# The end of the filter chain of every ffmpeg re-encode (here and page.py). ffmpeg 7.1 takes the colour tags of an
# encode from its frames, so -color_primaries and -color_trc as output options alone left both "unknown"; setparams
# writes them onto the frames. Limited range and yuv420p first, so the tags describe the pixels.
BT709_VF = "scale=out_range=tv,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv"


class Failed(RuntimeError):
    """Remotion or ffmpeg stopped with an error; the message carries the last lines it printed."""


class Channel:
    """The error channel. `errors`: a scene fell back to the plain card ("[kit] scene <n> ..."); `warnings`: any
    other [kit] line. A scene that throws writes its line on every frame, so each message is kept once."""

    def __init__(self) -> None:
        self.errors: list = []
        self.warnings: list = []

    def take(self, text: str) -> bool:
        """Record one [kit] message; True when it is new."""
        text = text.strip()
        into = self.errors if re.match(r"scene\s+\d+\b", text) else self.warnings
        if not text or text in into:
            return False
        into.append(text)
        return True

    def merge(self, errors: list, warnings: list) -> None:
        for x in errors:
            self.take(x)
        for x in warnings:
            self.take(x)


def remotion(args: list, chan: Channel | None = None, quiet: bool = False) -> None:
    """Run the Remotion CLI from the repo root. Its output is streamed to the terminal: a line that repeats is shown
    once and progress is thinned to every tenth, so a long render stays readable. Every line that contains "[kit]"
    goes to `chan`. With `quiet` (stills, which must run verbose to carry the console) only [kit] lines are shown.
    A non-zero exit raises Failed with the last lines."""
    cmd = [shutil.which("node") or "node", str(CLI), *[str(a) for a in args]]
    p = subprocess.Popen(cmd, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL,
                         text=True, encoding="utf-8", errors="replace", bufsize=1)
    seen, kit, tenth, tail = set(), set(), {}, deque(maxlen=30)
    assert p.stdout is not None
    for raw in p.stdout:
        line = ANSI.sub("", raw.rstrip("\r\n"))
        m = KIT.search(line)
        if m:
            msg = CHROME_TAIL.sub("", m.group(1)).strip()
            if chan is not None:
                chan.take(msg)
            if msg not in kit:  # a scene that throws says so on every frame: shown once
                kit.add(msg)
                print(f"[kit] {msg}", flush=True)
            continue
        if not NOISE.search(line):
            tail.append(line)
        if quiet:
            continue
        g = PROGRESS.match(line.strip())
        if g:  # "Rendered 431/450": one line per frame is too much for a long video
            done, of = int(g.group(2)), max(1, int(g.group(3)))
            step = 10 if done >= of else done * 10 // of
            if tenth.get(g.group(1)) == step:
                continue
            tenth[g.group(1)] = step
        else:
            same = re.sub(r"\bTab \d+", "Tab", line)  # the same message from another browser tab is the same message
            if same in seen:
                continue
            seen.add(same)
        print(line, flush=True)
    code = p.wait()
    if code:
        raise Failed(f"remotion {args[0]} failed (exit {code}): " + " | ".join(x.strip() for x in list(tail)[-12:] if x.strip())[:1500])


def ffmpeg(args: list) -> None:
    r = subprocess.run([shutil.which("ffmpeg") or "ffmpeg", "-y", "-v", "error", *[str(a) for a in args]],
                       capture_output=True, text=True, encoding="utf-8", errors="replace", stdin=subprocess.DEVNULL)
    if r.returncode:
        raise Failed(f"ffmpeg failed (exit {r.returncode}): {(r.stderr or r.stdout or '').strip()[-800:]}")


# ---------------------------------------------------------------- one run per video folder
def _started(pid: int) -> float | None:
    """When the process `pid` started (seconds, any fixed origin), or None when no such process is running. The start
    time tells a live run from a new process that got the same id after the run died. On Windows os.kill(pid, 0)
    would end the process, so the state is asked of the system through ctypes."""
    if os.name == "nt":
        import ctypes
        from ctypes import wintypes
        k = ctypes.WinDLL("kernel32", use_last_error=True)
        k.OpenProcess.restype = wintypes.HANDLE
        h = k.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
        if not h:
            return None
        try:
            code = wintypes.DWORD()
            if not k.GetExitCodeProcess(h, ctypes.byref(code)) or code.value != 259:  # 259: STILL_ACTIVE
                return None
            t = [wintypes.FILETIME() for _ in range(4)]
            if not k.GetProcessTimes(h, *[ctypes.byref(x) for x in t]):
                return 0.0
            return ((t[0].dwHighDateTime << 32) | t[0].dwLowDateTime) / 1e7
        finally:
            k.CloseHandle(h)
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return None
    except PermissionError:
        pass
    try:
        return float(Path(f"/proc/{pid}/stat").read_text().rsplit(")", 1)[1].split()[19])
    except (OSError, IndexError, ValueError):
        return 0.0


def lock(build: Path, what: str) -> Path:
    """Take build/.lock for the length of this run -> the lock file, which the caller removes when it ends. Two runs
    on one video would bundle into the same folder, prune each other's bundles and write the same raw render. A
    lock whose process is gone (a crash, a closed terminal, a power loss) is taken over. When a live run holds it,
    this raises Failed with one line that says which process holds it and since when."""
    path = build / ".lock"
    me = {"pid": os.getpid(), "started": _started(os.getpid()), "since": time.strftime("%H:%M:%S"), "what": what}
    for _ in range(3):
        try:
            fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        except FileExistsError:
            try:
                held = json.loads(path.read_text("utf-8"))
                pid = int(held["pid"])
            except (OSError, ValueError, KeyError, TypeError):
                held, pid = {}, 0  # half written by a run that died at that instant, or not ours: stale
            now = _started(pid) if pid else None
            alive = now is not None and (held.get("started") in (None, 0.0) or now == 0.0 or abs(now - held["started"]) < 1)
            if alive and pid != os.getpid():
                raise Failed(f"another make.py run (process {pid}, {held.get('what', 'a run')}, since {held.get('since', '?')}) "
                             f"is using {build.parent.name}; wait for it to end, or stop that process")
            try:
                path.unlink()  # stale: its process is gone
            except FileNotFoundError:
                pass
            except PermissionError:
                time.sleep(0.2)  # another run is taking it over at this instant
            continue
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(me, f)
        return path
    raise Failed(f"could not take the lock file {path}")


def unlock(path: Path) -> None:
    """Remove the lock if this process still holds it."""
    try:
        if json.loads(path.read_text("utf-8")).get("pid") == os.getpid():
            path.unlink()
    except (OSError, ValueError):
        pass


# ---------------------------------------------------------------- the bundle cache
# Module specifiers in scene code: import ... from '...', export ... from '...', import '...', import('...'),
# require('...'). Only relative ones are followed: '@kit' is src/kit, and a bare name is a package (package-lock).
IMPORT = re.compile(r"""(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"](\.{1,2}/[^'"\n]*)['"]""")
RESOLVE = ("", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json")
CODE = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}


def _resolve(base: Path, spec: str) -> Path | None:
    """The file a relative specifier names, the way webpack and tsc find it: as written, with an extension, or the
    index file of a folder."""
    p = (base / spec).resolve()
    for ext in RESOLVE:
        q = p.with_name(p.name + ext) if ext else p
        if q.is_file():
            return q
    if p.is_dir():
        for ext in RESOLVE[1:]:
            if (p / f"index{ext}").is_file():
                return p / f"index{ext}"
    return None


def imported(starts: list) -> list:
    """Every file the given code files reach through relative imports, followed file by file (a helper in
    videos/<slug>/lib/, a shared folder beside the videos, a picture or a JSON file a scene imports). The type check
    sees these files too, but it can be skipped (--no-typecheck); this walk costs milliseconds and always runs."""
    seen: set = set()
    todo = [p.resolve() for p in starts]
    while todo:
        p = todo.pop()
        if p in seen or "node_modules" in p.parts:
            continue
        seen.add(p)
        if p.suffix.lower() not in CODE:
            continue
        try:
            text = p.read_text("utf-8", errors="replace")
        except OSError:
            continue
        for m in IMPORT.finditer(text):
            q = _resolve(p.parent, m.group(1))
            if q is not None and q not in seen:
                todo.append(q)
    return sorted(seen)


def code_hash(vdir: Path, entry: str) -> str:
    """One hash over everything a bundle is made of: the engine (src), this video's scene code and data (scenes/,
    data/), every other file that code imports by a relative path (anywhere, followed import by import), its entry,
    and what decides how they are built (package-lock.json, remotion.config.ts, tsconfig.json). The spec is not in
    it: an edit of the spec alone keeps the bundle."""
    files = [ROOT / "package-lock.json", ROOT / "remotion.config.ts", ROOT / "tsconfig.json"]
    files += sorted(p for p in (ROOT / "src").rglob("*") if p.is_file())
    own: list = []
    for sub in ("scenes", "data"):
        if (vdir / sub).is_dir():
            own += sorted(p for p in (vdir / sub).rglob("*") if p.is_file())
    e = Path(entry)
    files += own + [e if e.is_absolute() else ROOT / e]
    have = {p.resolve() for p in files}
    files += [p for p in imported(own) if p not in have]  # in this order a video that imports nothing else keeps its hash
    h = hashlib.sha1()
    for p in files:
        try:
            name = Path(os.path.relpath(p, ROOT)).as_posix()
        except ValueError:  # a file on another drive has no relative path
            name = p.as_posix()
        h.update(name.encode("utf-8") + b"\0")
        try:
            h.update(p.read_bytes())
        except OSError:  # a file another author is saving at this instant: its name alone goes into the hash
            pass
        h.update(b"\0")
    return h.hexdigest()[:12]


def bundle(vdir: Path, build: Path, entry: str, pub: Path, chan: Channel | None = None) -> tuple:
    """-> (bundle folder, code hash, note). Bundles only when no finished bundle of this code exists; keeps the
    bundle used before this one (two states of the code are often compared) and removes older ones."""
    code = code_hash(vdir, entry)
    out, note = build / f"bundle-{code}", "reused"
    done = out / ".complete"
    if not done.exists():
        shutil.rmtree(out, ignore_errors=True)  # a bundle that was interrupted
        t0 = time.time()
        remotion(["bundle", entry, f"--out-dir={out}", f"--public-dir={pub}", "--log=error"], chan)
        note = f"built in {time.time() - t0:.0f} s"
    done.write_text(code, "utf-8")  # written last and touched on every use: its time is the last use
    others = [d for d in build.glob("bundle*") if d.is_dir() and d != out]
    others.sort(key=lambda d: (d / ".complete").stat().st_mtime if (d / ".complete").exists() else 0.0, reverse=True)
    for d in others[1:] + [d for d in others[:1] if not (d / ".complete").exists()]:
        shutil.rmtree(d, ignore_errors=True)
    return out, code, note


def mirror(pub: Path, bundle_dir: Path, skip: tuple = ()) -> int:
    """Make <bundle>/public equal to build/public: copy what is new or changed, remove what is gone. A bundle copies
    the public folder only when it is built, so this runs before every render and still. `skip`: files the picture
    never reads (the sound, which is muxed outside it). -> number of files copied."""
    dst = bundle_dir / "public"
    want = {p.relative_to(pub).as_posix(): p for p in pub.rglob("*") if p.is_file()}
    for name in skip:
        want.pop(name, None)
    copied = 0
    for name, p in want.items():
        d, s = dst / name, p.stat()
        if d.exists() and d.stat().st_size == s.st_size and abs(d.stat().st_mtime - s.st_mtime) < 0.002:
            continue
        d.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(p, d)  # copy2 keeps the modification time, which is how the next run knows it is unchanged
        copied += 1
    if dst.is_dir():
        for d in dst.rglob("*"):
            if d.is_file() and d.relative_to(dst).as_posix() not in want:
                d.unlink()
    return copied


def still(bundle_dir: Path, composition: str, png: Path, props_file: Path, frame: int, chan: Channel | None = None, gl: bool = True) -> None:
    """One PNG of one frame of a composition. Verbose on purpose: see the file header."""
    remotion(["still", bundle_dir, composition, png, f"--props={props_file}", f"--frame={frame}", "--log=verbose",
              *(["--gl=angle"] if gl else [])], chan, quiet=True)


# ---------------------------------------------------------------- the render cache and the final encode
def picture_props(props: dict) -> dict:
    """The props without anything that is only heard: the sound file, the music, every "sfx" block, and assets of
    a sound kind. Two runs with equal picture props draw the same frames."""
    def clean(node, top: bool = False):
        if isinstance(node, dict):
            out = {}
            for k, v in node.items():
                if k == "sfx" or (top and k in ("audio", "music")):
                    continue
                if k == "assets" and isinstance(v, dict):
                    v = {n: a for n, a in v.items() if not (isinstance(a, dict) and a.get("kind") in SOUND_KINDS)}
                    if not v:  # only sounds, or none: the same picture as no block, so the first sound costs no render
                        continue
                out[k] = clean(v)
            return out
        return [clean(x) for x in node] if isinstance(node, list) else node
    return clean(props, True)


def named_files(node, pub: Path, acc: set | None = None) -> set:
    """Every file of the public folder that the props name (pictures, fonts, models, clips), as relative paths. A
    .gltf brings the files beside it, which it loads by name (its own folder in the public folder holds only the
    files it names: assets.gltf_files)."""
    acc = set() if acc is None else acc
    if isinstance(node, dict):
        for v in node.values():
            named_files(v, pub, acc)
    elif isinstance(node, list):
        for v in node:
            named_files(v, pub, acc)
    elif isinstance(node, str) and len(node) < 260 and FILE_NAME.search(node) and ":" not in node and "\n" not in node:
        try:
            p = pub / node
            if p.is_file():
                acc.add(node)
                if p.suffix.lower() == ".gltf":
                    acc.update(q.relative_to(pub).as_posix() for q in p.parent.rglob("*") if q.is_file())
        except (OSError, ValueError):
            pass
    return acc


def render_key(props: dict, code: str, pub: Path, mode: str, flags: list) -> str:
    """What a raw render depends on: the picture props, the code, the public files the props name, the mode and
    the render flags."""
    pic = picture_props(props)
    h = hashlib.sha1(json.dumps([pic, code, mode, flags], sort_keys=True, ensure_ascii=False).encode("utf-8"))
    for name in sorted(named_files(pic, pub)):
        h.update(name.encode("utf-8") + b"\0" + hashlib.sha1((pub / name).read_bytes()).digest())
    return h.hexdigest()[:12]


def render(bundle_dir: Path, props_file: Path, props: dict, code: str, pub: Path, build: Path, mode: str, flags: list,
           chan: Channel) -> tuple:
    """The muted raw render of the whole video -> (file, {"render_s", "reused"}). It is kept as
    build/render-<mode>-<key>.mp4 with the [kit] lines it produced beside it, and reused when the key is unchanged,
    so a change of sound alone costs a mix and a remux. One raw render is kept per mode."""
    key = render_key(props, code, pub, mode, flags)
    raw = build / f"render-{mode}-{key}.mp4"
    side = raw.with_suffix(".json")
    if raw.exists() and side.exists():
        kept = json.loads(side.read_text("utf-8"))
        chan.merge(kept.get("errors") or [], kept.get("warnings") or [])  # a kept render of a scene that fell back still says so
        return raw, {"render_s": 0, "reused": True}
    part, own, t0 = build / f"render-{mode}-{key}.part.mp4", Channel(), time.time()
    try:
        remotion(["render", bundle_dir, "Explainer", part, f"--props={props_file}", "--muted", "--log=warn", *flags], own)
    finally:
        chan.merge(own.errors, own.warnings)
    for old in [*build.glob(f"render-{mode}-*.mp4"), *build.glob(f"render-{mode}-*.json"), build / "render.mp4"]:
        if old != part:
            old.unlink(missing_ok=True)
    os.replace(part, raw)
    info = {"render_s": round(time.time() - t0), "reused": False}
    side.write_text(json.dumps({"errors": own.errors, "warnings": own.warnings, **info}, ensure_ascii=False), "utf-8")
    return raw, info


def encode(raw: Path, sound: Path, final: Path, mode: str, mixed: bool, seconds: float) -> None:
    """The final MP4: the raw picture with the sound muxed in. Narration alone gets the loudness filter it always
    had (-16 LUFS); a finished mix is already levelled, so it only passes a limiter. The 1080p file is re-encoded
    small for flat drawings; preview and master keep Remotion's video stream."""
    level = "alimiter=limit=0.841:level=false" if mixed else "loudnorm=I=-16:TP=-1.5:LRA=11"
    # BT.709 on every file (section 3). Remotion's --color-space=bt709 converts with the 709 matrix but tags only the
    # matrix, so the full tags are written here: by the re-encode, or into the copied stream's own header (no re-encode)
    tags = ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"]
    video = (["-vf", BT709_VF, "-c:v", "libx264", "-preset", "slow", "-crf", "22", "-tune", "animation", "-pix_fmt", "yuv420p", *tags] if mode == "hd"
             else ["-c:v", "copy", "-bsf:v", "h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1", *tags])
    ffmpeg(["-i", raw, "-i", sound, "-map", "0:v:0", "-map", "1:a:0", *video,
            "-af", f"aformat=channel_layouts=stereo,{level}", "-c:a", "aac", "-b:a", "160k", "-ar", "48000",
            "-t", f"{seconds:.4f}", "-movflags", "+faststart", final])
