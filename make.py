"""
@file make.py
@description One command turns a video folder's spec.json into a narrated, captioned explainer MP4.
  Kokoro TTS per scene on the spoken form of "say" (local, cached by text hash; narration.py reads {shown|spoken}
  groups and maps the times back to the shown words; "voice": "zonos3:<name>" or --voice swaps in ZONOS3-Mini, whose
  server, takes, loudness, word times and retake gate live in zonos.py) -> word timings -> cue times + caption lines
  -> pictures and other assets -> build/props.json -> a Remotion render without sound, from a cached bundle
  -> the sound muxed in by ffmpeg -> MP4 + SRT/VTT + transcript + one contact-sheet PNG for a cheap visual check.
  A video may carry its own scene code (custom.py prepares and checks it; cues.py times it); render.py holds the
  bundle cache, the render cache and the error channel. direction.py reads the spec's "direction" block, holds the
  video to the limits the user stated (an error before the voice and the render), adds the nudges to the warnings
  and keeps docs/made.md. Claude sessions never read this file to make a video; SPEC.md is the interface.
@usage  .venv\\Scripts\\python make.py videos/<slug> [--preview] [--no-render] [--strip 3,7] [--still 3@2.5] [--report out.json]
        [--voice kokoro|zonos3:savannah] [--design looks/b.json]
        [--version]
@see SPEC.md (writing spec.json), CLAUDE.md (project rules), page.py (the video as self-contained web pages),
  zonos.py (the second voice)
"""
from __future__ import annotations

import argparse
import atexit
import hashlib
import json
import math
import os
import re
import shutil
import ssl
import sys
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
import soundfile as sf

import assets
import cues
import custom
import direction
import narration
import render
import sound
import zonos

ROOT = Path(__file__).resolve().parent
SR = 24000              # Kokoro output sample rate
LEAD, TAIL = 0.35, 0.8  # silence before / after each scene's narration, seconds
FPS = 30                # preview and --hd; the master renders at 60 (MASTER below)
MASTER = {"scale": 2, "fps": 60}  # 4K: the 1920x1080 layout rendered at 2x, so text and lines stay sharp
WPM = 150               # planning rate, words per minute of finished video (measured on videos/_demo, SPEC.md)
VERSION = assets.VERSION  # package.json "version", the one place it is kept
UA = assets.UA
TYPES = {"title", "points", "list", "recap", "analogy", "flow", "steps", "compare", "stat", "number",
         "chart", "bars", "timeline", "quote", "big", "definition", "code", "image", "svg", "sequence", "diagram", "plot", "stage3d",
         "custom", "world", "clip", "blender"}  # custom, world: scene code in the video's scenes/ folder (custom.py)
FREE = {"custom", "world", "clip", "blender"}  # v0.3 types: each list in the visual (beats, set, shots, labels) is its own timeline
ONLY2D_REFUSED = "holds the video to 2D"  # in the error kit/canvas.tsx throws when a video held to 2D mounts a <Stage>
GLUE = set(".,!?;:)]}\"'’”…%")  # tokens starting with these attach to the previous word in captions
CARD_S = 1.9            # chapter card: a silent beat before the first scene of each chapter (a scene with a heading)
CUT_S = {"glide": 1.0, "rise": 0.6, "fade": 0.6, "none": 0.0}  # cut lengths; all fit the silence between voices
CONTINUITY = {"sequence": "actors", "diagram": "nodes"}  # same type + shared members = one drawing across the cut
THEMES = json.loads((ROOT / "src" / "themes.json").read_text("utf-8"))
# How Remotion encodes the 4K 60 fps master (measured 2026-11-14; what the flags do: docs/research/motion.md): NVENC on the GPU leaves the CPU
# to Chrome, which captures the frames.
MASTER_ENCODE = ["--hardware-acceleration=if-possible", "--video-bitrate=45M"]
# Master tabs, measured 16 Nov 2026: 3D 10.5 s/s at 2 tabs (RAM min 3.6 GB free), 9.1 at 3 and 4 (1.8 and 0.3 GB), 6+ out of RAM; 2D 5.9 s/s at 8, 7.0 at 4.
MASTER_TABS = {"3d": 2, "2d": 8}
GLYPHS = ["lock", "lock-fill", "key", "eye", "warning", "envelope"]  # standard glyphs every template may use, in the theme's icon set


def member_names(visual: dict) -> set:
    key = CONTINUITY.get(visual.get("type"), "")
    return {(x if isinstance(x, str) else str(x.get("id") or x.get("name") or x.get("label") or "")) for x in visual.get(key) or []}


def luminance(hex_: str) -> float:
    h = hex_.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    rgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def contrast(a: str, b: str) -> float:
    la, lb = sorted((luminance(a), luminance(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def check_design(th: dict, warns: list) -> None:
    """WCAG checks for a theme with the video's own design merged in (F-005: a design may be made for the topic)."""
    def hexes(*xs):
        return all(isinstance(x, str) and re.fullmatch(r"#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?", x) for x in xs)
    cap = th.get("caption", {})
    plate = cap.get("plate") if cap.get("plate") not in (None, "transparent") else th["bg"]
    for name, fg, bg, need in (("ink on ground", th["ink"], th["bg"], 4.5), ("ink2 on ground", th["ink2"], th["bg"], 4.5),
                               ("stepped-back ink on ground", th["back"], th["bg"], 3.0), ("ink on surface", th["ink"], th["surface"], 4.5),
                               ("caption ink on its plate", cap.get("ink", th["ink"]), plate, 4.5)):
        if hexes(fg, bg) and contrast(fg, bg) < need:
            warns.append(f"design: {name} is {contrast(fg, bg):.2f}:1, below {need}:1 (WCAG AA)")


def design_fonts(design: dict, pub: Path, warns: list) -> list:
    """A design may name any Fontsource family; built-in faces (fonts.ts) need nothing. -> [{family, url, weight}]"""
    builtin = {"Atkinson Hyperlegible Next", "Atkinson Hyperlegible Mono", "Recursive", "Archivo"}
    out = []
    for role, fam in (design.get("font") or {}).items():
        if not fam or fam in builtin:
            continue
        fid = re.sub(r"[^a-z0-9]+", "-", fam.lower()).strip("-")
        try:
            meta = json.loads(http_get(f"https://api.fontsource.org/v1/fonts/{fid}")[0])
            (pub / "fonts").mkdir(parents=True, exist_ok=True)
            for w in ("400", "500", "600", "700"):
                v = ((meta.get("variants") or {}).get(w) or {}).get("normal") or {}
                url = ((v.get("latin") or next(iter(v.values()), {})).get("url") or {}).get("woff2")
                if not url:
                    continue
                rel = f"fonts/{fid}-{w}.woff2"
                if not (pub / rel).exists():
                    (pub / rel).write_bytes(http_get(url)[0])
                out.append({"family": meta.get("family", fam), "url": rel, "weight": w})
            design["font"][role] = meta.get("family", fam)
        except Exception as exc:  # noqa: BLE001  a missing font falls back to the theme's face
            warns.append(f"design: font '{fam}' ({role}) not found on Fontsource: {exc}")
            design["font"][role] = None
    design["font"] = {k: v for k, v in (design.get("font") or {}).items() if v}
    return out


def pick_cut(prev: dict, cur: dict, spec_cut) -> str:
    """The cut into a scene: none when the drawing carries on, rise at a chapter change, glide inside a chapter."""
    if spec_cut in CUT_S:
        return spec_cut
    if prev.get("kind") == "card" or cur.get("kind") == "card" or cur.get("heading"):
        return "rise"
    pv, cv = prev["visual"], cur["visual"]
    if pv.get("type") == cv.get("type") and pv.get("type") in CONTINUITY and member_names(pv) & member_names(cv):
        return "none"
    if cv.get("world") and cv.get("world") == pv.get("world"):
        return "none"  # two views of one world (v0.3): the picture carries on and the camera glides
    return "glide"


def scene_list(text: str, n: int) -> list:
    """--strip "5", "3,7,12" or "3-6" -> scene numbers."""
    out = []
    try:
        for part in str(text).split(","):
            a, _, b = part.strip().partition("-")
            out += list(range(int(a), int(b or a) + 1))
    except ValueError:
        out = []
    if not out or any(not 1 <= x <= n for x in out):
        sys.exit(f"--strip {text}: give scene numbers between 1 and {n}, for example 5 or 3,7,12 or 3-6")
    return sorted(set(out))



def still_list(text: str, n: int) -> list:
    """--still "3@2.5" or "3@2.5,7@0" -> [(scene number, seconds in that scene)]."""
    out = []
    try:
        for part in str(text).split(","):
            a, _, b = part.strip().partition("@")
            out.append((int(a), float(b)))
    except ValueError:
        out = []
    if not out or any(not 1 <= num <= n for num, _ in out):
        sys.exit(f"--still {text}: give a scene number between 1 and {n}, an @ and seconds in that scene, for example 3@2.5")
    return out


_pipes: dict = {}


def kpipe(lang: str):
    if lang not in _pipes:
        from kokoro import KPipeline  # heavy import, only when something must be synthesized
        _pipes[lang] = KPipeline(lang_code=lang, repo_id="hexgrad/Kokoro-82M")
    return _pipes[lang]


def synth(text: str, voice: str, speed: float, cache: Path):
    """Narration audio + word timings for one scene. Cached, so re-runs only synthesize changed scenes."""
    key = hashlib.sha1(f"{voice}|{speed}|{text}".encode("utf-8")).hexdigest()[:16]
    wav_p, js_p = cache / f"{key}.wav", cache / f"{key}.json"
    if wav_p.exists() and js_p.exists():
        audio, _ = sf.read(wav_p, dtype="float32")
        return audio, json.loads(js_p.read_text("utf-8"))
    parts, words, offset = [], [], 0.0
    for res in kpipe(voice[0])(text, voice=voice, speed=speed):
        if res.audio is None:
            continue
        a = res.audio.detach().cpu().numpy() if hasattr(res.audio, "detach") else np.asarray(res.audio)
        a = a.astype("float32").reshape(-1)
        glue = False
        for tok in res.tokens or []:
            t = (getattr(tok, "text", "") or "").strip()
            if not t:
                continue
            s, e = getattr(tok, "start_ts", None), getattr(tok, "end_ts", None)
            if s is None or e is None:
                s = e = words[-1]["e"] if words else offset
            else:
                s, e = s + offset, e + offset
            if words and (glue or t[0] in GLUE):
                words[-1]["w"] += t
                words[-1]["e"] = round(max(words[-1]["e"], e), 3)
            else:
                words.append({"w": t, "s": round(s, 3), "e": round(e, 3)})
            glue = getattr(tok, "whitespace", " ") == ""
        parts.append(a)
        offset += len(a) / SR
    audio = np.concatenate(parts) if parts else np.zeros(1, dtype="float32")
    sf.write(wav_p, audio, SR)
    js_p.write_text(json.dumps(words), "utf-8")
    return audio, words


def norm(s: str) -> str:
    return re.sub(r"[^0-9a-z]+", "", s.lower())


def find_cue(words: list, cue: list, start: int):
    nw = [norm(w["w"]) for w in words]
    for i in range(start, len(nw)):
        if nw[i].startswith(cue[0]) and all(i + j < len(nw) and nw[i + j].startswith(c) for j, c in enumerate(cue[1:], 1)):
            return i
    return None


def resolve_cues(node, words: list, ptr: list, warns: list, n: int) -> None:
    """Old templates. Depth-first in document order: every dict with "cue" gets "at" = seconds from scene start. A cue
    is looked for after the previous one, then from the start. "nth": 2 picks the second time the words are spoken.
    Free and world visuals have their own grammar (cues.py)."""
    if isinstance(node, dict):
        if isinstance(node.get("cue"), str) and "at" in node and not cues.is_num(node["at"]):
            warns.append(f"scene {n}: cue '{node['cue']}' sits beside a non-numeric \"at\", so it is not used (\"at\" is a time in seconds)")
        if isinstance(node.get("cue"), str) and "at" not in node:
            cue = [norm(x) for x in node["cue"].split() if norm(x)]
            hit = None
            if cue and isinstance(node.get("nth"), int):
                pos = 0
                for _ in range(max(1, node["nth"])):
                    hit = find_cue(words, cue, pos)
                    if hit is None:
                        break
                    pos = hit + 1
            elif cue:
                hit = find_cue(words, cue, ptr[0])
                if hit is None:
                    hit = find_cue(words, cue, 0)
            if hit is None:
                warns.append(f"scene {n}: cue '{node['cue']}' is not in the narration (item uses default timing)")
            else:
                node["at"] = round(max(0.0, words[hit]["s"] - 0.12), 3)
                ptr[0] = hit + 1
        for k, v in node.items():
            if k != "image":
                resolve_cues(v, words, ptr, warns, n)
    elif isinstance(node, list):
        for x in node:
            resolve_cues(x, words, ptr, warns, n)


def caption_lines(words: list, max_chars: int = 44, max_words: int = 9) -> list:
    out, cur = [], []
    for w in words:
        cur.append(w)
        n = sum(len(x["w"]) + 1 for x in cur)
        end = w["w"][-1:]
        if end in ".!?" or (end in ",;:" and n > 22) or n >= max_chars or len(cur) >= max_words:
            out.append(cur)
            cur = []
    if cur:
        if out and len(cur) == 1 and sum(len(x["w"]) + 1 for x in out[-1]) + len(cur[0]["w"]) < max_chars + 8:
            out[-1].extend(cur)
        else:
            out.append(cur)
    return out


def ssl_ctx() -> ssl.SSLContext:
    """certifi's current CA bundle: a Windows certificate store that is out of date fails on Wikimedia ("certificate
    has expired")."""
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


def http_get(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=40, context=ssl_ctx()) as r:
        return r.read(), r.headers.get_content_type()


def commons(query: str):
    """First freely licensed JPEG/PNG on Wikimedia Commons for a search phrase -> (url, credit)."""
    api = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "format": "json", "generator": "search", "gsrnamespace": 6, "gsrlimit": 10,
        "gsrsearch": f"{query} filetype:bitmap", "prop": "imageinfo", "iiprop": "url|extmetadata|mime",
        "iiurlwidth": 1600})
    data = json.loads(http_get(api)[0])
    pages = sorted(((data.get("query") or {}).get("pages") or {}).values(), key=lambda p: p.get("index", 99))
    for p in pages:
        ii = (p.get("imageinfo") or [{}])[0]
        if ii.get("mime") in ("image/jpeg", "image/png") and (ii.get("thumburl") or ii.get("url")):
            md = ii.get("extmetadata") or {}
            artist = re.sub(r"<[^>]+>", "", (md.get("Artist") or {}).get("value", "")).strip()[:60]
            lic = (md.get("LicenseShortName") or {}).get("value", "")
            return ii.get("thumburl") or ii["url"], ", ".join(x for x in (artist, lic, "Wikimedia Commons") if x)
    return None, None


EXT = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif", "image/svg+xml": ".svg"}


def fetch_image(ref, vdir: Path, pub: Path, cache: dict, used: list, warns: list, ctx: dict | None = None):
    """An image: a file path, an https URL, or an asset request (a search phrase, or {q, kind, pick, provider}).
    Requests search every keyed provider (assets.py); "pick" is the number on the --assets contact sheet."""
    ctx = ctx or {}
    is_url = isinstance(ref, str) and ref.startswith(("http://", "https://"))
    is_file = isinstance(ref, str) and not is_url and (Path(ref) if Path(ref).is_absolute() else vdir / ref).is_file()
    if not (is_url or is_file):
        req = ref if isinstance(ref, dict) else {"q": str(ref).removeprefix("commons:").strip()}
        kind, q = req.get("kind", "photo"), str(req.get("q") or req.get("query") or "")
        prov = req.get("provider") or ("wikimedia" if str(ref).startswith("commons:") else None)
        pick = int(req.get("pick") or 1)
        tag = f"{kind}|{q}|{prov or ''}|{pick}"
        if tag in cache and (pub / cache[tag]["src"]).exists():
            used.append(cache[tag])
            return cache[tag]
        try:
            hits, status = assets.search(kind, q, ctx.get("topic"), prov, 12, ctx)
            if len(hits) < pick:
                raise ValueError(f"only {len(hits)} results ({'; '.join(f'{k} {v}' for k, v in status.items())})")
            h = hits[pick - 1]
            if not req.get("pick"):
                warns.append(f"image '{q}': no pick given, used #1 ({h['provider']}); make.py --assets shows the choices")
            if {"NC", "ND", "COPYRIGHT"} & set(h["flags"]):
                warns.append(f"image '{q}': {h['license']} ({'/'.join(h['flags'])}), fine for a private video only")
            rel = assets.fetch(h, pub)
            e = assets.ledger_entry(h, rel, tag)
            got = {"src": rel, "credit": assets.credit(e), "ref": tag, "ledger": e}
            cache[tag] = got
            used.append(got)
            return got
        except Exception as exc:  # a missing picture must never stop a render: the template falls back to its icon
            warns.append(assets.scrub(f"image '{q}': {exc}"))
            return None
    # A URL is cached by its address. A local file is cached by its content, so an edited file is a new name in the
    # public folder and a new render key; keyed by its path, the old copy and the old render were reused silently.
    local = (Path(ref) if Path(ref).is_absolute() else vdir / ref) if is_file else None
    try:
        data = local.read_bytes() if local else None
    except OSError as exc:
        warns.append(f"image '{ref}': {exc}")
        return None
    key_ = hashlib.sha1(ref.encode("utf-8") + (b"\0" + data if data is not None else b"")).hexdigest()[:12]
    if key_ in cache and (pub / cache[key_]["src"]).exists():
        used.append(cache[key_])
        return cache[key_]
    try:
        if local:
            ext, credit = local.suffix.lower() or ".png", ""
        else:
            data, ctype = http_get(ref)
            ext, credit = EXT.get(ctype) or Path(urllib.parse.urlparse(ref).path).suffix or ".jpg", urllib.parse.urlparse(ref).netloc
        rel = f"img/{key_}{ext}"
        (pub / "img").mkdir(parents=True, exist_ok=True)
        (pub / rel).write_bytes(data)
        cache[key_] = {"src": rel, "credit": credit, "ref": ref}
        used.append(cache[key_])
        return cache[key_]
    except Exception as exc:  # noqa: BLE001
        warns.append(f"image '{ref}': {exc}")
        return None


def resolve_images(node, *ctx) -> None:
    if isinstance(node, dict):
        for k in list(node):
            if k == "image" and (isinstance(node[k], str) or (isinstance(node[k], dict) and "src" not in node[k])):
                node[k] = fetch_image(node[k], *ctx)
            else:
                resolve_images(node[k], *ctx)
    elif isinstance(node, list):
        for x in node:
            resolve_images(x, *ctx)


def asset_requests(spec: dict) -> list:
    """Every searchable asset a spec asks for: image phrases and objects, the requests in the "assets" block of a
    visual or a world, plus the optional "assets" planning list at the top of the spec."""
    top = spec.get("assets")
    reqs = [r if isinstance(r, dict) else {"q": r} for r in (top if isinstance(top, list) else [])]

    def walk(n):
        if isinstance(n, dict):
            for k, v in n.items():
                if k == "image" and isinstance(v, dict):
                    reqs.append(v)
                elif k == "image" and isinstance(v, str) and not v.startswith(("http://", "https://")) and not Path(v).suffix:
                    reqs.append({"q": v.removeprefix("commons:")})
                elif k == "assets" and isinstance(v, dict):  # {name: a request or a file path}; a file needs no search
                    reqs.extend(r for r in v.values() if isinstance(r, dict) and (r.get("q") or r.get("query")) and "src" not in r)
                else:
                    walk(v)
        elif isinstance(n, list):
            for x in n:
                walk(x)
    walk(spec.get("worlds"))
    walk(spec.get("scenes"))
    return reqs


def contact_sheets(spec: dict, vdir: Path, build: Path, out: Path, pub: Path, entry: str) -> list:
    """make.py --assets: one numbered contact sheet per request, every provider merged, in out/assets/."""
    jobs = []
    (out / "assets").mkdir(parents=True, exist_ok=True)
    (pub / "sheet").mkdir(parents=True, exist_ok=True)
    theme = THEMES["themes"].get(spec.get("theme") or THEMES["default"], {})
    report = []
    for i, r in enumerate(asset_requests(spec), 1):
        kind, q, prov = r.get("kind", "photo"), str(r.get("q") or r.get("query") or ""), r.get("provider")
        hits, status = assets.search(kind, q, spec.get("topic"), prov, 12, {"prefixes": theme.get("icons", ["bi"]), "private": spec.get("private")})
        items = []
        for n, h in enumerate(hits, 1):
            thumb = None
            if h.get("thumb"):
                try:
                    data, ctype = http_get(h["thumb"])
                    thumb = f"sheet/{i:02d}-{n:02d}{EXT.get(ctype, '.jpg')}"
                    (pub / thumb).write_bytes(data)
                except Exception:  # noqa: BLE001  a missing thumbnail still leaves the numbered cell
                    thumb = None
            dur = (h.get("extra") or {}).get("duration")
            meta = ", ".join(x for x in (assets.NAMES.get(h["provider"], h["provider"]), h["license"], f"{float(dur):.0f} s" if dur else "") if x)
            items.append({"n": n, "thumb": thumb, "svg": (h.get("extra") or {}).get("svg"), "title": h["title"] or h["id"], "meta": meta,
                          "flags": [f for f in h["flags"] if f != "REJECT"]})
        slug = re.sub(r"[^a-z0-9]+", "-", q.lower()).strip("-")[:40] or "query"
        png = out / "assets" / f"{i:02d}-{kind}-{slug}{'-' + prov if prov else ''}.png"
        props = build / f"sheet-{i:02d}.json"
        props.write_text(json.dumps({"title": f"{i}. {kind}: {q}" + (f" ({prov})" if prov else ""), "items": items}, ensure_ascii=False), "utf-8")
        if items:
            jobs.append((png, props))
        report.append({"request": f"{kind}: {q}" + (f" ({prov})" if prov else ""), "results": len(items), "providers": status,
                       "sheet": str(png) if items else None})
    if jobs:  # the thumbnails are in the public folder by now; the mirror carries them into the bundle
        bdir, _code, _note = render.bundle(vdir, build, entry, pub)
        render.mirror(pub, bdir, ("narration.wav",))
        for png, props in jobs:
            render.still(bdir, "Sheet", png, props, 0, gl=False)
    return report


def prune_public(pub: Path, props: dict, img_cache: dict) -> list:
    """Remove the copies in build/public/img and build/public/assets/local-* that the props no longer name. Both are
    named after their content, so every edit of a local picture or model left its old copy behind, and the bundle
    mirror carried it along. A .gltf copy is a folder (assets/local-<tag>/), kept whole while its .gltf is named.
    Cache entries that pointed at a removed copy are dropped too. -> the removed paths, relative to `pub`."""
    named: set = set()

    def walk(node) -> None:
        if isinstance(node, dict):
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)
        elif isinstance(node, str) and node.startswith(("img/", "assets/local-")):
            named.add(node)
            if node.startswith("assets/local-") and node.count("/") > 1:
                named.add("/".join(node.split("/")[:2]))  # the folder of a .gltf and the files it names
    walk(props)
    gone = []
    candidates = list((pub / "img").glob("*")) + list((pub / "assets").glob("local-*"))
    for p in candidates:
        name = p.relative_to(pub).as_posix()
        if name in named:
            continue
        if p.is_dir():
            shutil.rmtree(p, ignore_errors=True)
        else:
            p.unlink(missing_ok=True)
        gone.append(name)
    for k in [k for k, v in img_cache.items() if isinstance(v, dict) and v.get("src") in gone]:
        del img_cache[k]
    return gone


def ts(t: float, sep: str) -> str:
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02}{sep}{ms:03}"


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="spec.json -> narrated, captioned explainer MP4")
    ap.add_argument("--version", action="version", version=f"Scene Lab {VERSION}")
    ap.add_argument("video_dir", help="folder containing spec.json, e.g. videos/my-topic")
    ap.add_argument("--preview", action="store_true", help="render at half resolution (faster check)")
    ap.add_argument("--no-render", action="store_true", help="only narration, timings, subtitles and props")
    ap.add_argument("--master", action="store_true", help="the 4K 60 fps master; only when the user asks (F-007)")
    ap.add_argument("--hd", action="store_true", help="1080p at 30 fps (the default when neither --preview nor --master)")
    ap.add_argument("--save-theme", metavar="NAME", help="save this video's design as a named theme (only when the user says save)")
    ap.add_argument("--theme", help="override the spec's theme (see src/themes.json)")
    ap.add_argument("--design", metavar="FILE",
                    help="render in another look without editing the spec: a JSON file holding a design (with an optional "
                         "\"theme\") or {\"theme\": ..., \"design\": {...}}; it replaces the spec's design (and theme) for "
                         "this run, and its strips, stills, video and sheet go to out/look-<file name>/")
    ap.add_argument("--assets", action="store_true", help="contact sheets for every asset request in the spec, out/assets/")
    ap.add_argument("--strip", metavar="N",
                    help="filmstrip of scene N (1-based) in one PNG, out/strip-NN.png: 8 frames, more when a free scene has "
                         "more timed changes; several scenes as 3,7,12 or 3-6; skips the video render")
    ap.add_argument("--still", metavar="N@T",
                    help="one 1920x1080 PNG of scene N at T seconds of that scene, out/still-NN-T.png; several as "
                         "3@2.5,7@0; skips the video render")
    ap.add_argument("--concurrency", type=int, metavar="N",
                    help="browser tabs that render frames at once, for any render (default: for a --master 2 when the "
                         "video draws 3D and 8 when it is 2D only, else Remotion's own: half the CPU threads, at most 8)")
    ap.add_argument("--fps", type=int, metavar="N",
                    help="frame rate of the rendered video (default: 30, or 60 for --master); every time is in seconds, so "
                         "a 30 fps master shows the same pictures at the same times as the 60 fps one")
    ap.add_argument("--voice", metavar="VOICE",
                    help="the narration voice for every scene, over the spec's \"voice\": kokoro (Kokoro af_heart, the "
                         "default), a Kokoro voice name such as bf_emma, or zonos3:<stock voice> such as zonos3:savannah")
    ap.add_argument("--no-typecheck", action="store_true", help="skip the type check of the video's scene code (custom.py)")
    ap.add_argument("--report", metavar="PATH",
                    help="also write the JSON report to this file; standard output carries Remotion's progress and the "
                         "browser's console lines before it")
    args = ap.parse_args()
    if args.concurrency is not None and not 1 <= args.concurrency <= (os.cpu_count() or 1):
        ap.error(f"--concurrency must be 1 to {os.cpu_count() or 1} (the CPU threads of this machine)")
    if args.fps is not None and not 1 <= args.fps <= 120:
        ap.error("--fps must be 1 to 120")
    report_p = Path(args.report).resolve() if args.report else None
    if report_p:  # a file left by an earlier run must not pass for this run's report when this one stops early
        try:  # and a path that cannot be written stops the run now, not after the render
            report_p.parent.mkdir(parents=True, exist_ok=True)
            report_p.unlink(missing_ok=True)
            report_p.touch()
            report_p.unlink()
        except OSError as e:
            ap.error(f"--report {report_p}: cannot write there ({e.strerror or e})")

    def emit(obj: dict) -> None:
        """The report: printed last on standard output, and written to --report when it is given. It names the
        engine version it was made with."""
        text = json.dumps({"version": VERSION, **obj}, indent=1, ensure_ascii=False)
        print(text)
        if report_p:
            try:
                report_p.parent.mkdir(parents=True, exist_ok=True)
                report_p.write_text(text, "utf-8")
            except OSError as e:
                print(f"--report {report_p}: not written ({e.strerror or e}); the report is above", file=sys.stderr)

    vdir = Path(args.video_dir).resolve()
    try:
        spec = json.loads((vdir / "spec.json").read_text("utf-8"))
    except FileNotFoundError:
        sys.exit(f"{vdir / 'spec.json'} not found")
    except json.JSONDecodeError as e:
        sys.exit(f"spec.json line {e.lineno} column {e.colno}: {e.msg}")
    if not isinstance(spec, dict) or not isinstance(spec.get("scenes"), list):
        sys.exit("spec.json: the top level must be an object with a \"scenes\" list")
    slug = vdir.name
    build, out = vdir / "build", vdir / "out"
    pub, tts_cache = build / "public", build / "tts"
    look_out, look_note = out, None  # where the pictures of this run go: out/, or out/look-<name>/ for --design
    if args.design:  # another look for this run only: the spec's file is not touched
        dfile = Path(args.design).resolve()
        try:
            dj = json.loads(dfile.read_text("utf-8"))
        except OSError as e:
            sys.exit(f"--design {args.design}: {e.strerror or e}")
        except json.JSONDecodeError as e:
            sys.exit(f"--design {args.design}: line {e.lineno} column {e.colno}: {e.msg}")
        if not isinstance(dj, dict) or ("design" in dj and not isinstance(dj["design"], dict)):
            sys.exit(f"--design {args.design}: the file must hold a design object ({{\"bg\": ..., \"ink\": ...}}, with an "
                     f"optional \"theme\"), or {{\"theme\": ..., \"design\": {{...}}}}")
        if "design" in dj:
            dtheme, ddesign = dj.get("theme"), dict(dj["design"])
        else:
            ddesign = dict(dj)
            dtheme = ddesign.pop("theme", None)
        spec["design"] = ddesign
        if dtheme:
            spec["theme"] = dtheme
        look_name = re.sub(r"[^a-z0-9-]+", "-", dfile.stem.lower()).strip("-") or "design"
        look_out = out / f"look-{look_name}"
        look_note = f"design from {dfile.name}" + (f", theme {dtheme}" if dtheme else "") + f"; pictures in out/look-{look_name}"
    for d in (pub, tts_cache, out, look_out):
        d.mkdir(parents=True, exist_ok=True)
    # One run per video folder (architecture section 3). atexit removes the lock on a normal end, sys.exit and
    # Ctrl+C; a lock left by a run that was killed names a dead process and the next run takes it over.
    try:
        held = render.lock(build, " ".join(sys.argv[2:]) or "full render")
    except render.Failed as exc:
        sys.exit(str(exc))
    atexit.register(render.unlock, held)
    voice, speed = args.voice or spec.get("voice", "af_heart"), float(spec.get("speed", 1.0))

    def voice_of(sc: dict) -> str:
        """A scene's voice: --voice over the scene's own over the spec's. "kokoro" is Kokoro's af_heart, so its
        cache key (and every cached scene) is the one a spec without "voice" has always had."""
        v = args.voice or sc.get("voice", voice)
        return "af_heart" if str(v).strip().lower() == "kokoro" else v
    warns: list = []
    theme = args.theme or spec.get("theme") or THEMES["default"]
    if theme not in THEMES["themes"]:
        warns.append(f"theme '{theme}' does not exist (have: {', '.join(THEMES['themes'])}); using {THEMES['default']}")
        theme = THEMES["default"]
    design = json.loads(json.dumps(spec.get("design") or {}))
    if args.save_theme:  # F-006: a design the user liked becomes a theme any later video can name
        name = re.sub(r"[^a-z0-9-]+", "-", args.save_theme.lower()).strip("-")
        saved = json.loads(json.dumps(THEMES["themes"][theme]))
        for k, v in design.items():
            saved[k] = {**saved.get(k, {}), **v} if isinstance(v, dict) and isinstance(saved.get(k), dict) else v
        saved["id"] = name
        THEMES["themes"][name] = saved
        (ROOT / "src" / "themes.json").write_text(json.dumps(THEMES, indent=2, ensure_ascii=False), "utf-8")
        emit({"saved_theme": name, "from": slug, "base": theme})
        return
    prefixes = design.get("icons") or THEMES["themes"][theme]["icons"]
    if isinstance(prefixes, str):
        prefixes = [prefixes]
    video_run = not (args.strip or args.still or args.no_render)  # strips and stills pick frames by time at the base rate
    fps = MASTER["fps"] if (args.master and not args.preview and video_run) else FPS
    if args.fps and video_run:  # the props carry fps, so a new rate is a new render key
        fps = args.fps
    assets.ICON_SUFFIX.update({p: THEMES["themes"][theme].get("iconSuffix", "") for p in prefixes})
    # a design that brings its own icon set brings its own name aliases (or none)
    assets.ICON_ALIAS.update(design.get("iconAlias", {}) if design.get("icons") else THEMES["themes"][theme].get("iconAlias", {}))
    icons_used: dict = {}
    # The direction and the limits the user stated (direction.py, F-015): a broken limit stops the run here, before
    # the voice and before any render, also under --strip, --still and --assets
    directed = direction.check(spec, vdir, theme, design, FREE)
    warns += directed["warnings"]
    if directed["errors"]:
        emit({"scenes": len(spec["scenes"]), "warnings": warns, "errors": directed["errors"]})
        sys.exit(1)
    cards = spec.get("chapter_cards", True)
    n_chapters = sum(1 for sc in spec["scenes"] if sc.get("heading"))
    # {shown|spoken} groups in "say" (narration.py, F-013): a group that cannot be read stops the run here, before
    # the voice would read its braces aloud and before the slow type check
    say_errors: list = []
    for n, sc in enumerate(spec["scenes"], 1):
        narration.check(sc.get("say") or "", n, say_errors, warns)
    if say_errors:
        emit({"scenes": len(spec["scenes"]), "warnings": warns, "errors": say_errors})
        sys.exit(1)
    # The second voice (zonos.py): what it needs is checked before the slow type check, in one line
    zvoices: dict = {}  # stock voice name -> zonos.Voice, made when its first scene is synthesized
    if any(zonos.parse(voice_of(sc)) for sc in spec["scenes"] if sc.get("say")):
        line = zonos.missing()
        if line:
            sys.exit(line)
        if speed != 1.0:
            warns.append(f"\"speed\": {speed} applies to Kokoro only; the ZONOS3 voice speaks at its own rate")
    # Scene code written for this video (scenes/*.tsx): its own Remotion entry, lint and type check (custom.py).
    prep = custom.prepare(vdir, spec, build, warns, check=not (args.no_typecheck or args.assets))

    # 1. Narration, scene timing, cues, captions. A scene with a heading opens a chapter: a silent card first.
    scenes, captions, clips, chapters, t = [], [], [], [], 0.0
    cue_table: list = []   # one line per timed entry of every free scene, for the report
    cue_errors: list = []  # a cue that is not spoken: the render must not start
    for n, sc in enumerate(spec["scenes"], 1):
        if sc.get("heading"):
            if cards:
                scenes.append({"start": round(t, 3), "dur": CARD_S, "kind": "card", "heading": sc["heading"],
                               "visual": {"type": "chapter", "title": sc["heading"], "n": len(chapters) + 1, "of": n_chapters}})
                chapters.append({"title": sc["heading"], "start": round(t, 3), "card": {"start": round(t, 3), "dur": CARD_S}})
                t += CARD_S
            else:
                chapters.append({"title": sc["heading"], "start": round(t, 3)})
        segs = narration.parse(sc.get("say") or "")
        say = narration.spoken(segs)  # the voice and its cache get the spoken form ...
        sv = voice_of(sc)
        zname = zonos.parse(sv)
        if not say:
            audio, words = None, []
        elif zname:
            if zname not in zvoices:
                zvoices[zname] = zonos.Voice(zname, tts_cache, SR, build)
                atexit.register(zvoices[zname].stop)  # a run that stops early still stops the server it started
            try:
                audio, words = zvoices[zname].synth(say, n)
            except zonos.Unavailable as exc:
                sys.exit(str(exc))
        else:
            audio, words = synth(say, sv, speed, tts_cache)
        words = narration.shown_words(segs, words)  # ... everything after it (cues, captions, props) the shown form
        # "pause": extra stillness after the narration, so the last reveal holds before the cut
        dur = max(LEAD + len(audio) / SR + TAIL + float(sc.get("pause") or 0) if say else 0.0, float(sc.get("hold") or 0), 2.0)
        rel = [{"w": w["w"], "s": round(LEAD + w["s"], 3), "e": round(LEAD + w["e"], 3)} for w in words]
        visual = json.loads(json.dumps(sc.get("visual") or {"type": "points", "items": []}))
        if visual.get("type") not in TYPES:
            warns.append(f"scene {n}: unknown visual type '{visual.get('type')}' (rendered as points)")
        if visual.get("type") in FREE:  # the cue grammar of free and world visuals: cues.py
            cues.resolve_free(visual, rel, n, warns, cue_errors, cue_table, round(dur, 3),
                              follows=cues.follows(scenes[-1] if scenes else None, visual))
        else:
            resolve_cues(visual, rel, [0], warns, n)
        assets.resolve_icons(visual, prefixes, warns, f"scene {n}", icons_used)
        for o in visual.get("objects") or [] if visual.get("type") == "stage3d" else []:
            src = o.get("src")
            if isinstance(src, str) and src.endswith(".json"):  # 3D data is inlined, so the template never fetches it
                f = Path(src) if Path(src).is_absolute() else vdir / src
                try:
                    o["data"] = json.loads(f.read_text("utf-8"))
                    o.pop("src")
                except (OSError, ValueError) as exc:
                    warns.append(f"scene {n}: 3D data '{src}': {exc}")
        if dur > 45:
            warns.append(f"scene {n} lasts {dur:.0f}s on one visual: split it")
        scenes.append({"start": round(t, 3), "dur": round(dur, 3), "heading": sc.get("heading"), "visual": visual,
                       "n": n, "spec_cut": sc.get("cut"), "words": rel})  # words in scene seconds, for scene code
        if audio is not None:
            clips.append((t + LEAD, audio))
        absw = [{"w": w["w"], "s": round(t + w["s"], 3), "e": round(t + w["e"], 3)} for w in rel]
        captions += [{"s": ln[0]["s"], "e": ln[-1]["e"], "words": ln} for ln in caption_lines(absw)]
        t += dur
    total = round(t, 3)
    # the nudges (direction.py): not directed, the stock look, sameness, all templates; warnings only, none in "_" demos
    warns += direction.nudges(spec, slug, theme, design, total, FREE, continues=lambda a, b: (
        a.get("type") == b.get("type") and a.get("type") in CONTINUITY and bool(member_names(a) & member_names(b))))
    for zv in zvoices.values():  # the narration is made: free the card (or the CPU) for the render
        zv.stop()
        for f in zv.failed:  # a take the gate rejected is never used silently
            warns.append(f"scene {f['scene']}: voice: piece {f['piece']} still fails after {zonos.RETAKES} retakes "
                         f"({'; '.join(f['bad'])}); its best take (seed {f['kept_seed']}) is used: listen to it")
    for k, s in enumerate(scenes):
        spec_cut = s.pop("spec_cut", None)
        wid = s["visual"].get("world") if s["visual"].get("type") == "world" else None
        if k and wid and spec_cut in CUT_S and spec_cut != "none" and scenes[k - 1]["visual"].get("world") == wid:
            # src/Explainer.tsx joins two views of one world only when nothing cuts between them, while the world's
            # state (src/kit/world.ts) carries on from the scene before either way
            warns.append(f"scene {s['n']}: \"cut\": \"{spec_cut}\" between two views of the world \"{wid}\" plays the cut and "
                         f"mounts the world again for this scene (a new canvas; its state still carries on); "
                         f"leave \"cut\" out to keep one continuous picture")
        cut = pick_cut(scenes[k - 1], s, spec_cut) if k else None
        if cut:
            s["cut"] = {"type": cut, "s": CUT_S[cut]}
    for i, c in enumerate(chapters):
        c["end"] = chapters[i + 1]["start"] if i + 1 < len(chapters) else total
    glyphs = {g: assets.resolve_icon(g, prefixes, warns, "glyphs", icons_used) for g in GLYPHS}
    if spec.get("motif"):
        glyphs["motif"] = assets.resolve_icon(spec["motif"], prefixes, warns, "motif", icons_used)
    base = json.loads(json.dumps(THEMES["themes"][theme]))
    for k, v in design.items():
        base[k] = {**base.get(k, {}), **v} if isinstance(v, dict) and isinstance(base.get(k), dict) else v
    check_design(base, warns)
    fonts = design_fonts(design, pub, warns) if design.get("font") else []
    theme_font = {"font": dict(THEMES["themes"][theme].get("font") or {})}  # a saved theme may name a Fontsource face too
    if not design.get("font"):
        fonts += design_fonts(theme_font, pub, warns)
    buf = np.zeros(int(math.ceil(total * SR)) + SR, dtype="float32")
    for start, a in clips:
        i0 = int(start * SR)
        buf[i0:i0 + len(a)] = a[: len(buf) - i0]
    sf.write(pub / "narration.wav", buf, SR)

    # 2. Pictures and other assets: search phrases, URLs or files -> build/public, with credits.
    img_p = build / "images.json"
    img_cache = json.loads(img_p.read_text("utf-8")) if img_p.exists() else {}
    used: list = []
    if args.assets:
        emit({"asset_sheets": contact_sheets(spec, vdir, build, out, pub, prep["entry"])})
        return
    actx = {"topic": spec.get("topic"), "prefixes": prefixes, "private": spec.get("private"), "fetch_image": fetch_image,
            "placeholders": []}  # placeholders: what could not be made (an asset, the sound mix), for the report
    worlds = json.loads(json.dumps(spec.get("worlds") or {}))
    for wid, w in (worlds.items() if isinstance(worlds, dict) else ()):  # the "assets" block of every world ...
        if isinstance(w, dict):
            assets.resolve_assets(w, vdir, pub, img_cache, used, warns, {**actx, "where": f"world {wid}"})
            assets.resolve_icons(w.get("props"), prefixes, warns, f"world {wid}", icons_used)  # as in a scene's visual
    for s in scenes:  # ... and of every free or world visual, before the props are written
        if s["visual"].get("type") in FREE:
            assets.resolve_assets(s["visual"], vdir, pub, img_cache, used, warns, {**actx, "where": f"scene {s['n']}"})
        resolve_images(s["visual"], vdir, pub, img_cache, used, warns, actx)
    img_p.write_text(json.dumps(img_cache, indent=1, ensure_ascii=False), "utf-8")

    # The sound beyond the narration (a music bed, effects on cues) is mixed outside the picture. Without a mix the
    # narration is the sound. A filmstrip or a still has no sound, so it skips the mix.
    mixed = None
    if not (args.strip or args.still):
        mixed = sound.mix(spec, scenes, buf, SR, total, vdir, pub, used, warns, actx)
        if mixed and not (pub / mixed).is_file():
            warns.append(f"sound: the mix '{mixed}' is not in the public folder; the video has its narration alone")
            mixed = None
        if not mixed and (spec.get("music") or any(s["visual"].get("sfx") for s in scenes)):
            warns.append("sound: the spec asks for music or effects, but no mix was made; the video has its narration alone")
            actx["placeholders"].append("sound: music and effects are not mixed")
    ledger = [u["ledger"] for u in used if u.get("ledger")]
    ledger += [{"request": f"icon|{k}", "provider": "iconify", "id": k, **assets.iconify_license(p)} for k, p in sorted(icons_used.items())]
    (vdir / "ledger.json").write_text(json.dumps(ledger, indent=1, ensure_ascii=False), "utf-8")
    sets = sorted({f"{e['set']} ({e['license']})" for e in ledger if e.get("set")})
    credits = sorted({u["credit"] for u in used if u.get("credit")}) + ([f"Icons: {', '.join(sets)}, via Iconify"] if sets else [])

    # 3. Props, subtitles, transcript. The props hold the picture only: no sound file is named in them.
    props = {"title": spec.get("title", slug), "fps": fps, "duration": total,
             "scenes": scenes, "captions": captions, "showCaptions": spec.get("captions", True), "credits": credits,
             "theme": theme, "chapters": chapters, "glyphs": glyphs, "design": design or None, "fonts": fonts,
             "worlds": worlds}  # worlds declared once (component, tracks, places, assets, props)
    if "2d-only" in directed["limits"] or (directed["direction"] or {}).get("form") == "2d":
        props["only2d"] = True  # the backstop of the 2D check: a 3D canvas reached some way the check cannot read is an error (kit/canvas.tsx)
    (build / "props.json").write_text(json.dumps(props, ensure_ascii=False), "utf-8")
    if prune_public(pub, props, img_cache):  # the old copies of edited local files; the mirror then drops them from the bundle
        img_p.write_text(json.dumps(img_cache, indent=1, ensure_ascii=False), "utf-8")
    srt, vtt = [], ["WEBVTT", ""]
    for i, c in enumerate(captions):
        end = min(c["e"] + 0.4, captions[i + 1]["s"]) if i + 1 < len(captions) else c["e"] + 0.4
        line = " ".join(w["w"] for w in c["words"])
        srt += [str(i + 1), f"{ts(c['s'], ',')} --> {ts(end, ',')}", line, ""]
        vtt += [f"{ts(c['s'], '.')} --> {ts(end, '.')}", line, ""]
    text_dir = out / "text"  # kept apart from the MP4: players auto-load a same-name .srt over the burned-in captions
    text_dir.mkdir(exist_ok=True)
    (text_dir / f"{slug}.srt").write_text("\n".join(srt), "utf-8")
    (text_dir / f"{slug}.vtt").write_text("\n".join(vtt), "utf-8")
    md = [f"# {props['title']}", ""]
    for sc in spec["scenes"]:
        md += ([f"## {sc['heading']}", ""] if sc.get("heading") else []) + [narration.shown_text(sc.get("say") or ""), ""]
    if credits:
        md += ["---", "Images: " + "; ".join(credits)]
    (text_dir / "transcript.md").write_text("\n".join(md), "utf-8")

    nwords = sum(len(narration.spoken(narration.parse(sc.get("say") or "")).split()) for sc in spec["scenes"])  # as heard: sets the length
    tm = spec.get("target_minutes")
    if tm and abs(total / 60 - tm) / tm > 0.25:
        warns.append(f"length {total / 60:.1f} min vs target {tm} min: aim for ~{int(tm * WPM)} words (now {nwords})")
    # "scenes" counts the spec's scenes, the numbers --strip and --still take; chapter cards are counted apart
    n_cards = sum(1 for s in scenes if s.get("kind") == "card")
    report = {"duration": f"{int(total // 60)}:{int(total % 60):02d}", "scenes": len(spec["scenes"]),
              **({"cards": n_cards} if n_cards else {}), "words": nwords, "warnings": warns}
    if directed["direction"] is not None:  # what the build held the video to, and what only an eye can check
        report["direction"] = {"form": directed["form"], "limits_held": directed["limits"]}
        if directed["asked"]:
            report["check_by_eye"] = directed["asked"]
    if look_note:
        report["look"] = look_note
    if zvoices:  # backend, times, every retaken piece and every piece that still fails (zonos.Voice.stats)
        st = [zv.stats() for zv in zvoices.values()]
        report["voice"] = st[0] if len(st) == 1 else st
    if cue_table:
        report["cues"] = cue_table
    if actx["placeholders"]:
        report["placeholders"] = actx["placeholders"]
    if actx.get("sound"):
        report["sound"] = actx["sound"]  # the levels of the mix (sound.py)

    errors = prep["errors"] + cue_errors
    if errors:  # a wrong name in the spec, scene code that is not a pure function of time or does not compile, a cue nobody speaks
        report["errors"] = errors[:40]
        emit(report)
        sys.exit(1)
    entry = prep["entry"]  # the video's own entry when it has scene code, the engine's otherwise
    chan = render.Channel()  # what the browser says through the error channel while Remotion runs

    def finish(code: int = 0) -> None:
        """Print the report with what the error channel collected: a scene that fell back is an error."""
        warns.extend(f"kit: {w}" for w in chan.warnings)
        if chan.errors or code:
            report["errors"] = (report.get("errors") or []) + chan.errors[:40]
        if report.get("direction") and any(ONLY2D_REFUSED in e for e in chan.errors):  # the canvas refused a <Stage>
            d = report["direction"]  # that the 2D check could not read: the report does not claim the limit held
            d["limits_held"] = [x for x in d["limits_held"] if x != "2d-only"]
            d["form"] = f"{str(d['form']).split(':')[0]}: a scene drew a 3D stage (see errors)"
        emit(report)
        if code:
            sys.exit(code)

    try:
        # 4. One bundle per state of the code (render.py); the public folder is mirrored into it on every run.
        if args.strip or args.still or not args.no_render:
            bdir, code, report["bundle"] = render.bundle(vdir, build, entry, pub, chan)
            render.mirror(pub, bdir, ("narration.wav", *([mixed] if mixed else [])))
        last = max(1, math.ceil(total * fps)) - 1  # the video's last frame

        if args.strip:
            # 4a. Filmstrips: the real composition frozen at chosen times of a scene, tiled in one still.
            cell_w = 600
            cell_h = cell_w * 9 // 16
            report["strips"] = []
            for num in scene_list(args.strip, len(spec["scenes"])):
                k = next(i for i, s in enumerate(scenes) if s.get("n") == num)
                sc, prev, nxt = scenes[k], scenes[k - 1] if k else None, scenes[k + 1] if k + 1 < len(scenes) else None
                # a world scene that carries on the world of the scene before inherits its running changes, and its
                # entries without a cue are changes from t = 0 (the kit's rule, cues.follows)
                run = cues.follows(prev, sc["visual"])
                pprev = scenes[k - 2] if k > 1 else None
                picks = cues.strip_times(sc["dur"], sc["visual"], sc["visual"].get("type") in FREE,
                                         next_cut=float(((nxt or {}).get("cut") or {}).get("s") or 0),
                                         inherited=cues.carried(prev["visual"], prev["dur"], cues.follows(pprev, prev["visual"]))
                                         if run else (), follows_=run)
                cols = 2 if len(picks) <= 8 else 3 if len(picks) <= 12 else 4
                rows = math.ceil(len(picks) / cols)
                strip = {"frames": [min(int(round((sc["start"] + t) * fps)), int(total * fps) - 1) for t, _ in picks],
                         "labels": [lab for _, lab in picks], "cols": cols, "cellW": cell_w,
                         "width": 10 + cols * (cell_w + 10), "height": 10 + rows * (cell_h + 34 + 10)}
                sp = build / f"strip-{num:02d}.json"
                sp.write_text(json.dumps({**props, "strip": strip}, ensure_ascii=False), "utf-8")
                png = look_out / f"strip-{num:02d}.png"
                render.still(bdir, "Strip", png, sp, 0, chan)
                report["strips"].append(str(png))
            report["strip"] = report["strips"][0]
            if not args.still:  # with --still as well, the stills follow from the same bundle
                finish()
                return

        if args.still:
            # 4b. Stills: one frame of the video at full size, for style frames and for judging type.
            report["stills"] = []
            for num, at in still_list(args.still, len(spec["scenes"])):
                sc = next(s for s in scenes if s.get("n") == num)
                png = look_out / f"still-{num:02d}-{at:g}.png"
                render.still(bdir, "Explainer", png, build / "props.json", min(max(int(round((sc["start"] + at) * fps)), 0), last), chan)
                report["stills"].append(str(png))
            finish()
            return

        # 4c. The video: a muted render (kept and reused while nothing visible changes), the sound muxed in, a contact sheet.
        if not args.no_render:
            mode = "preview" if args.preview else "master" if args.master else "hd"
            # BT.709 (architecture section 3): untagged files were decoded by players with the wrong matrix
            flags = ["--color-space=bt709"]
            three_d = prep["gl"] or any(s["visual"].get("type") == "stage3d" for s in scenes)
            if prep["components"] or three_d:  # always for scene code (section 3): a canvas may come from any kit part
                flags.append("--gl=angle")  # WebGL on the GPU through ANGLE: real 3D scenes render far faster
            if mode == "preview":
                flags.append("--scale=0.5")
            elif mode == "master":
                flags += [f"--scale={MASTER['scale']}"] + MASTER_ENCODE
                if args.concurrency is None:  # ANGLE draws on the integrated GPU in system RAM, so 4K canvases (two per tab during a glide) bound the 3D count
                    flags.append(f"--concurrency={MASTER_TABS['3d' if three_d else '2d']}")
            if args.concurrency is not None:  # in the flags, so in the render key: a run at another count renders again
                flags.append(f"--concurrency={args.concurrency}")
            raw, info = render.render(bdir, build / "props.json", props, code, pub, build, mode, flags, chan)
            report["render_s"] = info["render_s"]
            if info["reused"]:
                report["render"] = "reused: nothing visible changed since the last render"
            final = look_out / f"{slug}.mp4"
            render.encode(raw, pub / (mixed or "narration.wav"), final, mode, bool(mixed), (last + 1) / fps)
            body = [s for s in scenes if s.get("kind") != "card"]
            cap = 48  # one frame per scene; only a video with more scenes than this is sampled
            picks = body if len(body) <= cap else [body[round(i * (len(body) - 1) / (cap - 1))] for i in range(cap)]
            frames = sorted({int((s["start"] + 0.8 * s["dur"]) * fps) for s in picks})
            cols = 3 if len(frames) <= 6 else 4 if len(frames) <= 24 else 6
            sel = "+".join(f"eq(n,{f})" for f in frames)
            sheet = look_out / "sheet.png"
            render.ffmpeg(["-i", raw, "-vf",
                           f"select='{sel}',scale=480:-2,tile={cols}x{math.ceil(len(frames) / cols)}:padding=6:color=0x0b1020",
                           "-frames:v", "1", "-fps_mode", "passthrough", sheet])
            report.update({"video": str(final), "size_mb": round(final.stat().st_size / 1e6, 2), "sheet": str(sheet)})
    except render.Failed as exc:
        report["errors"] = [str(exc)]
        finish(1)
    report["subtitles"] = str(text_dir / f"{slug}.srt")
    if not (args.no_render or args.preview or args.design or chan.errors or slug.startswith("_")):
        # a finished video gets its row in docs/made.md, so that the next session sees this look and structure and varies
        try:
            voices = dict.fromkeys(voice_of(sc) for sc in spec["scenes"] if sc.get("say"))  # in the order first heard
            direction.ledger_upsert(direction.ledger_row(spec, vdir, theme, base, design, total / 60, voice=", ".join(voices)))
            report["made"] = "its row is in docs/made.md"
        except OSError as exc:
            warns.append(f"docs/made.md: the row was not written ({exc})")
    finish(1 if chan.errors else 0)  # a video in which a scene fell back to the plain card is not a finished video


if __name__ == "__main__":
    main()
