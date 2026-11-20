"""
@file direction.py
@description The director's record and the user's limits (F-015). The session that makes a video directs it, and
  writes what it decided in a top-level "direction" block of spec.json:
    "direction": {"audience": "who the video is for, and at what level",
                  "form": "2d" | "3d" | "mixed",
                  "why": "one or two lines: why this form, this structure and this look for this topic",
                  "limits": ["2d-only", ...],   the user's stated limits, tokens the build checks (LIMITS)
                  "asked": ["calm pace", ...]}  what the user asked that no build can check: printed back to check by eye
  check() validates the block and holds the video to its limits before anything is synthesized or rendered: each
  violation is an error that names the scene and the limit. nudges() returns the warnings of a video that was not
  directed or repeats itself (none for demo folders, whose names start with "_"). ledger_row() and ledger_upsert()
  keep docs/made.md, one row per finished video, so that a session sees the last looks and structures and varies.
  "Draws in 3D" and "rendered by Blender" are read from the scene code and the files themselves, never from a
  declaration; how, and where that reading stops, is written beside the functions that do it.
@see make.py (calls check, nudges and the ledger), custom.py (_code blanks comments), render.py (imported follows
  relative imports), SPEC.md (the part "Direct the video")
"""
from __future__ import annotations

import colorsys
import datetime as _dt
import difflib
import json
import os
import re
import shutil
import struct
import subprocess
from collections import Counter
from functools import lru_cache
from pathlib import Path

import custom
import render

ROOT = Path(__file__).resolve().parent
MADE = ROOT / "docs" / "made.md"

FIELDS = ("audience", "form", "why", "limits", "asked")
FORMS = ("2d", "3d", "mixed")
# The closed list of limits: each is checked below. What the user asks that no build can check goes in "asked".
LIMITS = {
    "2d-only": "no scene draws in 3D, and nothing is rendered by Blender",
    "no-blender": "nothing rendered by Blender",
    "no-stock-pictures": "no picture or clip from an asset provider or the web: drawn pictures and the user's own files",
    "templates-only": "the cheap path: every scene a template, no scene code at all",
    "no-templates": "every picture is scene code (chapter cards and captions are not templates)",
    "stock-look": "the user asked for a theme as it is: the design changes none of bg, ink, surface, font",
}
STOCK_THEMES = ("plate", "stage", "ground")  # the built-in themes; a theme saved with --save-theme was designed
PALETTE = ("bg", "ink", "surface")  # a design that sets one of these has a look of its own; type or paint alone keep the stock look
LOOK_KEYS = (*PALETTE, "font")  # what "stock-look" forbids the design to change (content colours under "paint" may stay)
FAMILY = {"list": "points", "recap": "points", "steps": "flow", "bars": "chart", "number": "stat",
          "big": "quote", "definition": "quote"}  # aliases of one template (src/templates/index.ts)
FREE = ("custom", "world", "clip", "blender")  # make.py's FREE: everything else is a template
STOCK_KINDS = ("photo", "illustration", "vector", "video", "lottie", "model", "hdri")  # icon, sound, music, font stay
THREE_KINDS = ("model", "hdri")
THREE_EXT = (".glb", ".gltf", ".hdr", ".exr", ".obj", ".fbx", ".usd", ".usdz", ".blend")
VIDEO_EXT = (".mp4", ".mov", ".m4v", ".mkv", ".webm", ".avi")
THREE_IMPORT = re.compile(r"""(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"](three(?:/[^'"]*)?|@react-three/[^'"]*|@remotion/three)['"]""")


# ---------------------------------------------------------------- reading scene code
def _blank_strings(code: str) -> str:
    """Code with the inside of every string literal blanked (newlines kept, so line numbers hold). A '...' or "..."
    string ends at the end of its line, so an apostrophe in JSX text costs at most the rest of that line."""
    out, i, n = [], 0, len(code)
    while i < n:
        c = code[i]
        if c in "'\"`":
            j = i + 1
            while j < n and code[j] != c and not (c != "`" and code[j] == "\n"):
                j += 2 if code[j] == "\\" else 1
            out.append(re.sub(r"[^\n]", " ", code[i:j + 1]))
            i = j + 1
        else:
            out.append(c)
            i += 1
    return "".join(out)


@lru_cache(maxsize=1)
def kit_3d_names() -> tuple:
    """The kit's components that open a 3D canvas: <Stage> (the only host of one, through CanvasHost), and any kit
    export whose file renders a <Stage>, so a 3D part moved into the kit later is caught without a change here."""
    names = {"Stage", "ThreeCanvas"}
    for p in sorted((ROOT / "src" / "kit").glob("*.ts*")):
        try:
            code = custom._code(p.read_text("utf-8", errors="replace"))
        except OSError:
            continue
        if re.search(r"<(?:Stage|CanvasHost|ThreeCanvas)\b", _blank_strings(code)):
            names.update(re.findall(r"export\s+(?:const|function|class)\s+([A-Z][A-Za-z0-9_]*)", code))
    return tuple(sorted(names))


KIT_FROM = r"""\s*from\s*['"]@kit(?:/[^'"]*)?['"]"""
IMPORT_SPAN = re.compile(r"""^[ \t]*(?:import|export)\b[^;'"()=]*?\bfrom\s*['"][^'"]*['"]""", re.M)


def _kit_names(code: str) -> tuple:
    """What a file takes from @kit under its own names -> ({local: kit name} for the 3D parts, the names of a
    namespace import, a 3D part it re-exports). `import { Stage as Room3 }` gives {"Room3": "Stage"};
    `import * as Kit` gives "Kit", so `Kit.Stage` is read as the Stage it is. Type-only imports do not count."""
    names, local, spaces, again = set(kit_3d_names()), {}, [], None
    for m in re.finditer(r"\b(import|export)\s+(type\s+)?(?:[\w$]+\s*,\s*)?\{([^}]*)\}" + KIT_FROM, code):
        if m.group(2):
            continue
        for part in m.group(3).split(","):
            bits = part.split()
            if bits and bits[0] == "type":
                continue
            if bits and bits[0] in names:
                if m.group(1) == "export":
                    again = again or f"re-exports the kit's {bits[0]} (line {code.count(chr(10), 0, m.start()) + 1})"
                else:
                    local[bits[-1]] = bits[0]
    spaces = re.findall(r"\bimport\s+(?:[\w$]+\s*,\s*)?\*\s*as\s+([\w$]+)" + KIT_FROM, code)
    return local, spaces, again


def _three_in_file(p: Path) -> str | None:
    """Why one code file draws in 3D, or None: it imports three, @react-three/* or @remotion/three, or it renders
    <Stage> (or a kit part that opens one), also under another name (`Stage as X`, `Kit.Stage`) or as a value.
    Comments do not count, nor words inside strings. Only the text is read: a Stage reached some other way is
    stopped when it draws (kit/canvas.tsx refuses a 3D canvas in a video held to 2D)."""
    try:
        code = custom._code(p.read_text("utf-8", errors="replace"))
    except OSError:
        return None
    for i, line in enumerate(code.splitlines(), 1):
        m = THREE_IMPORT.search(line)
        if m:
            return f"imports {m.group(1)} (line {i})"
    local, spaces, again = _kit_names(code)
    if again:
        return again
    flat = _blank_strings(code)
    for m in IMPORT_SPAN.finditer(code):  # the import lines name the parts; only their use below counts
        flat = flat[:m.start()] + re.sub(r"[^\n]", " ", flat[m.start():m.end()]) + flat[m.end():]
    names = kit_3d_names()
    tag = re.compile(r"<(" + "|".join(map(re.escape, (*names, *local))) + r")\b")
    ns = re.compile(r"(?<![\w$.])(" + "|".join(map(re.escape, spaces)) + r")\s*\.\s*(" + "|".join(map(re.escape, names)) + r")\b") if spaces else None
    use = re.compile(r"(?<![\w$.<])(" + "|".join(map(re.escape, local)) + r")(?![\w$])") if local else None
    for i, line in enumerate(flat.splitlines(), 1):
        m = tag.search(line)
        if m:
            k = m.group(1)
            return f"renders <{k}> (line {i})" if k in names and local.get(k, k) == k else f"renders <{k}>, the kit's {local[k]} (line {i})"
        m = ns.search(line) if ns else None
        if m:
            return f"uses {m.group(1)}.{m.group(2)} (line {i})"
        m = use.search(line) if use else None
        if m:
            return f"uses {m.group(1)}, the kit's {local[m.group(1)]} (line {i})"
    return None


@lru_cache(maxsize=256)
def _component(vdir: Path, name: str) -> tuple:
    """-> (why the component draws in 3D or None, the non-code files it imports). The component's file and every file
    it reaches by relative imports (render.imported) are read; the engine's src/ is not (the kit names <Stage> in
    its own comments and messages), so a helper counts only when it is the video's or a shared folder's."""
    f = vdir / "scenes" / f"{name}.tsx"
    if not f.is_file():
        return None, ()
    src, why, data = ROOT / "src", None, []
    for p in render.imported([f]):
        if "node_modules" in p.parts or src in p.parents:
            continue
        if p.suffix.lower() not in render.CODE:
            data.append(p)
            continue
        if why is None:
            r = _three_in_file(p)
            if r:
                who = custom.rel(p, vdir)
                why = f"{who} {r}" if p == f.resolve() else f"{who}, imported by scenes/{name}.tsx, {r}"
    return why, tuple(data)


# ---------------------------------------------------------------- reading files for Blender
def _png_text(p: Path) -> dict:
    """The text chunks of a PNG (tEXt, zTXt, iTXt keys and, for tEXt, values), read chunk by chunk."""
    out = {}
    with p.open("rb") as fh:
        if fh.read(8) != b"\x89PNG\r\n\x1a\n":
            return out
        for _ in range(4096):
            head = fh.read(8)
            if len(head) < 8:
                break
            size, kind = struct.unpack(">I4s", head)
            if kind in (b"tEXt", b"zTXt", b"iTXt") and size < 1 << 20:
                key, _, val = fh.read(size).partition(b"\0")
                out[key.decode("latin-1")] = val.decode("latin-1", "replace") if kind == b"tEXt" else ""
                fh.seek(4, 1)
            else:
                if kind == b"IEND":
                    break
                fh.seek(size + 4, 1)
    return out


def _jpeg_comments(p: Path) -> dict:
    """The comment markers of a JPEG; Blender writes each metadata field as one, "key:value"."""
    out = {}
    with p.open("rb") as fh:
        if fh.read(2) != b"\xff\xd8":
            return out
        for _ in range(512):
            m = fh.read(4)
            if len(m) < 4 or m[0] != 0xFF or m[1] in (0xD9, 0xDA):
                break
            size = struct.unpack(">H", m[2:])[0]
            body = fh.read(max(0, size - 2))
            if m[1] == 0xFE:
                k, _, v = body.rstrip(b"\0").decode("latin-1", "replace").partition(":")
                out[k] = v
    return out


def _video_tags(p: Path) -> dict:
    exe = shutil.which("ffprobe")
    if not exe:
        return {}
    try:
        r = subprocess.run([exe, "-v", "quiet", "-print_format", "json", "-show_entries", "format_tags", str(p)],
                           capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=30,
                           stdin=subprocess.DEVNULL)
        return (json.loads(r.stdout or "{}").get("format") or {}).get("tags") or {}
    except (OSError, ValueError, subprocess.SubprocessError):
        return {}


@lru_cache(maxsize=512)
def blender_mark(p: Path) -> str | None:
    """Why a file was made by Blender, or None. A .blend file is Blender's. A picture or a clip carries Blender's
    metadata stamp when Blender saved it with its default output settings: the fields RenderTime, Camera, Scene and
    File (the .blend), as PNG text chunks, JPEG comments, EXR header attributes or container tags. A render saved
    with the stamp turned off, or converted by another program, carries no mark and cannot be told from any other
    picture; and the MP4 muxer keeps only standard tags, so an MP4 from Blender is usually unmarked."""
    suf = p.suffix.lower()
    if suf in (".blend", ".blend1"):
        return f"{p.name} is a Blender file"
    try:
        if suf == ".png":
            meta = _png_text(p)
        elif suf in (".jpg", ".jpeg"):
            meta = _jpeg_comments(p)
        elif suf == ".exr":
            with p.open("rb") as fh:
                head = fh.read(1 << 16)
            hit = next((w for w in (b"RenderTime", b"BlenderMultiChannel", b".blend\0") if w in head), None)
            return f"{p.name} carries Blender's metadata ({hit.decode().strip(chr(0))})" if hit else None
        elif suf in VIDEO_EXT:
            meta = _video_tags(p)
        else:
            return None
    except OSError:
        return None
    low = {str(k).lower(): str(v) for k, v in meta.items()}
    if "rendertime" in low:
        return f"{p.name} carries Blender's metadata stamp (RenderTime)"
    if low.get("file", "").strip().lower().endswith(".blend"):
        return f"{p.name} names its .blend file ({low['file'].strip()[-60:]})"
    for k in ("software", "creator", "encoder", "encoded_by", "comment"):
        if "blender" in low.get(k, "").lower():
            return f"{p.name} names Blender as its {k}"
    return None


def folder_blender(vdir: Path) -> list:
    """Blender work kept in the video folder (build/ and out/ aside): .blend files and Python scripts that import bpy."""
    out = []
    for p in sorted(vdir.rglob("*")):
        parts = p.relative_to(vdir).parts
        if parts and parts[0] in ("build", "out", "node_modules") or not p.is_file():
            continue
        if p.suffix.lower() in (".blend", ".blend1"):
            out.append(custom.rel(p, vdir))
        elif p.suffix.lower() == ".py":
            try:
                if re.search(r"^\s*(?:import\s+bpy\b|from\s+bpy\b)", p.read_text("utf-8", errors="replace"), re.M):
                    out.append(f"{custom.rel(p, vdir)} (imports bpy)")
            except OSError:
                pass
    return out


# ---------------------------------------------------------------- reading the spec
def _files(node, vdir: Path, acc: set) -> set:
    """Every existing file a node names by a path (relative to the video folder, or absolute)."""
    if isinstance(node, dict):
        for v in node.values():
            _files(v, vdir, acc)
    elif isinstance(node, list):
        for v in node:
            _files(v, vdir, acc)
    elif isinstance(node, str) and 0 < len(node) < 300 and "\n" not in node and not node.startswith(("http://", "https://")):
        try:
            p = Path(node)
            p = p if p.is_absolute() else vdir / node
            if p.suffix and p.is_file():
                acc.add(p.resolve())
        except (OSError, ValueError):
            pass
    return acc


def _is_file(ref: str, vdir: Path) -> bool:
    try:
        p = Path(ref)
        return (p if p.is_absolute() else vdir / ref).is_file()
    except (OSError, ValueError):
        return False


def _stock(node, vdir: Path, out: list) -> list:
    """What a node asks of an asset provider or the web, in words: image requests and URLs, asset requests."""
    if isinstance(node, dict):
        for k, v in node.items():
            if k == "image" and isinstance(v, str):
                if v.startswith(("http://", "https://")):
                    out.append(f"the web picture {v[:70]}")
                elif v.strip() and not _is_file(v, vdir):
                    out.append(f"the picture request \"{v.removeprefix('commons:').strip()}\"")
            elif k == "image" and isinstance(v, dict) and "src" not in v and not v.get("file"):
                kind = v.get("kind") or "photo"
                if kind in STOCK_KINDS:
                    out.append(f"the {kind} request \"{v.get('q') or v.get('query') or v.get('id') or '?'}\"")
            elif k == "assets" and isinstance(v, dict):
                for name, a in v.items():
                    if isinstance(a, dict) and "src" not in a and not a.get("file") and any(a.get(x) for x in ("q", "query", "id")):
                        kind = a.get("kind") or "photo"
                        if kind in STOCK_KINDS:
                            out.append(f"the asset \"{name}\" ({kind} request \"{a.get('q') or a.get('query') or a.get('id')}\")")
                    elif isinstance(a, str) and a.startswith(("http://", "https://")):
                        out.append(f"the asset \"{name}\" (a web address)")
            else:
                _stock(v, vdir, out)
    elif isinstance(node, list):
        for x in node:
            _stock(x, vdir, out)
    return out


def _three_assets(node, out: list) -> list:
    """Models and HDRIs a node asks for (by kind or by a file of a 3D format): they live on a 3D stage."""
    if isinstance(node, dict):
        kind = node.get("kind")
        if kind in THREE_KINDS and any(node.get(x) for x in ("q", "query", "id", "file")):
            out.append(f"the {kind} \"{node.get('q') or node.get('query') or node.get('id') or node.get('file')}\"")
        for k, v in node.items():
            if k == "assets" and isinstance(v, dict):
                for name, a in v.items():
                    if isinstance(a, str) and Path(a).suffix.lower() in THREE_EXT:
                        out.append(f"the asset \"{name}\" ({a})")
            if isinstance(v, (dict, list)):
                _three_assets(v, out)
    elif isinstance(node, list):
        for x in node:
            _three_assets(x, out)
    return out


def family(t) -> str:
    return FAMILY.get(t, t) if isinstance(t, str) else "points"


def analyse(spec: dict, vdir: Path, free=FREE, blender: bool = True) -> dict:
    """Per scene: its type, whether it is a template, why it draws in 3D, why it holds a Blender render, what it asks
    of providers. Per world used by a scene: the same for its declaration, reported once under worlds.<id>.
    `blender` off skips reading the files (the ledger needs only the form)."""
    worlds = spec.get("worlds") if isinstance(spec.get("worlds"), dict) else {}
    scenes, used = [], {}
    for n, sc in enumerate(spec.get("scenes") or [], 1):
        v = (sc.get("visual") if isinstance(sc, dict) else None) or {"type": "points"}
        v = v if isinstance(v, dict) else {"type": "points"}
        t = v.get("type") if isinstance(v.get("type"), str) else "points"
        s = {"n": n, "type": t, "family": family(t), "template": t not in free, "three": [], "blender": [], "stock": []}
        comp, decl = None, None
        if t == "custom":
            comp = v.get("component")
        elif t == "world":
            wid = v.get("world")
            decl = worlds.get(wid) if isinstance(wid, str) else None
            if isinstance(decl, dict):
                comp = decl.get("component")
                used.setdefault(wid, []).append(n)
        if t == "stage3d":
            s["three"].append("the stage3d template")
        if t == "blender":
            s["blender"].append("the type \"blender\" (a Blender render)")
        data: tuple = ()
        if isinstance(comp, str) and comp:
            why, data = _component(vdir, comp)
            if why:
                s["three"].append(why + (f" (the component of the world \"{v.get('world')}\")" if decl else ""))
        s["three"] += _three_assets(v, [])
        s["stock"] = _stock(v, vdir, [])
        if blender:
            files = _files(v, vdir, set()) | set(data)
            s["blender"] += [m for m in (blender_mark(p) for p in sorted(files)) if m]
        scenes.append(s)
    wl = {}
    for wid, ns in used.items():
        decl = worlds[wid]
        w = {"scenes": ns, "three": _three_assets(decl, []), "stock": _stock(decl, vdir, []), "blender": []}
        if blender:
            w["blender"] = [m for m in (blender_mark(p) for p in sorted(_files(decl, vdir, set()))) if m]
        for n in ns:  # a world's 3D assets and Blender files are in each of its scenes' pictures
            sc = scenes[n - 1]
            sc["three"] += [f"{x} of the world \"{wid}\"" for x in w["three"]]
            sc["blender"] += [f"{x} (in the world \"{wid}\")" for x in w["blender"]]
        wl[wid] = w
    return {"scenes": scenes, "worlds": wl}


def inferred_form(scenes: list) -> str:
    three = [s for s in scenes if s["three"] or s["blender"]]
    return "2d" if not three else "3d" if len(three) == len(scenes) else "mixed"


def _nums(ns) -> str:
    ns = list(ns)
    return ", ".join(map(str, ns[:-1])) + f" and {ns[-1]}" if len(ns) > 1 else str(ns[0]) if ns else ""


def _hint(word, known) -> str:
    close = difflib.get_close_matches(str(word), list(known), 1, 0.5)
    return f" (did you mean \"{close[0]}\"?)" if close else ""


def _reads_like(text: str) -> str | None:
    """The limit token a free wish in "asked" reads like, if any: a checkable limit belongs in "limits"."""
    w = re.sub(r"[^a-z0-9]+", " ", text.lower())
    if "blender" in w:
        return "no-blender"
    if re.search(r"\b2 ?d\b", w) and re.search(r"\bonly\b|\bjust\b|\bno 3 ?d\b", w) or re.search(r"\bno 3 ?d\b", w):
        return "2d-only"
    if re.search(r"\bstock\b|\bno (?:photos?|pictures?|images?)\b|\bdraw (?:it )?(?:all|everything)\b", w):
        return "no-stock-pictures"
    return None


# ---------------------------------------------------------------- the check
def check(spec: dict, vdir: Path, theme: str, design: dict, free=FREE) -> dict:
    """The direction block and the limits it names -> {"errors", "warnings", "direction", "limits", "asked", "form"}.
    Every error names the scene (or the block) and the limit; make.py stops before the voice and the render."""
    res = {"errors": [], "warnings": [], "direction": None, "limits": [], "asked": [], "form": None}
    err, warn = res["errors"].append, res["warnings"].append
    d = spec.get("direction")
    if d is None:
        return res
    if not isinstance(d, dict):
        err("direction: must be an object: {\"audience\", \"form\", \"why\", \"limits\", \"asked\"}")
        return res
    res["direction"] = d
    for k in d:
        if k not in FIELDS:
            err(f"direction: unknown key \"{k}\"{_hint(k, FIELDS)}; the keys are {', '.join(FIELDS)}")
    if not (isinstance(d.get("audience"), str) and d["audience"].strip()):
        err("direction: \"audience\" is missing: who the video is for and at what level, in one line")
    form = d.get("form")
    if form not in FORMS:
        err(f"direction: \"form\" must be \"2d\", \"3d\" or \"mixed\", not {json.dumps(form)}{_hint(form, FORMS)}")
        form = None
    why = d.get("why")
    lines = [why] if isinstance(why, str) else why if isinstance(why, list) else None
    if not lines or not all(isinstance(x, str) and x.strip() for x in lines):
        err("direction: \"why\" is missing: one or two lines on why this form, this structure and this look for this topic")
    elif len(lines) > 2:
        warn(f"direction: \"why\" has {len(lines)} lines; keep it to one or two")
    limits = d.get("limits", [])
    if not (isinstance(limits, list) and all(isinstance(x, str) for x in limits)):
        err("direction: \"limits\" must be a list of tokens, like [\"2d-only\", \"no-blender\"]")
        limits = []
    bad = [x for x in limits if x not in LIMITS]
    for x in bad:
        like = _reads_like(x)
        err(f"direction.limits: \"{x}\" is not a limit the build can check"
            f"{f' (did you mean {chr(34)}{like}{chr(34)}?)' if like else _hint(x, LIMITS)}; the limits are "
            f"{', '.join(LIMITS)}; a wish no build can check goes under \"asked\"")
    limits = list(dict.fromkeys(x for x in limits if x in LIMITS))
    asked = d.get("asked", [])
    if not (isinstance(asked, list) and all(isinstance(x, str) for x in asked)):
        err("direction: \"asked\" must be a list of the user's wishes in their words, like [\"calm pace\"]")
        asked = []
    for x in asked:
        tok = x.strip() if x.strip() in LIMITS else _reads_like(x)
        if tok and tok not in limits:
            warn(f"direction.asked: \"{x}\" reads like the limit \"{tok}\", which the build checks; put \"{tok}\" in \"limits\"")
    res.update(limits=limits, asked=asked)
    if "templates-only" in limits and "no-templates" in limits:
        err("direction.limits: \"templates-only\" and \"no-templates\" cannot both hold; keep the one the user asked for")
    if "2d-only" in limits and form in ("3d", "mixed"):
        err(f"direction: the limit \"2d-only\" needs \"form\": \"2d\", not \"{form}\"")
    if res["errors"]:
        return res

    a = analyse(spec, vdir, free, blender=True)
    scenes, worlds = a["scenes"], a["worlds"]
    three = [s for s in scenes if s["three"] or s["blender"]]
    nob = "no-blender" in limits or "2d-only" in limits
    for s in scenes:
        n, why3, whyb = s["n"], s["three"], s["blender"]
        if "2d-only" in limits and (why3 or whyb):
            both = " and \"no-blender\"" if whyb and "no-blender" in limits else ""
            err(f"scene {n}: limit \"2d-only\"{both}: this scene {'draws in 3D' if why3 else 'shows a Blender render'} "
                f"({'; '.join(why3 + whyb)}); "
                f"redraw it in 2D, on a <Board> or with a 2D template")
        elif "no-blender" in limits and whyb:
            err(f"scene {n}: limit \"no-blender\": {'; '.join(whyb)}; draw this picture with scene code or a template instead")
        if "no-stock-pictures" in limits and s["stock"]:
            err(f"scene {n}: limit \"no-stock-pictures\": {'; '.join(s['stock'])} would come from an asset provider or "
                f"the web; draw it instead (scene code, an svg, an icon), or use a file of the user's own")
        if "templates-only" in limits and not s["template"]:
            err(f"scene {n}: limit \"templates-only\": a \"{s['type']}\" scene is scene code; draw it with a template "
                f"(SPEC.md, part 6)")
        if "no-templates" in limits and s["template"]:
            err(f"scene {n}: limit \"no-templates\": the template \"{s['type']}\" draws this scene; draw it with "
                f"scene code instead (a custom or world scene, docs/kit/core.md)")
    for wid, w in worlds.items():
        if "no-stock-pictures" in limits and w["stock"]:
            err(f"worlds.{wid}: limit \"no-stock-pictures\": {'; '.join(w['stock'])} would come from an asset provider "
                f"(drawn in scene{'s' if len(w['scenes']) > 1 else ''} {_nums(w['scenes'])}); draw it instead, or use a "
                f"file of the user's own")
    top = spec.get("assets")
    if "no-stock-pictures" in limits and isinstance(top, list):
        reqs = [r if isinstance(r, dict) else {"q": r} for r in top]
        asks = [f"\"{r.get('q') or r.get('query') or r.get('id')}\"" for r in reqs if (r.get("kind") or "photo") in STOCK_KINDS]
        if asks:
            err(f"assets: limit \"no-stock-pictures\": the planning list asks providers for {', '.join(asks[:6])}; take "
                f"it out of the spec")
    if nob:
        kept = folder_blender(vdir)
        if kept:
            err(f"limit \"{'no-blender' if 'no-blender' in limits else '2d-only'}\": the video folder holds Blender work "
                f"({', '.join(kept[:6])}); a video under this limit uses none: move it out of the folder")
    if "templates-only" in limits:
        comps = custom.components(vdir)
        named = {s.get("visual", {}).get("component") for s in spec.get("scenes") or [] if isinstance(s, dict) and isinstance(s.get("visual"), dict)}
        named |= {w.get("component") for w in (spec.get("worlds") or {}).values() if isinstance(w, dict)} if isinstance(spec.get("worlds"), dict) else set()
        idle = [f"scenes/{c}.tsx" for c in comps if c not in named]
        if idle:
            err(f"limit \"templates-only\": the video folder holds scene code ({', '.join(idle[:6])}); the cheap path has "
                f"none: move it out of scenes/")
    if "stock-look" in limits:
        own = [k for k in LOOK_KEYS if (design or {}).get(k)]
        if own:
            err(f"limit \"stock-look\": the design sets {', '.join(own)} over the theme \"{theme}\"; the user asked for "
                f"the theme as it is: take {'it' if len(own) == 1 else 'them'} out of \"design\" (content colours under "
                f"\"paint\" may stay)")
    if form and "2d-only" not in limits:
        if form == "2d":
            for s in three:  # a Blender picture already stopped by "no-blender" is not reported twice
                why = s["three"] + ([] if "no-blender" in limits else s["blender"])
                if why:
                    err(f"scene {s['n']}: the direction's form is \"2d\", but this scene draws in 3D ({'; '.join(why)}); "
                        f"redraw it in 2D, or set the form to \"mixed\"")
        elif form == "3d" and not three:
            err("direction: the form is \"3d\", but no scene draws in 3D (a <Stage> in scene code, the stage3d template, "
                "a model or an HDRI); draw the scenes that have form in 3D, or set the form to \"2d\"")
        elif form == "mixed" and not three:
            warn("direction: the form is \"mixed\", but no scene draws in 3D; set it to \"2d\"")
    res["form"] = (f"{form}: 3D in scene{'s' if len(three) > 1 else ''} {_nums(s['n'] for s in three)}" if three
                   else f"{form}: no scene in 3D") if form else None
    return res


# ---------------------------------------------------------------- nudges
def _builds_on(a: dict, b: dict, continues=None) -> bool:
    """Does scene b carry on the drawing of scene a: make.py's continuity (the same actors or nodes), or two stage3d
    scenes that share objects (one 3D place seen again)?"""
    if continues and continues(a, b):
        return True
    ids = lambda v: {str(o.get("id")) for o in v.get("objects") or [] if isinstance(o, dict) and o.get("id")}  # noqa: E731
    return a.get("type") == b.get("type") == "stage3d" and bool(ids(a) & ids(b))


def nudges(spec: dict, slug: str, theme: str, design: dict, total: float, free=FREE, continues=None) -> list:
    """Warnings, never errors, each one sentence that says what to do. None for demo folders ("_" first)."""
    if slug.startswith("_"):
        return []
    out = []
    d = spec.get("direction")
    limits = set(d.get("limits") or []) if isinstance(d, dict) and isinstance(d.get("limits"), list) else set()
    if d is None:
        out.append("not directed: the spec has no \"direction\" block; direct the video before writing its scenes "
                   "(SPEC.md, the part \"Direct the video\"): who it is for and at what level, 2d, 3d or mixed, why, "
                   "and the limits the user stated")
    own = [k for k in PALETTE if (design or {}).get(k)]
    if theme in STOCK_THEMES and not own and "stock-look" not in limits:
        out.append(f"look: the stock theme \"{theme}\" with no design of its own (F-005, F-006: its ground and ink are "
                   f"the stock ones); give \"design\" a ground, an ink and a type made for this topic, or add "
                   f"\"stock-look\" to direction.limits if the user asked for the stock look")
    vis = []
    for sc in spec.get("scenes") or []:
        v = (sc.get("visual") if isinstance(sc, dict) else None) or {"type": "points"}
        vis.append(v if isinstance(v, dict) else {"type": "points"})
    n = len(vis)
    run: list = []
    for i in range(n + 1):
        t = vis[i].get("type") if i < n else None
        same = i < n and run and t not in free and family(t) == family(vis[run[-1]].get("type"))
        if same:
            run.append(i)
            continue
        if len(run) >= 3 and not all(_builds_on(vis[a], vis[a + 1], continues) for a in run[:-1]):
            out.append(f"sameness: the template \"{family(vis[run[0]].get('type'))}\" draws scenes "
                       f"{_nums(x + 1 for x in run)} in a row; picture the middle of them another way, or let each "
                       f"build on the one before")
        run = [i] if i < n and t not in free else []
    if n >= 8:
        fams = Counter(family(v.get("type")) for v in vis if v.get("type") not in free)
        for fam, c in fams.most_common():
            if c * 3 > n:
                where = [i + 1 for i, v in enumerate(vis) if v.get("type") not in free and family(v.get("type")) == fam]
                out.append(f"sameness: the template \"{fam}\" draws {c} of the {n} scenes ({_nums(where)}), more than "
                           f"a third; picture some of them another way (another template, or scene code)")
    if total > 120 and vis and all(v.get("type") not in free for v in vis) and "templates-only" not in limits:
        out.append(f"all templates: a video of {int(total // 60)}:{int(total % 60):02d} drawn only with templates; give "
                   f"the pictures that carry the idea scene code of their own (docs/kit/core.md), or add "
                   f"\"templates-only\" to direction.limits if the user asked for the cheap path")
    return out


# ---------------------------------------------------------------- the ledger, docs/made.md
HEAD = [
    "# Made: the videos so far, newest first",
    "",
    "make.py writes a video's row after each full render (not --preview, --strip, --still, --assets, --no-render or",
    "--design, and not demo folders, whose names start with _). Read it before directing a new video and vary what",
    "the last ones did: the ground, the type, the form, the structure, the voice. The look is the theme with the video's",
    "design merged in. Only the newest rows are kept.",
    "",
    "| date | video | min | form | look | chapters | limits | voice |",
    "|---|---|---|---|---|---|---|---|",
]
COLS = ("date", "video", "min", "form", "look", "chapters", "limits", "voice")
MAX_ROWS = 45


def merged_theme(theme: str, design: dict) -> dict:
    """src/themes.json's theme with a design merged in, the way make.py merges it."""
    themes = json.loads((ROOT / "src" / "themes.json").read_text("utf-8"))["themes"]
    base = json.loads(json.dumps(themes.get(theme) or {}))
    for k, v in (design or {}).items():
        base[k] = {**base.get(k, {}), **v} if isinstance(v, dict) and isinstance(base.get(k), dict) else v
    return base


def colour_name(hex_: str) -> str:
    """A rough name for a colour, so a reader of the ledger sees "dark green-grey" before the hex."""
    h = str(hex_ or "").lstrip("#")
    if not re.fullmatch(r"[0-9a-fA-F]{3}|[0-9a-fA-F]{6}", h):
        return ""
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    hue, light, sat = colorsys.rgb_to_hls(r, g, b)
    chroma, deg = max(r, g, b) - min(r, g, b), hue * 360
    tone = "dark" if light < 0.3 else "light" if light > 0.72 else "mid"
    if chroma < 0.04:
        return "black" if light < 0.06 else "white" if light > 0.97 else f"{tone} grey"
    # a dark colour has little chroma to give, so the saturation decides: indigo #1A2240 is blue, slate #4F6074 grey
    if chroma < 0.15 and (sat < 0.4 or chroma < 0.1):
        tint = "warm " if deg < 70 or deg >= 330 else "green-" if deg < 170 else "teal-" if deg < 195 else "blue-" if deg < 270 else "violet-"
        return f"{tone} {tint}grey"
    names = ((15, "red"), (40, "orange"), (65, "yellow"), (160, "green"), (195, "teal"), (255, "blue"),
             (290, "violet"), (335, "pink"), (361, "red"))
    return f"{tone} {next(nm for top, nm in names if deg < top)}"


def look_words(theme: str, base: dict, design: dict) -> str:
    bg, ink = base.get("bg", ""), base.get("ink", "")
    font = base.get("font") or {}
    faces = list(dict.fromkeys(x for x in (font.get("display"), font.get("text")) if x))
    d = design or {}
    mark = " + own design" if any(d.get(k) for k in PALETTE) else " + own type" if d.get("font") else " as it is"
    return (f"{colour_name(bg)} ground {bg}, {colour_name(ink).split(' ')[0]} ink {ink}, {' / '.join(faces) or 'theme type'}; "
            f"{theme}{mark}")


def ledger_row(spec: dict, vdir: Path, theme: str, base: dict, design: dict, minutes: float, date: str | None = None,
               voice: str = "") -> dict:
    d = spec.get("direction") if isinstance(spec.get("direction"), dict) else None
    form = d.get("form") if d and d.get("form") in FORMS else inferred_form(analyse(spec, vdir, blender=False)["scenes"])
    limits = ", ".join(x for x in (d.get("limits") or []) if isinstance(x, str)) if d else ""
    heads = [str(sc["heading"]) for sc in spec.get("scenes") or [] if isinstance(sc, dict) and sc.get("heading")]
    return {"date": date or _dt.date.today().isoformat(), "video": vdir.name, "min": f"{minutes:.1f}",
            "form": form if d else f"{form} (not directed)", "look": look_words(theme, base, design),
            "chapters": " / ".join(heads) or "(no chapters)", "limits": limits or ("none" if d else "-"),
            "voice": voice or "-"}


def ledger_upsert(row: dict, path: Path = MADE) -> None:
    """Put a video's row at the top of docs/made.md, replacing its old row; keep the newest MAX_ROWS rows."""
    cell = lambda x: str(x).replace("|", "/").replace("\n", " ").strip()  # noqa: E731
    line = "| " + " | ".join(cell(row.get(k, "-")) for k in COLS) + " |"
    rows = []
    if path.exists():
        body = path.read_text("utf-8").splitlines()
        sep = next((i for i, x in enumerate(body) if x.startswith("|---")), None)  # the table's own, of any width
        if sep is not None:
            rows = [x for x in body[sep + 1:] if x.startswith("| ")]
    # a row from before a column was added gets "-" in it, so the table keeps one width
    rows = [x.rstrip() + " - |" * max(0, len(COLS) + 2 - len(x.split("|"))) for x in rows]
    rows = [line] + [x for x in rows if [c.strip() for c in x.split("|")][2:3] != [cell(row["video"])]]
    tmp = path.with_suffix(".md.tmp")
    tmp.write_text("\n".join(HEAD + rows[:MAX_ROWS]) + "\n", "utf-8")
    os.replace(tmp, path)
