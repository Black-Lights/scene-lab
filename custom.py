"""
@file custom.py
@description Scene code written per video (v0.3, docs/v0.3-architecture.md section 3). A video folder may hold
  React components in scenes/*.tsx; a spec scene uses one with {"type": "custom", "component": "Name"} or through a
  world declared under "worlds". prepare() gets them ready for a render:
  - it writes the video's own Remotion entry (build/entry.tsx registers the scenes by name, then the engine's Root);
  - it validates "worlds" and the kit's blocks in every free and world visual (tracks, places, beats, set, shots,
    labels, assets, sfx): known keys only, value types, and every name that crosses from the spec to code;
  - it lints the scene code for anything that is not a pure function of time;
  - it type-checks the scene code against the engine.
  Whatever would make a broken video is returned as "errors" and make.py stops before the render; matters of style
  go to the warnings. The tables below are the whole vocabulary: a new kit key is one more name in one tuple.
@see src/custom.tsx (the Remotion side), cues.py (cue times), make.py (calls prepare)
"""
from __future__ import annotations

import difflib
import json
import os
import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# ---------------------------------------------------------------- lint
# What makes a picture depend on anything but its time. A line that carries "deterministic-ok" is exempt.
# Each message names what to use in its place.
# Every message names something that exists today: @kit has no seeded random helper yet (random.ts is empty) and no
# loader hook (assets are declared in the spec and read with useAsset).
RANDOM = ("vary by index instead, with a fixed table in the video's data folder or a small arithmetic hash of the "
          "index written in the scene file, so the same time draws the same picture")
ASSET = "declare the file in the spec's \"assets\" block and read it with useAsset(name) from @kit"
BANNED = (
    (r"\bMath\.random\b", f"Math.random: {RANDOM}"),
    (r"\bDate\.now\b|\bnew\s+Date\s*\(", "the wall clock: read scene time with useClock(), or world time with useWorld().T"),
    (r"\bperformance\.now\b", "performance.now: read scene time with useClock()"),
    (r"\bset(?:Timeout|Interval|Immediate)\b", "a timer: a render has no real time; derive the value from useClock()"),
    (r"\brequestAnimationFrame\b", "requestAnimationFrame: no loop runs in a render; derive the value from useClock()"),
    (r"\buseFrame\b", "react-three-fiber's useFrame: its loop does not run in a render; read useClock() and set props"),
    (r"\bTHREE\.Clock\b|\bnew\s+Clock\s*\(", "THREE.Clock: read scene time with useClock()"),
    (r"\buseCurrentFrame\b", "useCurrentFrame: scene code works in seconds; read useClock() (only the kit reads the frame)"),
    (r"<(?:\w+\.)*(?:Sequence|Loop|Freeze)\b", "a Remotion time container: show and hide with times instead, "
                                               "step(t, at), prog(t, at, over), or the at and until props of kit parts"),
    (r"\bspring\s*\(", "spring(): use tween(t, from, keys) or prog(t, at, over, ease) with a named ease"),
    (r"\buseLoader\s*\(|\bTextureLoader\b|\bGLTFLoader\b", f"a loader of its own: {ASSET}; the engine loads it before the "
                                                         "scene mounts (a new kind of file gets a loader with registerLoader(kind, load))"),
    (r"(?<![\w.])fetch\s*\(|\b(?:window|globalThis|self)\.fetch\s*\(", "fetch(): import data from the video's data folder "
                                                                      f"(import rows from '../data/rows.json'), or {ASSET}"),
    (r"\bcrypto\.(?:getRandomValues|randomUUID)\b", f"randomness: {RANDOM}"),
    (r"\buseEffect\s*\(", "useEffect: it runs after the frame is taken; change three objects during render or in "
                          "useLayoutEffect, and derive values from useClock()"),
    (r"<(?:\w+\.)*Suspense\b", f"<Suspense>: the engine loads every declared asset before a scene mounts; {ASSET}"),
    (r"\bdelayRender\b", f"delayRender: the engine already holds the frame until every declared asset is loaded; {ASSET}"),
)
# Remotion's <Series> shares its name with the kit's chart series, so it is banned only where it is Remotion's.
SERIES = "Remotion's <Series>: show and hide with times instead, step(t, at), prog(t, at, over), or the at and until props"
ADVICE = (
    (r"\binterpolate\s*\(", "interpolate(): tween(t, from, keys), mix(a, b, p) and prog(t, at, over) from @kit work in seconds"),
    (r"\bfps\b", "fps: scene code works in seconds; frames are the engine's business"),
    (r"\b(?:transition|animation)(?:[A-Z][A-Za-z]*)?\s*:", "a CSS transition or animation: CSS time does not run in a "
                                                          "render; compute the style from useClock()"),
)
GL = re.compile(r"from\s+['\"](?:three|@react-three/|@remotion/three)|<Stage\b|\bThreeCanvas\b")

# ---------------------------------------------------------------- the spec's vocabulary (section 2)
EASES = ("enter", "exit", "move", "linear")
PRESETS = ("establish", "top", "side", "front", "low", "close")
LABEL_SIZES = ("s", "m", "l")
SIDES = ("left", "right", "top", "bottom")
ASSET_KINDS = ("photo", "illustration", "vector", "video", "model", "hdri", "sound", "music", "icon", "lottie")
TIME = ("cue", "nth", "at", "over", "until")
RESERVED = ("type", "component", "world", "title", "tracks", "places", "beats", "set", "shots", "labels", "assets", "sfx", "props")
KEYS = {
    "world": ("component", "tracks", "places", "assets", "props"),
    "place": ("pos", "size"),
    "beat": ("cue", "nth", "at"),
    "set": ("key", "keys", "to", *TIME, "ease", "stagger"),
    "shot": (*TIME, "ease", "frame", "target", "pos", "preset", "az", "el", "dist", "fov", "pad", "fit", "orbit"),
    "label": ("on", "pos", "text", "sub", "size", "side", *TIME, "leader", "id"),
    "sfx": ("cue", "nth", "at", "sound", "gain", "offset"),
    "asset": ("q", "query", "kind", "pick", "provider", "id", "file"),
}
NAME = re.compile(r"[a-z0-9][a-z0-9_-]*(?:\.[a-z0-9_-]+)*")


def rel(p: Path, start: Path) -> str:
    return Path(os.path.relpath(p, start)).as_posix()


def components(vdir: Path) -> dict:
    """Name -> file for every scene component: the .tsx files directly in <video>/scenes (helpers go in subfolders)."""
    d = vdir / "scenes"
    return {f.stem: f for f in sorted(d.glob("*.tsx"))} if d.is_dir() else {}


def sources(vdir: Path) -> list:
    d = vdir / "scenes"
    return sorted(p for p in d.rglob("*") if p.suffix in (".ts", ".tsx")) if d.is_dir() else []


def _code(text: str) -> str:
    """Source with comments blanked (line count kept), so a banned name inside a comment is not reported."""
    text = re.sub(r"/\*.*?\*/", lambda m: re.sub(r"[^\n]", " ", m.group(0)), text, flags=re.S)
    return re.sub(r"(?<![:'\"`\\])//[^\n]*", "", text)


def _from_remotion(code: str, name: str) -> list:
    """The local names under which a file imports `name` from 'remotion' (import { Series as S } -> S)."""
    out = []
    for m in re.finditer(r"import\s+(?:type\s+)?(?:[\w$]+\s*,\s*)?\{([^}]*)\}\s*from\s*['\"]remotion['\"]", code):
        for part in m.group(1).split(","):
            bits = part.replace("type ", " ").split()
            if bits and bits[0] == name:
                out.append(bits[-1])
    return out


def lint(paths: list, vdir: Path) -> tuple:
    """-> (errors, warnings), one line per finding: file, line number, what it is and what to use in its place."""
    errors, warns = [], []
    for p in paths:
        raw = p.read_text("utf-8")
        code = _code(raw)
        series = _from_remotion(code, "Series")
        rules = BANNED + (((r"<(?:" + "|".join(map(re.escape, series)) + r")\b", SERIES),) if series else ())
        for i, (line, src) in enumerate(zip(code.splitlines(), raw.splitlines()), 1):
            if "deterministic-ok" in src:
                continue
            errors += [f"{rel(p, vdir)}:{i}: {why}" for pat, why in rules if re.search(pat, line)]
            warns += [f"{rel(p, vdir)}:{i}: {why}" for pat, why in ADVICE if re.search(pat, line)]
        # Two Stages in one scene are two WebGL contexts, which the kit refuses at render time. Only a warning here:
        # a file may write two <Stage> of which one is ever mounted (a ternary), which the text alone cannot tell.
        stages = [i for i, line in enumerate(code.splitlines(), 1) if re.search(r"<Stage\b", line)]
        hits = sum(len(re.findall(r"<Stage\b", line)) for line in code.splitlines())
        if hits > 1:
            warns.append(f"{rel(p, vdir)}:{stages[1] if len(stages) > 1 else stages[0]}: this file writes <Stage> {hits} "
                         f"times (line{'s' if len(stages) > 1 else ''} {', '.join(map(str, stages))}): a second Stage "
                         f"mounted in one scene turns the scene into its error card; draw both parts in one Stage, or "
                         f"put one on a <Board>, which can share a scene with a Stage")
    return errors, warns


# ---------------------------------------------------------------- validation
def _num(x) -> bool:
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def _vec(x, sizes=(2, 3)) -> bool:
    return isinstance(x, list) and len(x) in sizes and all(_num(a) for a in x)


def _kind(v) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true or false"
    if _num(v):
        return "a number"
    if isinstance(v, str):
        return "text"
    if isinstance(v, list):
        return f"a list of {len(v)}"
    return "an object"


def _fits(initial, to) -> bool:
    """May a track declared with `initial` move to `to`? Same kind of value; a track declared null takes anything."""
    if initial is None:
        return True
    if to is None:
        return isinstance(initial, str)
    if isinstance(initial, bool) or isinstance(to, bool):  # a switch may be written true, false, 0 or 1
        return all(isinstance(x, bool) or _num(x) for x in (initial, to))
    return _kind(initial) == _kind(to)


def _declared(key: str, tracks: dict) -> list:
    """The declared initial values a set key stands for; empty when no declared track or family covers it."""
    if key in tracks:
        return [tracks[key]]
    fams = sorted((t for t in tracks if t.endswith(".*") and key.startswith(t[:-1])), key=len, reverse=True)
    if fams:
        return [tracks[fams[0]]]  # the closest family: "cell.cold.*" before "cell.*"
    if key.endswith(".*"):
        return [v for t, v in tracks.items() if t.startswith(key[:-1])]
    return []


def _place_ok(name: str, places: dict) -> bool:
    """A place, a group of places ("cell" over "cell.3") or a part of one ("bench.left" under "bench")."""
    return any(p == name or p.startswith(name + ".") or name.startswith(p + ".") for p in places)


def _hint(word: str, known, cutoff: float = 0.6) -> str:
    close = difflib.get_close_matches(str(word), [str(k) for k in known], 1, cutoff)
    return f" (did you mean \"{close[0]}\"?)" if close else ""


class _Check:
    """Collects what is wrong with one spec: errors stop the render, warnings are matters of style."""

    def __init__(self, comps: dict):
        self.comps, self.errors, self.warns = comps, [], []

    def err(self, where: str, msg: str) -> None:
        self.errors.append(f"{where}: {msg}")

    def warn(self, where: str, msg: str) -> None:
        self.warns.append(f"{where}: {msg}")

    def keys(self, where: str, node: dict, table: str) -> None:
        for k in node:
            if k not in KEYS[table]:
                self.err(where, f"unknown key \"{k}\"{_hint(k, KEYS[table]) or ' (known: ' + ', '.join(KEYS[table]) + ')'}")

    def one_of(self, where: str, key: str, node: dict, allowed: tuple) -> None:
        if key in node and node[key] not in allowed:
            self.err(where, f"\"{key}\": \"{node[key]}\" is not one of {', '.join(allowed)}{_hint(node[key], allowed)}")

    def number(self, where: str, node: dict, *names: str, least: float | None = None) -> None:
        for k in names:
            if k in node and not _num(node[k]):
                self.err(where, f"\"{k}\" must be a number, not {_kind(node[k])}")
            elif k in node and least is not None and node[k] < least:
                self.err(where, f"\"{k}\" must be {least:g} or more, not {node[k]}")

    def name(self, where: str, name, what: str, family: bool = False) -> None:
        base = name[:-2] if family and isinstance(name, str) and name.endswith(".*") else name
        if not isinstance(name, str) or not NAME.fullmatch(base):
            self.warn(where, f"{what} \"{name}\" is not a lower-case dot path (like gate.open)")

    def time(self, where: str, e: dict) -> None:
        """The time words: "cue" and "until" are phrases, "at" and "over" are seconds and nothing else."""
        if "cue" in e and not (isinstance(e["cue"], str) and e["cue"].strip()):
            self.err(where, "\"cue\" must be words of the scene's narration")
        if "nth" in e and not (isinstance(e["nth"], int) and not isinstance(e["nth"], bool) and e["nth"] >= 1):
            self.err(where, f"\"nth\" must be a whole number from 1 up, not {e['nth']!r}")
        if "at" in e and not _num(e["at"]):
            self.err(where, f"\"at\" is a time in seconds, not {_kind(e['at'])}; a position is \"pos\", a place is \"on\"")
        self.number(where, e, "over", least=0)
        if "until" in e and not (_num(e["until"]) or (isinstance(e["until"], str) and e["until"].strip())):
            self.err(where, "\"until\" must be words of the narration (or a time in seconds)")
        self.one_of(where, "ease", e, EASES)

    def place(self, where: str, key: str, name, places: dict, names: bool) -> None:
        if not isinstance(name, str) or not name:
            self.err(where, f"\"{key}\" must name a place, not {_kind(name)}")
        elif names and not _place_ok(name, places):
            have = ", ".join(sorted(places)[:12]) or "none declared"
            self.err(where, f"\"{key}\" names the place \"{name}\", which is not declared{_hint(name, places)} (places: {have})")

    def component(self, where: str, name) -> None:
        if not isinstance(name, str) or not name:
            self.err(where, "names no component")
        elif name not in self.comps:
            self.err(where, f"component \"{name}\": no file scenes/{name}.tsx{_hint(name, self.comps)}")
        elif not re.fullmatch(r"[A-Z][A-Za-z0-9]*", name):
            self.warn(where, f"component \"{name}\" should be PascalCase, the same as its file and its default export")

    def tracks(self, where: str, tracks) -> dict:
        if tracks is None:
            return {}
        if not isinstance(tracks, dict):
            self.err(where, "\"tracks\" must be an object: {track: its initial value}")
            return {}
        for k, v in tracks.items():
            self.name(f"{where} tracks", k, "the track", family=True)
            if isinstance(v, dict) or (isinstance(v, list) and not all(_num(a) or isinstance(a, str) for a in v)):
                self.err(f"{where} tracks.{k}", "an initial value is a number, text, true or false, null, or a list of numbers or names")
        return tracks

    def places(self, where: str, places) -> dict:
        if places is None:
            return {}
        if not isinstance(places, dict):
            self.err(where, "\"places\" must be an object: {name: {pos, size}}")
            return {}
        for k, p in places.items():
            w = f"{where} places.{k}"
            self.name(f"{where} places", k, "the place")
            if not isinstance(p, dict):
                self.err(w, "a place is {pos, size}")
                continue
            self.keys(w, p, "place")
            if not _vec(p.get("pos")):
                self.err(w, "\"pos\" must be [x, y, z] (or [x, y] on a board)")
            elif "size" in p and not (_vec(p["size"]) and len(p["size"]) == len(p["pos"])):
                self.err(w, f"\"size\" must be {len(p['pos'])} numbers, like \"pos\"")
        return places

    def assets(self, where: str, assets) -> None:
        if assets is None:
            return
        if not isinstance(assets, dict):
            self.err(where, "\"assets\" must be an object: {name: a request or a file path}")
            return
        for k, a in assets.items():
            w = f"{where} assets.{k}"
            if isinstance(a, str) and a.strip():
                continue
            if not isinstance(a, dict):
                self.err(w, "an asset is a file path or a request like {\"q\": ..., \"kind\": ..., \"pick\": n}")
                continue
            if "src" in a:
                continue  # already resolved
            self.keys(w, a, "asset")
            self.one_of(w, "kind", a, ASSET_KINDS)
            if not any(isinstance(a.get(x), str) and a[x].strip() for x in ("q", "query", "id", "file")):
                self.err(w, "a request needs \"q\" (search words), \"id\" (provider:id) or \"file\"")
            if "pick" in a and not (isinstance(a["pick"], int) and not isinstance(a["pick"], bool) and a["pick"] >= 1):
                self.err(w, f"\"pick\" is the number on the contact sheet, from 1 up, not {a['pick']!r}")

    def entries(self, where: str, v: dict, block: str):
        val = v.get(block)
        if val is None:
            return
        if not isinstance(val, list):
            self.err(where, f"\"{block}\" must be a list")
            return
        for i, e in enumerate(val, 1):
            if isinstance(e, dict):
                yield f"{where} {block}[{i}]", e
            else:
                self.err(f"{where} {block}[{i}]", "must be an object")

    def top(self, where: str, v: dict, world: str | None) -> None:
        """Top-level keys of a free or world visual: the reserved names are the kit's blocks, the rest is the scene's."""
        for k in v:
            if k in RESERVED:
                if world is not None and k in ("component", "tracks", "places"):
                    self.err(where, f"\"{k}\" belongs to the world: declare it once under worlds.{world}")
                elif world is None and k == "world":
                    self.err(where, "\"world\" is for {\"type\": \"world\"}; a custom scene declares its own tracks and places")
                continue
            close = difflib.get_close_matches(k, RESERVED, 1, 0.75)
            if close:
                self.err(where, f"unknown key \"{k}\" (did you mean \"{close[0]}\"?)")
            else:
                self.warn(where, f"\"{k}\" is not a kit block ({', '.join(RESERVED[4:])}); a scene's own data belongs under \"props\"")

    def blocks(self, where: str, v: dict, tracks: dict, places: dict, names: bool) -> None:
        """The kit's blocks of one visual. `names` is off when the world is unknown, so one mistake is one message."""
        if "title" in v and not isinstance(v["title"], str):
            self.err(where, "\"title\" must be text")
        beats = v.get("beats")
        if beats is not None and not isinstance(beats, dict):
            self.err(where, "\"beats\" must be an object: {name: the words it waits for}")
        for k, b in (beats.items() if isinstance(beats, dict) else ()):
            w = f"{where} beats.{k}"
            self.name(f"{where} beats", k, "the beat")
            if k in TIME:
                self.err(w, f"a beat may not be named \"{k}\": {', '.join(TIME)} are time words; choose another name")
            if isinstance(b, dict):
                self.keys(w, b, "beat")
                self.time(w, b)
                if "cue" not in b and "at" not in b:
                    self.err(w, "needs \"cue\" or \"at\"")
            elif not (_num(b) or (isinstance(b, str) and b.strip())):
                self.err(w, "a beat is a phrase, {\"cue\", \"nth\"} or a number of seconds")

        for w, e in self.entries(where, v, "set"):
            self.keys(w, e, "set")
            self.time(w, e)
            self.number(w, e, "stagger", least=0)
            if ("key" in e) == ("keys" in e):
                self.err(w, "needs \"key\" or \"keys\", one of the two")
                continue
            ks = [e["key"]] if "key" in e else e["keys"]
            if not (isinstance(ks, list) and ks and all(isinstance(k, str) and k for k in ks)):
                self.err(w, "\"key\" is a track name and \"keys\" a list of them")
                continue
            if "to" not in e:
                self.err(w, "needs \"to\", the value the track moves to")
            for k in ks:
                if k == "focus":  # the one reserved track: an id, a list of ids, or null
                    to = e.get("to")
                    if not (to is None or isinstance(to, str) or (isinstance(to, list) and all(isinstance(x, str) for x in to))):
                        self.err(w, "\"focus\" takes an id, a list of ids, or null")
                    for x in ([to] if isinstance(to, str) else to if isinstance(to, list) else []):
                        if isinstance(x, str):
                            self.place(w, "focus", x, places, names)
                    continue
                if not names:
                    continue
                decl = _declared(k, tracks)
                if not decl:
                    have = ", ".join(sorted(tracks)[:12]) or "none declared"
                    self.err(w, f"the track \"{k}\" is not declared{_hint(k, [*tracks, 'focus'])} (tracks: {have})")
                elif "to" in e and not all(_fits(d, e["to"]) for d in decl):
                    bad = next(d for d in decl if not _fits(d, e["to"]))
                    self.err(w, f"\"to\" is {_kind(e['to'])}, but the track \"{k}\" is declared as {_kind(bad)}")

        for w, e in self.entries(where, v, "shots"):
            self.keys(w, e, "shot")
            self.time(w, e)
            self.number(w, e, "az", "el", "dist", "fov", "pad", "orbit")
            if _num(e.get("fov")) and not 0 < e["fov"] < 180:  # the stage would only turn it into the card mid-render
                self.err(w, f"\"fov\": {e['fov']} is not a field of view, which is more than 0 and less than 180 degrees")
            self.one_of(w, "preset", e, PRESETS)
            if "frame" in e:
                fr = [e["frame"]] if isinstance(e["frame"], str) else e["frame"]
                if not (isinstance(fr, list) and fr):
                    self.err(w, "\"frame\" is a place or a list of places")
                else:
                    for x in fr:
                        self.place(w, "frame", x, places, names)
            if "target" in e and not _vec(e["target"]):
                self.place(w, "target", e["target"], places, names)
            if "pos" in e and not _vec(e["pos"]):
                self.err(w, "\"pos\" is the camera's position: [x, y, z]")
            if "fit" in e and not (e["fit"] in ("area", "full") or _vec(e["fit"], (4,))):
                self.err(w, "\"fit\" is \"area\", \"full\" or [x, y, w, h] in layout pixels")
            for k in ("az", "el"):  # degrees; a small number with decimals is almost always an angle in radians
                if _num(e.get(k)) and e[k] != int(e[k]) and abs(e[k]) < 6.3:
                    self.warn(w, f"\"{k}\": {e[k]} looks like radians; the kit takes degrees ({e[k] * 57.2958:.0f}?)")
            if "pos" in e and any(k in e for k in ("az", "el", "dist")):
                self.warn(w, "\"pos\" places the camera, so az, el and dist are not used")

        for w, e in self.entries(where, v, "labels"):
            # the stage places a label given as data itself and has no use for an offset (contract 6.5)
            self.keys(w, {k: x for k, x in e.items() if k not in ("dx", "dy")}, "label")
            for k in ("dx", "dy"):
                if k in e:
                    self.err(w, f"\"{k}\": a label given as data has no offset; for one, draw a <Label {k}> in the "
                                "stage's overlay in the scene code")
            self.time(w, e)
            self.one_of(w, "size", e, LABEL_SIZES)
            self.one_of(w, "side", e, SIDES)
            if ("on" in e) == ("pos" in e):
                self.err(w, "needs \"on\" (a place) or \"pos\" (a position), one of the two")
            elif "on" in e:
                self.place(w, "on", e["on"], places, names)
            elif not _vec(e["pos"]):
                self.err(w, "\"pos\" must be [x, y, z] (or [x, y] on a board)")
            if not (isinstance(e.get("text"), str) and e["text"].strip()) and not _num(e.get("text")):
                self.err(w, "needs \"text\"")
            if "sub" in e and not isinstance(e["sub"], (str, int, float)):
                self.err(w, "\"sub\" must be text")
            if "leader" in e and not isinstance(e["leader"], bool):
                self.err(w, "\"leader\" must be true or false")
            if "id" in e:
                self.name(w, e["id"], "the id")

        for w, e in self.entries(where, v, "sfx"):
            self.keys(w, e, "sfx")
            self.time(w, e)
            self.number(w, e, "gain", "offset")
            if not ((isinstance(e.get("sound"), str) and e["sound"].strip()) or isinstance(e.get("sound"), dict)):
                self.err(w, "needs \"sound\": the name of an asset, a file, or a request")
        self.assets(where, v.get("assets"))


def validate(spec: dict, comps: dict) -> tuple:
    """Check "worlds" and the kit's blocks of every free and world visual -> (errors, warnings). Unknown names are
    errors: an unknown key (with the closest known name), a set key no declared track or family covers, a frame,
    on, target or focus id that is no declared place, a value of the wrong kind, a missing component file."""
    c = _Check(comps)
    worlds = spec.get("worlds")
    if worlds is not None and not isinstance(worlds, dict):
        c.err("worlds", "must be an object: {id: {component, tracks, places, assets, props}}")
    worlds = worlds if isinstance(worlds, dict) else {}
    for wid, w in worlds.items():
        where = f"worlds.{wid}"
        if not isinstance(w, dict):
            c.err(where, "a world is {component, tracks, places, assets, props}")
            continue
        c.name("worlds", wid, "the world id")
        c.keys(where, w, "world")
        c.component(where, w.get("component"))
        c.tracks(where, w.get("tracks"))
        c.places(where, w.get("places"))
        c.assets(where, w.get("assets"))
    used = set()
    for n, sc in enumerate(spec.get("scenes") or [], 1):
        v = sc.get("visual") if isinstance(sc, dict) else None
        if not isinstance(v, dict) or v.get("type") not in ("custom", "world"):
            continue
        where = f"scene {n}"
        if v["type"] == "world":
            wid = v.get("world")
            w = worlds.get(wid) if isinstance(wid, str) else None
            known = isinstance(w, dict)
            if not known:
                c.err(where, f"the world \"{wid}\" is not declared under \"worlds\"{_hint(wid, worlds)}" if wid
                      else "a world scene needs \"world\": the id of a world declared under \"worlds\"")
            else:
                used.add(wid)
            c.top(where, v, str(wid))
            tracks = w.get("tracks") if known and isinstance(w.get("tracks"), dict) else {}
            places = w.get("places") if known and isinstance(w.get("places"), dict) else {}
            c.blocks(where, v, tracks, places, known)
        else:
            c.component(where, v.get("component"))
            c.top(where, v, None)
            c.blocks(where, v, c.tracks(where, v.get("tracks")), c.places(where, v.get("places")), True)
    for wid in worlds:
        if wid not in used and isinstance(worlds[wid], dict):
            c.warn(f"worlds.{wid}", "no scene uses this world")
    return c.errors, c.warns


# ---------------------------------------------------------------- entry and type check
def write_entry(build: Path, comps: dict) -> Path:
    src = rel(ROOT / "src", build)
    lines = ["// Generated by make.py (custom.py) on every run for this video. Do not edit.",
             "import { registerRoot } from 'remotion';",
             f"import {{ Root }} from '{src}/Root';",
             f"import {{ loadScene, registerScenes }} from '{src}/custom';",
             "// Each scene file is loaded on its own, inside a try/catch (loadScene): a file that throws while it loads",
             "// becomes that scene's card and one report line, not a dead video. A static import would stop the bundle.",
             "declare const require: (path: string) => unknown;",
             "registerScenes({"]
    lines += [f"  {json.dumps(n)}: loadScene(() => require('{rel(f.with_suffix(''), build)}'))," for n, f in comps.items()]
    lines += ["});", "registerRoot(Root);", ""]
    entry, text = build / "entry.tsx", "\n".join(lines)
    if not entry.exists() or entry.read_text("utf-8") != text:  # an unchanged entry keeps its timestamp
        entry.write_text(text, "utf-8")
    return entry


def typecheck(vdir: Path, build: Path) -> tuple:
    """tsc over this video's scenes and, through their imports, the engine -> (errors, warnings). It runs on every
    make.py run; --incremental keeps what it learned in build/tsbuildinfo, so an unchanged tree costs seconds.
    Only an error in the video's own files stops the render: the engine is shared, and another author's file that
    does not compile at this moment must not block this video (it becomes one warning)."""
    cfg = build / "tsconfig.json"
    text = json.dumps({"extends": rel(ROOT / "tsconfig.json", build),
                       "compilerOptions": {"incremental": True, "tsBuildInfoFile": "./tsbuildinfo"},
                       "include": [rel(vdir / "scenes", build) + "/**/*", "./entry.tsx", rel(ROOT / "src" / "declarations.d.ts", build)]}, indent=1)
    if not cfg.exists() or cfg.read_text("utf-8") != text:
        cfg.write_text(text, "utf-8")
    (build / "typecheck.json").unlink(missing_ok=True)  # the stamp of the cache this replaced
    tsc = ROOT / "node_modules" / "typescript" / "bin" / "tsc"
    try:
        r = subprocess.run([shutil.which("node") or "node", str(tsc), "--noEmit", "--incremental", "--pretty", "false", "-p", str(cfg)],
                           cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace", stdin=subprocess.DEVNULL)
    except OSError as exc:
        return [f"type check did not run: {exc}; fix the TypeScript install, or pass --no-typecheck to render without it"], []
    mine, other = [], []
    home = vdir.resolve()
    for ln in (r.stdout or "").splitlines():
        m = re.match(r"(.+?)\((\d+),(\d+)\): error (TS\d+: .*)$", ln.strip())
        if m:
            f = (ROOT / m.group(1)).resolve()
            if f == home or home in f.parents:
                mine.append(f"{rel(f, vdir)}:{m.group(2)}: {m.group(4)}")
            else:
                other.append(f"{rel(f, ROOT)}:{m.group(2)}: {m.group(4)}")
        elif re.match(r"error TS\d+", ln.strip()):
            other.append(ln.strip())
    if r.returncode != 0 and not mine and not other:
        # tsc failed without one diagnostic: it did not run (a missing or broken install, a bad tsconfig). Nothing
        # was checked, so this blocks like an error in the video's own files; it is not "an error elsewhere".
        said = [x.strip() for x in (r.stderr or r.stdout or "").splitlines() if x.strip()]
        first = next((x for x in said if "error" in x.lower()), said[0] if said else "no message")  # node puts a stack location first
        return [f"type check did not run (tsc exit {r.returncode}): {first[:240]}; fix the TypeScript install, "
                "or pass --no-typecheck to render without it"], []
    warns =[f"type check: {len(other)} error{'s' if len(other) != 1 else ''} outside this video's folder, not blocking; "
             f"first: {other[0]}"] if other else []
    return mine, warns


def prepare(vdir: Path, spec: dict, build: Path, warns: list, check: bool = True) -> dict:
    """-> {"entry": the Remotion entry for this video, "gl": a scene draws with three.js, "errors": what must stop
    the render (validation, lint, types), "components": {name: file}}. Matters of style are appended to `warns`.
    A video without scenes/ keeps the engine's entry."""
    comps, paths = components(vdir), sources(vdir)
    errors, style = validate(spec, comps)
    warns += style
    if not comps:
        return {"entry": "src/index.ts", "gl": False, "errors": errors, "components": {}}
    entry = write_entry(build, comps)
    bad, advice = lint(paths, vdir)
    errors += bad
    warns += advice
    if check:
        bad, advice = typecheck(vdir, build)
        errors += bad
        warns += advice
    return {"entry": str(entry), "gl": any(GL.search(p.read_text("utf-8")) for p in paths), "errors": errors, "components": comps}
