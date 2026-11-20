"""
@file assets.py
@description Asset system for make.py. Icons resolve by name through Iconify (one consistent icon set per theme);
  an emoji or unknown name falls back to a neutral icon and a warning that names the closest valid icons.
  Every network response that a provider allows to be cached lives in assets/cache (gitignored, shared by all
  videos). Keys come from .env and are never printed.
@see docs/asset-sources.md (providers, limits, agreed terms), make.py (calls resolve_icons)
"""
from __future__ import annotations

import hashlib
import json
import re
import ssl
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / "assets" / "cache"


def engine_version() -> str:
    """The engine's one version, kept in package.json ("version"); make.py --version prints it."""
    try:
        return str(json.loads((ROOT / "package.json").read_text("utf-8"))["version"])
    except (OSError, ValueError, KeyError):
        return "unknown"


VERSION = engine_version()
UA = f"scene-lab/{VERSION} (+https://github.com/Black-Lights/scene-lab)"  # providers ask for a name and a contact
NEUTRAL = "circle"  # fallback icon name, looked up in the theme's set like any other
ICON_SUFFIX: dict = {}  # per icon set, the style suffix the theme uses (Remix: "-fill"); set by make.py
ICON_ALIAS: dict = {}  # concept name -> this theme's name for it ("browser" -> "window" in Bootstrap); set by make.py


def ssl_ctx() -> ssl.SSLContext:
    """certifi's current CA bundle: a Windows certificate store that is out of date fails on some hosts ("certificate
    has expired")."""
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


def http(url: str, headers: dict | None = None, data: bytes | None = None, timeout: int = 40):
    """GET (or POST with data) -> (bytes, content type). Raises on HTTP errors."""
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout, context=ssl_ctx()) as r:
        return r.read(), r.headers.get_content_type()


def cached_json(url: str, sub: str, max_age: float | None = None, headers: dict | None = None):
    """JSON from url, cached in assets/cache/<sub>/. max_age in seconds (None = keep forever)."""
    d = CACHE / sub
    d.mkdir(parents=True, exist_ok=True)
    p = d / (hashlib.sha1(url.encode("utf-8")).hexdigest()[:20] + ".json")
    if p.exists() and (max_age is None or time.time() - p.stat().st_mtime < max_age):
        return json.loads(p.read_text("utf-8"))
    raw, _ = http(url, headers)
    data = json.loads(raw)
    p.write_text(json.dumps(data), "utf-8")
    return data


# ---------------------------------------------------------------- icons (Iconify)
ICONIFY = "https://api.iconify.design"


def iconify_search(query: str, prefixes: list[str] | None, limit: int = 32) -> list[str]:
    q = {"query": query, "limit": max(32, limit)}
    if prefixes:
        q["prefixes"] = ",".join(prefixes)
    try:
        return cached_json(f"{ICONIFY}/search?{urllib.parse.urlencode(q)}", "iconify").get("icons", [])[:limit]
    except (urllib.error.URLError, TimeoutError, ValueError):
        return []


def iconify_data(prefix: str, name: str) -> dict | None:
    """{body, width, height} for prefix:name, following aliases; None if the set has no such icon."""
    try:
        d = cached_json(f"{ICONIFY}/{prefix}.json?icons={urllib.parse.quote(name)}", "iconify")
    except (urllib.error.URLError, TimeoutError, ValueError):
        return None
    if not isinstance(d, dict):
        return None
    icons, aliases = d.get("icons") or {}, d.get("aliases") or {}
    seen, n, extra = 0, name, {}
    while n not in icons and n in aliases and seen < 5:
        extra = {**aliases[n], **extra}
        n, seen = aliases[n].get("parent"), seen + 1
    ic = icons.get(n)
    if not ic:
        return None
    ic = {**ic, **{k: v for k, v in extra.items() if k != "parent"}}
    return {"body": ic["body"], "width": ic.get("width", d.get("width", 16)), "height": ic.get("height", d.get("height", 16))}


def iconify_license(prefix: str) -> dict:
    try:
        info = cached_json(f"{ICONIFY}/collections?prefixes={prefix}", "iconify").get(prefix) or {}
    except (urllib.error.URLError, TimeoutError, ValueError, AttributeError):
        info = {}
    lic, auth = info.get("license") or {}, info.get("author") or {}
    return {"set": info.get("name", prefix), "author": auth.get("name", ""), "license": lic.get("spdx") or lic.get("title", ""),
            "license_url": lic.get("url", ""), "url": auth.get("url", "")}


def icon_set(prefix: str) -> tuple:
    """(title, every icon name) of one Iconify set, cached; ("", []) when Iconify cannot be reached."""
    try:
        d = cached_json(f"{ICONIFY}/collection?prefix={urllib.parse.quote(prefix)}", "iconify")
    except (urllib.error.URLError, TimeoutError, ValueError):
        return "", []
    if not isinstance(d, dict):
        return "", []
    names = set(d.get("uncategorized") or []) | set(d.get("hidden") or []) | set(d.get("aliases") or {})
    for v in (d.get("categories") or {}).values():
        names.update(v)
    return str(d.get("title") or prefix), sorted(names)


def _closest(name: str, prefixes: list[str], n: int = 4) -> list:
    """Names of the set that look like `name` when Iconify's search finds nothing: names that contain one of its
    words first, then names spelled alike."""
    import difflib
    out: list = []
    for p in prefixes:
        names = icon_set(p)[1]
        words = [w for w in name.split("-") if len(w) > 2]
        out += [x for x in names if any(w in x for w in words) and x not in out][:n]
        out += [x for x in difflib.get_close_matches(name, names, n, 0.6) if x not in out]
    return out[:n]


def _set_names(prefixes: list[str]) -> str:
    """'bi (Bootstrap Icons)': the theme's icon set by prefix and title, for warnings."""
    return "/".join(f"{p} ({icon_set(p)[0]})" if icon_set(p)[0] and icon_set(p)[0] != p else p for p in prefixes)


def _words(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def emoji_words(s: str) -> str:
    """'🔒' -> 'lock', '👋' -> 'waving hand': the Unicode name is the best search phrase for an emoji."""
    names = [unicodedata.name(ch, "") for ch in s if ord(ch) > 0x2000 and unicodedata.category(ch).startswith("S")]
    return _words(" ".join(n.replace(" SIGN", "") for n in names if n))


def resolve_icon(ref: str, prefixes: list[str], warns: list, where: str, used: dict) -> dict | None:
    """An icon name ('lock', 'shield-check', or 'ph:lock') -> {body, width, height, id} in the theme's set.
    Emoji and unknown names fall back to the neutral icon with a warning that suggests the closest names."""
    ref = (ref or "").strip()
    if not ref:
        return None
    ref = ICON_ALIAS.get(ref.lower(), ref)
    if ":" in ref and re.fullmatch(r"[a-z0-9-]+:[a-z0-9-]+", ref):
        p, n = ref.split(":", 1)
        d = iconify_data(p, n)
        if d:
            used[ref] = p
            return {**d, "id": ref}
        warns.append(f"{where}: icon '{ref}' does not exist")
    is_emoji = not re.search(r"[a-z]", ref.lower())
    query = emoji_words(ref) if is_emoji else _words(ref)
    if not is_emoji:
        name = re.sub(r"\s+", "-", query)
        for p in prefixes:
            sfx = ICON_SUFFIX.get(p, "")
            for cand in ([name + sfx] if sfx and not name.endswith(sfx) else []) + [name]:
                d = iconify_data(p, cand)
                if d:
                    used[f"{p}:{cand}"] = p
                    return {**d, "id": f"{p}:{cand}"}
    found = iconify_search(query, prefixes, 32) if query else []
    if not found and query:
        found = [i for w in query.split() for i in iconify_search(w, prefixes, 32)[:2]]
    sfx = {p: ICON_SUFFIX.get(p, "") for p in prefixes}
    styled = [i for i in found if not sfx.get(i.split(":")[0]) or i.endswith(sfx[i.split(":")[0]])] or found
    close = [i.split(":", 1)[1] for i in styled][:4]
    if not is_emoji and styled:
        best = styled[0]
        p, n = best.split(":", 1)
        d = iconify_data(p, n)
        if d:
            warns.append(f"{where}: icon '{ref}' is not in the {_set_names(prefixes)} set; used '{n}' (closest: {', '.join(close)})")
            used[best] = p
            return {**d, "id": best}
    if not close and not is_emoji and query:
        close = _closest(re.sub(r"\s+", "-", query), prefixes)
    what = (f"emoji '{ref}' is not an icon" if is_emoji else
            f"icon '{ref}' is not in the {_set_names(prefixes)} set, this video's icon set (design.icons picks another)")
    hint = f"; closest names: {', '.join(close)}" if close else "; no name in the set is close"
    warns.append(f"{where}: {what}, using a neutral icon{hint}")
    for p in prefixes:
        for cand in (NEUTRAL + sfx.get(p, ""), NEUTRAL):
            d = iconify_data(p, cand)
            if d:
                used[f"{p}:{cand}"] = p
                return {**d, "id": f"{p}:{cand}", "fallback": True}
    return None


def resolve_icons(node, prefixes: list[str], warns: list, where: str, used: dict) -> None:
    """Every "icon" string in a visual becomes inline SVG data for the templates."""
    if isinstance(node, dict):
        for k in list(node):
            if k == "icon" and isinstance(node[k], str):
                node[k] = resolve_icon(node[k], prefixes, warns, where, used)
            else:
                resolve_icons(node[k], prefixes, warns, where, used)
    elif isinstance(node, list):
        for x in node:
            resolve_icons(x, prefixes, warns, where, used)


# ---------------------------------------------------------------- keys (.env) and licences
_ENV: dict | None = None


def key(name: str) -> str:
    """A key from .env (never printed, never logged)."""
    global _ENV
    if _ENV is None:
        _ENV = {}
        p = ROOT / ".env"
        if p.exists():
            for ln in p.read_text("utf-8").splitlines():
                ln = ln.strip()
                if ln and not ln.startswith("#") and "=" in ln:
                    k, v = ln.split("=", 1)
                    _ENV[k.strip()] = v.strip().strip('"').strip("'")
    return _ENV.get(name, "")


def scrub(msg: str) -> str:
    """Error text with any key value removed, so a failure report can never leak one."""
    key("")
    for v in (_ENV or {}).values():
        if v and len(v) > 6:
            msg = msg.replace(v, "***")
    return msg


def licence_flags(lic: str, url: str = "") -> list:
    s = f"{lic} {url}".lower()
    f = []
    if re.search(r"by-nc|\bnc\b|non-?commercial", s):
        f.append("NC")
    if re.search(r"-nd\b|\bnd\b|no-?deriv", s):
        f.append("ND")
    if re.search(r"by-sa|-sa\b|\bsa\b|share-?alike", s):
        f.append("SA")
    if re.search(r"all rights reserved|sampling\+", s):
        f.append("REJECT")
    return f


def licence_from_url(url: str) -> str:
    u = (url or "").lower()
    if "publicdomain/zero" in u:
        return "CC0"
    if "publicdomain/mark" in u:
        return "Public domain"
    m = re.search(r"licenses/([a-z-]+)/(\d\.\d)", u)
    if m:
        return f"CC {m.group(1).upper()} {m.group(2)}"
    return url or ""


NAMES = {"iconify": "Iconify", "nounproject": "The Noun Project", "wikimedia": "Wikimedia Commons", "openverse": "Openverse",
         "nasa": "NASA Image Library", "nasa_apod": "NASA APOD", "smithsonian": "Smithsonian Open Access", "europeana": "Europeana",
         "met": "The Met", "artic": "Art Institute of Chicago", "cleveland": "Cleveland Museum of Art", "wellcome": "Wellcome Collection",
         "pixabay": "Pixabay", "unsplash": "Unsplash", "lottieweb": "lottie-web", "freesound": "Freesound", "jamendo": "Jamendo",
         "fontsource": "Fontsource", "polyhaven": "Poly Haven", "sketchfab": "Sketchfab"}


# ---------------------------------------------------------------- search, merge, fetch, ledger
def providers_for(kind: str, topic=None, only: str | None = None) -> list:
    """Providers to ask, in order: the kind's default order, the video's topic moving its providers first.
    A provider whose key is missing from .env is skipped quietly."""
    import providers as P
    names = [only] if only else list(P.ORDER.get(kind, []))
    if not only:
        for t in reversed([topic] if isinstance(topic, str) else list(topic or [])):
            first = [p for p in P.TOPIC_FIRST.get(str(t).lower(), []) if p in names]
            names = first + [p for p in names if p not in first]
    out = []
    for nm in names:
        if nm not in P.PROVIDERS:
            continue
        _fn, kinds, env, _rule = P.PROVIDERS[nm]
        if kind in kinds and (not env or key(env)):
            out.append(nm)
    return out


def unavailable(nm: str, kind: str) -> str:
    """Why a provider cannot be asked for this kind, in words a user can act on ("" when it can be asked)."""
    import providers as P
    if nm not in P.PROVIDERS:
        return f"skipped: there is no provider '{nm}' (the providers are listed in docs/asset-sources.md)"
    _fn, kinds, env, _rule = P.PROVIDERS[nm]
    if kind not in kinds:
        return f"skipped: it has no {kind} (it serves {', '.join(sorted(kinds))})"
    if env and not key(env):
        return f"skipped: it needs a key, {env} in .env (.env.example says where to get one)"
    return ""


def search(kind: str, q: str, topic=None, provider: str | None = None, n: int = 12, ctx: dict | None = None):
    """Merged hits, round-robin by rank across the providers in order, plus a status line per provider. A provider
    named in the request that cannot be asked (no key in .env, or not that kind) gets a status line saying why."""
    import providers as P
    names = providers_for(kind, topic, provider)
    per = n if provider else max(3, -(-n // max(1, len(names))))
    lists, status = [], {}
    if provider and not names:
        status[provider] = unavailable(provider, kind)
    for nm in names:
        try:
            hs = [h for h in P.PROVIDERS[nm][0](kind, q, per, ctx or {}) if "REJECT" not in h["flags"]]
            status[nm] = f"ok, {len(hs)} results"
            lists.append(hs)
        except Exception as exc:  # noqa: BLE001  one provider failing must not stop the others
            status[nm] = scrub(f"failed: {type(exc).__name__}: {exc}")[:160]
    merged = [lst[r] for r in range(max((len(x) for x in lists), default=0)) for lst in lists if r < len(lst)]
    return merged[:n], status


def fetch(h: dict, pub: Path) -> str:
    """Download a hit into build/public/assets (through the shared cache when the provider allows it) -> path for staticFile."""
    import shutil
    import providers as P
    rule = P.PROVIDERS[h["provider"]][3]
    name = f"{h['provider']}-{hashlib.sha1(h['id'].encode('utf-8')).hexdigest()[:12]}{h.get('ext') or '.bin'}"
    rel = f"assets/{name}"
    dst = pub / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    cached = CACHE / "files" / h["provider"] / name
    ex = h.get("extra") or {}
    if h["provider"] == "iconify" and ex.get("svg"):
        d = ex["svg"]
        dst.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {d["width"]} {d["height"]}">{d["body"]}</svg>', "utf-8")
    elif rule == "cache" and cached.exists():
        shutil.copyfile(cached, dst)
    elif rule == "build" and dst.exists() and h["provider"] != "nounproject":
        pass  # a temporary copy already in this video's build folder (Freesound, Jamendo, Sketchfab)
    else:
        if h["provider"] == "nounproject" and ex.get("svg_text"):
            data = ex["svg_text"].encode("utf-8")  # fetched per render, never cached (agreed terms)
        else:
            url = P.resolve_url(h)
            if not url:
                raise ValueError(f"{h['provider']} gave no file for {h['id']}")
            data, _ = http(url, timeout=120)
        dst.write_bytes(data)
        if rule == "cache":
            cached.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(dst, cached)
    if h["provider"] == "unsplash" and ex.get("download_location"):
        http(ex["download_location"], {"Authorization": f"Client-ID {key('UNSPLASH_ACCESS_KEY')}"})  # each time a photo is used
    return rel


def ledger_entry(h: dict, rel: str, request: str) -> dict:
    return {"request": request, "provider": h["provider"], "id": h["id"], "title": h["title"], "author": h["author"],
            "license": h["license"], "license_url": h["license_url"], "page": h["page"], "flags": h["flags"], "file": rel}


def credit(e: dict) -> str:
    """One credit line: title, author, licence, source. Commas only (no middle dots)."""
    return ", ".join(x for x in (e.get("title") or "Untitled", e.get("author"), e.get("license"), NAMES.get(e["provider"], e["provider"])) if x)


def gltf_files(src: Path) -> tuple:
    """The files a .gltf loads by name: itself, its buffers and its images (an embedded data: URI needs no file).
    -> (files, None), or (None, why) when the .gltf cannot be read or names a file outside its own folder or one
    that is missing. Copying its whole folder instead swept in build/ and out/ when the .gltf sat in the video
    folder, and the copy grew on every run."""
    import json as _json
    import urllib.parse
    try:
        doc = _json.loads(src.read_text("utf-8"))
    except (OSError, ValueError) as exc:
        return None, f"the model {src.name} is not readable glTF JSON ({exc})"
    base, out = src.parent.resolve(), [src]
    for item in [*(doc.get("buffers") or []), *(doc.get("images") or [])]:
        uri = item.get("uri") if isinstance(item, dict) else None
        if not isinstance(uri, str) or not uri or uri.startswith("data:"):
            continue
        p = (base / urllib.parse.unquote(uri)).resolve()
        if base not in p.parents:
            return None, f"the model {src.name} names '{uri}', outside its own folder"
        if not p.is_file():
            return None, f"the model {src.name} names '{uri}', which does not exist"
        if p not in out:
            out.append(p)
    return out, None


def resolve_assets(node: dict, vdir: Path, pub: Path, cache: dict, used: list, warns: list, ctx: dict | None = None) -> None:
    """Every entry of node["assets"] ({name: a request or a file path}; `node` is a visual or a world) is replaced in
    place by {"src", "kind", "credit"}, with "src" a path inside `pub` for staticFile. First version: local files
    (copied under a name made from their content, so a changed file is a new name), and the image kinds through the
    search that "image" fields already use (ctx["fetch_image"], make.py's function). Any other request becomes a
    warning, a line in ctx["placeholders"] and {"src": None, "placeholder": True}, so the scene draws a stand-in of
    the right size. ctx["where"] names the scene or world in messages."""
    import shutil
    ctx = ctx or {}
    where, table = ctx.get("where", "assets"), node.get("assets")
    by_ext = {".svg": "vector", ".png": "photo", ".jpg": "photo", ".jpeg": "photo", ".webp": "photo", ".gif": "photo", ".avif": "photo",
              ".mp4": "video", ".webm": "video", ".mov": "video", ".gltf": "model", ".glb": "model", ".hdr": "hdri", ".exr": "hdri",
              ".wav": "sound", ".mp3": "sound", ".ogg": "sound", ".flac": "sound", ".m4a": "sound"}
    if not isinstance(table, dict):
        return
    for name, ref in list(table.items()):
        if isinstance(ref, dict) and "src" in ref:
            continue  # resolved already
        req = ref if isinstance(ref, dict) else {"file": str(ref)}
        file, q = req.get("file"), str(req.get("q") or req.get("query") or "")
        kind = req.get("kind") or (by_ext.get(Path(str(file)).suffix.lower()) if file else None) or "photo"
        got, why = None, "this kind of request is not fetched yet"
        if file:
            src = (Path(file) if Path(file).is_absolute() else vdir / file).resolve()
            if src.is_file() and src.suffix.lower() == ".gltf":
                parts, why = gltf_files(src)  # a .gltf loads the files it names: those travel with it, nothing else
                if parts is None:
                    src = None
            else:
                parts = [src]
            if src is not None and src.is_file():
                folder = src.suffix.lower() == ".gltf"
                h = hashlib.sha1()
                for p in parts:
                    h.update(p.relative_to(src.parent).as_posix().encode("utf-8") + b"\0" + p.read_bytes())
                tag = h.hexdigest()[:12]
                rel = f"assets/local-{tag}/{src.name}" if folder else f"assets/local-{tag}{src.suffix.lower()}"
                for p in parts:
                    dst = pub / (f"assets/local-{tag}/{p.relative_to(src.parent).as_posix()}" if folder else rel)
                    if not dst.exists():
                        dst.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copyfile(p, dst)
                got = {"src": rel, "kind": kind, "credit": str(req.get("credit") or "")}
                used.append({"src": rel, "credit": got["credit"], "ref": str(file)})
            elif src is not None:
                why = f"the file {file} does not exist"
        elif q and kind in ("photo", "illustration", "vector") and callable(ctx.get("fetch_image")):
            hit = ctx["fetch_image"]({k: v for k, v in req.items() if k in ("q", "query", "kind", "pick", "provider")},
                                     vdir, pub, cache, used, warns, ctx)
            if hit:
                got = {"src": hit["src"], "kind": kind, "credit": hit.get("credit", "")}
            else:
                why = "the search gave no usable result"
        if got is None:
            what = f"{where}: asset '{name}' ({kind}{': ' + q if q else ''})"
            warns.append(f"{what}: {why}; the scene draws a placeholder")
            if isinstance(ctx.get("placeholders"), list):
                ctx["placeholders"].append(f"{what}: {why}")
            got = {"src": None, "kind": kind, "credit": "", "placeholder": True}
        table[name] = got
