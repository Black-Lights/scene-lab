"""
@file providers.py
@description One search function per asset provider. Each returns a list of hits (plain dicts) in one shape:
  {provider, kind, id, title, thumb, url, page, author, license, license_url, flags, ext, extra}
  `url` is what gets downloaded (None when it must be resolved at fetch time, see resolve_url).
  Terms that shape the code (docs/asset-sources.md): Pixabay responses are cached 24 h; Noun Project SVGs are
  never cached; Unsplash's download endpoint is called each time a photo is used; Freesound, Jamendo and Sketchfab
  files stay in the video's build folder (temporary copies). Keys come from .env through assets.key(); never printed.
@see assets.py (search order, merging, cache, ledger), docs/asset-sources.md
"""
from __future__ import annotations

import base64
import datetime as dt
import hashlib
import hmac
import json
import re
import secrets
import time
import urllib.parse

import assets
from assets import cached_json, http, key

Q = urllib.parse.quote
ENC = urllib.parse.urlencode
DAY, WEEK = 86400, 7 * 86400


def hit(provider, kind, id_, title, thumb, url, page, author, lic, lic_url="", ext="", **extra):
    return {"provider": provider, "kind": kind, "id": str(id_), "title": (title or "").strip()[:120], "thumb": thumb, "url": url,
            "page": page, "author": re.sub(r"<[^>]+>", "", author or "").strip()[:80], "license": lic or "", "license_url": lic_url or "",
            "flags": assets.licence_flags(lic or "", lic_url or ""), "ext": ext, "extra": extra}


def _ext(url: str, default: str = ".jpg") -> str:
    m = re.search(r"\.(jpe?g|png|gif|webp|svg|mp4|webm|ogv|mp3|ogg|json|glb|gltf|zip|hdr|exr)(?:$|\?)", (url or "").lower())
    return "." + m.group(1).replace("jpeg", "jpg") if m else default


# ---------------------------------------------------------------- icons
def iconify(kind, q, n, ctx):
    pre = ctx.get("prefixes") or ["bi"]
    out = []
    for icon in assets.iconify_search(q, pre, max(32, n))[:n]:
        p, name = icon.split(":", 1)
        d = assets.iconify_data(p, name)
        lic = assets.iconify_license(p)
        if d:
            out.append(hit("iconify", "icon", icon, name, None, None, f"https://icon-sets.iconify.design/{p}/{name}/", lic["author"],
                           lic["license"], lic["license_url"], ".svg", svg=d))
    return out


def _oauth1(url: str, params: dict) -> str:
    """OAuth 1.0a one-legged (consumer key and secret only), HMAC-SHA1, as the Noun Project API asks."""
    ck, cs = key("NOUN_PROJECT_KEY"), key("NOUN_PROJECT_SECRET")
    oauth = {"oauth_consumer_key": ck, "oauth_nonce": secrets.token_hex(8), "oauth_signature_method": "HMAC-SHA1",
             "oauth_timestamp": str(int(time.time())), "oauth_version": "1.0"}
    allp = {**params, **oauth}
    norm = "&".join(f"{Q(str(k), safe='~')}={Q(str(v), safe='~')}" for k, v in sorted(allp.items()))
    base = "&".join(["GET", Q(url, safe="~"), Q(norm, safe="~")])
    sig = base64.b64encode(hmac.new(f"{Q(cs, safe='~')}&".encode(), base.encode(), hashlib.sha1).digest()).decode()
    oauth["oauth_signature"] = sig
    return "OAuth " + ", ".join(f'{k}="{Q(v, safe="~")}"' for k, v in oauth.items())


def nounproject(kind, q, n, ctx):
    base = "https://api.thenounproject.com/v2/icon"
    params = {"query": q, "limit": n, "limit_to_public_domain": 1, "include_svg": 1, "thumbnail_size": 200}
    raw, _ = http(f"{base}?{ENC(params)}", {"Authorization": _oauth1(base, params)})  # never cached (agreed terms)
    out = []
    for ic in json.loads(raw).get("icons", []):
        cr = (ic.get("creator") or {}).get("name") or (ic.get("creator") or {}).get("username", "")
        out.append(hit("nounproject", "icon", ic.get("id"), ic.get("term") or q, ic.get("thumbnail_url"), ic.get("icon_url"),
                       f"https://thenounproject.com/icon/{ic.get('id')}/", cr, ic.get("license_description") or "public-domain",
                       "", ".svg", svg_text=ic.get("svg") or "", attribution=ic.get("attribution", "")))
    return out


# ---------------------------------------------------------------- photos, illustrations, video
def wikimedia(kind, q, n, ctx):
    ft = {"photo": "bitmap", "illustration": "drawing", "video": "video"}.get(kind, "bitmap")
    api = "https://commons.wikimedia.org/w/api.php?" + ENC({
        "action": "query", "format": "json", "generator": "search", "gsrnamespace": 6, "gsrlimit": min(50, n * 2),
        "gsrsearch": f"{q} filetype:{ft}", "prop": "imageinfo", "iiprop": "url|extmetadata|mime|size",
        "iiurlwidth": 1600 if kind != "video" else 640})
    pages = sorted(((cached_json(api, "search/wikimedia", WEEK).get("query") or {}).get("pages") or {}).values(), key=lambda p: p.get("index", 99))
    out = []
    for p in pages:
        ii = (p.get("imageinfo") or [{}])[0]
        md = ii.get("extmetadata") or {}
        lic = (md.get("LicenseShortName") or {}).get("value", "")
        mime = ii.get("mime", "")
        if kind == "video":
            if not mime.startswith(("video/", "application/ogg")) or ii.get("size", 0) > 80e6:
                continue
            url = ii.get("url")
        else:
            if mime not in ("image/jpeg", "image/png", "image/svg+xml", "image/tiff", "image/webp"):
                continue
            url = ii.get("thumburl") or ii.get("url")
        title = re.sub(r"^File:|\.[a-z0-9]+$", "", p.get("title", ""), flags=re.I)
        out.append(hit("wikimedia", kind, p.get("pageid"), title, ii.get("thumburl"), url, ii.get("descriptionurl"),
                       (md.get("Artist") or {}).get("value", ""), lic, (md.get("LicenseUrl") or {}).get("value", ""), _ext(url)))
    return out[:n]


_OV_TOKEN: dict = {}


def _openverse_headers() -> dict:
    cid, sec = key("OPENVERSE_CLIENT_ID"), key("OPENVERSE_CLIENT_SECRET")
    if not (cid and sec):
        return {}
    if not _OV_TOKEN or _OV_TOKEN.get("exp", 0) < time.time():
        raw, _ = http("https://api.openverse.org/v1/auth_tokens/token/", {"Content-Type": "application/x-www-form-urlencoded"},
                      ENC({"grant_type": "client_credentials", "client_id": cid, "client_secret": sec}).encode())
        d = json.loads(raw)
        _OV_TOKEN.update(tok=d["access_token"], exp=time.time() + int(d.get("expires_in", 3600)) - 60)
    return {"Authorization": f"Bearer {_OV_TOKEN['tok']}"}


def openverse(kind, q, n, ctx):
    audio = kind in ("sound", "music")
    params = {"q": q, "page_size": n}
    if kind == "illustration":
        params["category"] = "illustration,digitized_artwork"
    if kind == "photo":
        params["category"] = "photograph"
    if kind == "music":
        params["category"] = "music"
    try:
        data = cached_json(f"https://api.openverse.org/v1/{'audio' if audio else 'images'}/?{ENC(params)}", "search/openverse", WEEK, _openverse_headers())
    except Exception:  # noqa: BLE001  its gateway times out on large pages (seen 2026-11-14): one retry, smaller page
        params["page_size"] = max(3, n // 2)
        data = cached_json(f"https://api.openverse.org/v1/{'audio' if audio else 'images'}/?{ENC(params)}", "search/openverse", WEEK, _openverse_headers())
    out = []
    for r in data.get("results", []):
        lic = f"CC {r.get('license', '').upper()} {r.get('license_version') or ''}".strip()
        if r.get("license") in ("cc0", "pdm"):
            lic = r["license"].upper()
        out.append(hit("openverse", kind, r.get("id"), r.get("title"), r.get("thumbnail"), r.get("url"), r.get("foreign_landing_url"),
                       r.get("creator"), lic, r.get("license_url"), _ext(r.get("url", ""), ".mp3" if audio else ".jpg"),
                       source=r.get("source"), duration=(r.get("duration") or 0) / 1000))
    return out


def nasa(kind, q, n, ctx):
    mt = "video" if kind == "video" else "image"
    data = cached_json(f"https://images-api.nasa.gov/search?{ENC({'q': q, 'media_type': mt, 'page_size': n})}", "search/nasa", WEEK)
    out = []
    for it in (data.get("collection") or {}).get("items", [])[:n]:
        d = (it.get("data") or [{}])[0]
        thumb = next((l.get("href") for l in it.get("links") or [] if l.get("rel") == "preview"), None)
        nid = d.get("nasa_id")
        out.append(hit("nasa", kind, nid, d.get("title"), thumb, None, f"https://images.nasa.gov/details/{Q(nid or '')}",
                       d.get("photographer") or d.get("secondary_creator") or d.get("center") or "NASA", "Public domain (NASA)",
                       "https://www.nasa.gov/nasa-brand-center/images-and-media/", ".mp4" if mt == "video" else ".jpg",
                       manifest=it.get("href"), note=(d.get("description") or "")[:300]))
    return out


def nasa_apod(kind, q, n, ctx):
    k = key("NASA_API_KEY") or "DEMO_KEY"
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", q.strip()):
        rows = [cached_json(f"https://api.nasa.gov/planetary/apod?{ENC({'api_key': k, 'date': q.strip()})}", "search/apod", WEEK)]
    else:
        end = dt.date.today()
        rows = cached_json(f"https://api.nasa.gov/planetary/apod?{ENC({'api_key': k, 'start_date': (end - dt.timedelta(days=90)).isoformat(), 'end_date': end.isoformat()})}",
                           "search/apod", DAY)
        words = [w for w in re.findall(r"[a-z]+", q.lower()) if len(w) > 2]
        rows = [r for r in rows if any(w in (r.get("title", "") + " " + r.get("explanation", "")).lower() for w in words)]
    out = []
    for r in rows:
        if r.get("media_type") != "image":
            continue
        owner = " ".join((r.get("copyright") or "").split())
        if owner and not ctx.get("private"):
            continue  # the photographer owns it: used only in a video marked "private": true
        h = hit("nasa_apod", "photo", r.get("date"), r.get("title"), r.get("url"), r.get("hdurl") or r.get("url"),
                f"https://apod.nasa.gov/apod/ap{r.get('date', '').replace('-', '')[2:]}.html", owner or "NASA",
                f"Copyright {owner}" if owner else "Public domain (NASA)", "" if owner else "https://www.nasa.gov/nasa-brand-center/images-and-media/",
                _ext(r.get("url", "")))
        if owner:
            h["flags"] = h["flags"] + ["COPYRIGHT"]
        out.append(h)
    return out[:n]


def smithsonian(kind, q, n, ctx):
    qq = f"{q} AND online_media_type:Images AND media_usage:CC0"  # media_usage is the filter that works (tested 2026-11-14)
    data = cached_json(f"https://api.si.edu/openaccess/api/v1.0/search?{ENC({'q': qq, 'rows': n * 3, 'api_key': key('SMITHSONIAN_API_KEY')})}",
                       "search/smithsonian", WEEK)
    out = []
    for r in (data.get("response") or {}).get("rows", []):
        dnr = (r.get("content") or {}).get("descriptiveNonRepeating") or {}
        for m in ((dnr.get("online_media") or {}).get("media") or []):
            if (m.get("usage") or {}).get("access") != "CC0" or not m.get("content"):
                continue
            out.append(hit("smithsonian", kind, m.get("idsId") or r.get("id"), r.get("title"), m.get("thumbnail"), m.get("content"),
                           dnr.get("record_link"), dnr.get("data_source") or "Smithsonian", "CC0",
                           "https://creativecommons.org/publicdomain/zero/1.0/", ".jpg"))
            break
    return out[:n]


def europeana(kind, q, n, ctx):
    params = {"wskey": key("EUROPEANA_API_KEY"), "query": q, "reusability": "open", "media": "true", "thumbnail": "true", "rows": n,
              "qf": "TYPE:IMAGE"}
    data = cached_json(f"https://api.europeana.eu/record/v2/search.json?{ENC(params)}", "search/europeana", WEEK)
    out = []
    for it in data.get("items", []):
        rights = (it.get("rights") or [""])[0]
        media = (it.get("edmIsShownBy") or [None])[0]
        if not media:
            continue
        out.append(hit("europeana", kind, it.get("id"), (it.get("title") or [""])[0], (it.get("edmPreview") or [None])[0], media,
                       it.get("guid"), (it.get("dcCreator") or it.get("dataProvider") or [""])[0], assets.licence_from_url(rights), rights,
                       _ext(media)))
    return out


def met(kind, q, n, ctx):
    base = "https://collectionapi.metmuseum.org/public/collection"
    try:
        ids = cached_json(f"{base}/v1.1/search?{ENC({'q': q, 'hasImages': 'true'})}", "search/met", WEEK).get("objectIDs") or []
    except Exception:  # noqa: BLE001  the v1 search retired on 2026-10-01; keep a fallback for older mirrors
        ids = cached_json(f"{base}/v1/search?{ENC({'q': q, 'hasImages': 'true'})}", "search/met", WEEK).get("objectIDs") or []
    out = []
    for oid in ids[: n * 3]:
        try:
            o = cached_json(f"{base}/v1/objects/{oid}", "search/met-objects", None)
        except Exception:  # noqa: BLE001  one missing object must not end the search
            continue
        if not o.get("isPublicDomain") or not o.get("primaryImage"):
            continue
        out.append(hit("met", kind, oid, o.get("title"), o.get("primaryImageSmall"), o.get("primaryImage"), o.get("objectURL"),
                       o.get("artistDisplayName") or "The Met", "CC0 (public domain)", "https://creativecommons.org/publicdomain/zero/1.0/",
                       _ext(o.get("primaryImage", ""))))
        if len(out) >= n:
            break
    return out


def artic(kind, q, n, ctx):
    url = "https://api.artic.edu/api/v1/artworks/search?" + ENC({"q": q, "query[term][is_public_domain]": "true",
                                                              "fields": "id,title,image_id,artist_display", "limit": n})
    data = cached_json(url, "search/artic", WEEK, {"AIC-User-Agent": assets.UA})
    iiif = (data.get("config") or {}).get("iiif_url", "https://www.artic.edu/iiif/2")
    out = []
    for r in data.get("data", []):
        if not r.get("image_id"):
            continue
        out.append(hit("artic", kind, r["id"], r.get("title"), f"{iiif}/{r['image_id']}/full/843,/0/default.jpg",
                       f"{iiif}/{r['image_id']}/full/843,/0/default.jpg", f"https://www.artic.edu/artworks/{r['id']}",
                       (r.get("artist_display") or "").split("\n")[0], "CC0 (public domain)",
                       "https://creativecommons.org/publicdomain/zero/1.0/", ".jpg"))
    return out


def cleveland(kind, q, n, ctx):
    data = cached_json(f"https://openaccess-api.clevelandart.org/api/artworks/?{ENC({'q': q, 'cc0': 1, 'has_image': 1, 'limit': n})}",
                       "search/cleveland", WEEK)
    out = []
    for r in data.get("data", []):
        im = r.get("images") or {}
        web = (im.get("web") or {}).get("url")
        if not web:
            continue
        cr = ((r.get("creators") or [{}])[0] or {}).get("description", "")
        out.append(hit("cleveland", kind, r.get("id"), r.get("title"), web, (im.get("print") or {}).get("url") or web, r.get("url"),
                       cr or "Cleveland Museum of Art", "CC0", "https://creativecommons.org/publicdomain/zero/1.0/", ".jpg"))
    return out


def wellcome(kind, q, n, ctx):
    url = f"https://api.wellcomecollection.org/catalogue/v2/images?{ENC({'query': q, 'pageSize': n, 'locations.license': 'cc-0,cc-by,pdm'})}"
    data = cached_json(url, "search/wellcome", WEEK)
    out = []
    for r in data.get("results", []):
        loc = (r.get("locations") or [{}])[0]
        info = loc.get("url") or (r.get("thumbnail") or {}).get("url", "")
        if not info:
            continue
        stem = info.replace("/info.json", "")
        lic = (loc.get("license") or {})
        src = r.get("source") or {}
        out.append(hit("wellcome", kind, r.get("id"), src.get("title"), f"{stem}/full/300,/0/default.jpg", f"{stem}/full/1200,/0/default.jpg",
                       f"https://wellcomecollection.org/works/{src.get('id', '')}", "Wellcome Collection", lic.get("label") or lic.get("id", ""),
                       lic.get("url", ""), ".jpg"))
    return out


def pixabay(kind, q, n, ctx):
    k = key("PIXABAY_API_KEY")
    if kind == "video":
        data = cached_json(f"https://pixabay.com/api/videos/?{ENC({'key': k, 'q': q, 'per_page': max(3, n), 'safesearch': 'true'})}",
                           "search/pixabay", DAY)  # Pixabay asks for responses to be cached 24 h
        out = []
        for h in data.get("hits", [])[:n]:
            v = h.get("videos") or {}
            med = v.get("medium") or v.get("small") or {}
            thumb = med.get("thumbnail") or (v.get("tiny") or {}).get("thumbnail")
            out.append(hit("pixabay", "video", h.get("id"), h.get("tags"), thumb, med.get("url"), h.get("pageURL"), h.get("user"),
                           "Pixabay Content License", "https://pixabay.com/service/license-summary/", ".mp4",
                           w=med.get("width"), h=med.get("height"), duration=h.get("duration")))
        return out
    it = {"photo": "photo", "illustration": "illustration", "vector": "vector"}.get(kind, "photo")
    data = cached_json(f"https://pixabay.com/api/?{ENC({'key': k, 'q': q, 'image_type': it, 'per_page': max(3, n), 'safesearch': 'true'})}",
                       "search/pixabay", DAY)
    return [hit("pixabay", kind, h.get("id"), h.get("tags"), h.get("previewURL"), h.get("largeImageURL"), h.get("pageURL"), h.get("user"),
                "Pixabay Content License", "https://pixabay.com/service/license-summary/", _ext(h.get("largeImageURL", "")))
            for h in data.get("hits", [])[:n]]


def unsplash(kind, q, n, ctx):
    hdr = {"Authorization": f"Client-ID {key('UNSPLASH_ACCESS_KEY')}", "Accept-Version": "v1"}
    data = cached_json(f"https://api.unsplash.com/search/photos?{ENC({'query': q, 'per_page': n, 'content_filter': 'high'})}",
                       "search/unsplash", 3600, hdr)
    out = []
    for r in data.get("results", []):
        if r.get("premium") or r.get("plus"):
            continue  # Unsplash+ images are not under the Unsplash License
        u = r.get("user") or {}
        out.append(hit("unsplash", kind, r.get("id"), r.get("alt_description") or r.get("description"), (r.get("urls") or {}).get("small"),
                       (r.get("urls") or {}).get("regular"), (r.get("links") or {}).get("html"), u.get("name"), "Unsplash License",
                       "https://unsplash.com/license", ".jpg", download_location=(r.get("links") or {}).get("download_location"),
                       author_url=(u.get("links") or {}).get("html")))
    return out


# ---------------------------------------------------------------- animation, sound, music, fonts, 3D
def lottieweb(kind, q, n, ctx):
    tree = cached_json("https://api.github.com/repos/airbnb/lottie-web/git/trees/master?recursive=1", "search/lottieweb", WEEK)
    words = [w for w in re.findall(r"[a-z0-9]+", q.lower())]
    paths = [t["path"] for t in tree.get("tree", []) if t["path"].endswith(".json") and t["path"].startswith(("demo/", "test/animations/"))
             and "images/" not in t["path"] and (not words or any(w in t["path"].lower() for w in words))]
    return [hit("lottieweb", "lottie", p, p.rsplit("/", 1)[-1].replace(".json", "") if "data.json" not in p else p.split("/")[1], None,
                f"https://raw.githubusercontent.com/airbnb/lottie-web/master/{p}", f"https://github.com/airbnb/lottie-web/blob/master/{p}",
                "Airbnb lottie-web", "MIT", "https://github.com/airbnb/lottie-web/blob/master/LICENSE.md", ".json") for p in paths[:n]]


def freesound(kind, q, n, ctx):
    params = {"query": q, "token": key("FREESOUND_API_KEY"), "page_size": n, "fields": "id,name,username,license,previews,duration,url",
              "filter": "duration:[0 TO 30]"}
    data = cached_json(f"https://freesound.org/apiv2/search/text/?{ENC(params)}", "search/freesound", 3600)
    out = []
    for r in data.get("results", []):
        lic = r.get("license", "")
        out.append(hit("freesound", "sound", r.get("id"), r.get("name"), None, (r.get("previews") or {}).get("preview-hq-mp3"), r.get("url"),
                       r.get("username"), assets.licence_from_url(lic), lic, ".mp3", duration=r.get("duration")))
    return out


def jamendo(kind, q, n, ctx):
    params = {"client_id": key("JAMENDO_CLIENT_ID"), "format": "json", "limit": n, "search": q, "include": "licenses",
              "audioformat": "mp32", "ccnd": "false"}  # no NoDerivatives: music synced to video is an adaptation
    raw, _ = http(f"https://api.jamendo.com/v3.0/tracks/?{ENC(params)}")  # no caching beyond the operation (API terms)
    out = []
    for r in json.loads(raw).get("results", []):
        lic = r.get("license_ccurl", "")
        out.append(hit("jamendo", "music", r.get("id"), r.get("name"), r.get("image"), r.get("audiodownload") or r.get("audio"),
                       r.get("shareurl"), r.get("artist_name"), assets.licence_from_url(lic), lic, ".mp3", duration=r.get("duration")))
    return out


def fontsource(kind, q, n, ctx):
    fonts = cached_json("https://api.fontsource.org/v1/fonts", "search/fontsource", WEEK)
    words = [w for w in re.findall(r"[a-z0-9]+", q.lower())]
    rows = [f for f in fonts if all(w in (f.get("id", "") + " " + f.get("family", "") + " " + f.get("category", "")).lower() for w in words)]
    return [hit("fontsource", "font", f["id"], f.get("family"), None, None, f"https://fontsource.org/fonts/{f['id']}", f.get("family"),
                "OFL-1.1" if f.get("license", "OFL-1.1").upper().startswith("OFL") else f.get("license", ""), "", ".woff2",
                category=f.get("category"), weights=f.get("weights"), variable=f.get("variable")) for f in rows[:n]]


def polyhaven(kind, q, n, ctx):
    t = "hdris" if kind == "hdri" else "models"
    data = cached_json(f"https://api.polyhaven.com/assets?t={t}", "search/polyhaven", WEEK)
    words = [w for w in re.findall(r"[a-z0-9]+", q.lower())]
    out = []
    for aid, a in data.items():
        hay = " ".join([aid, a.get("name", "")] + list(a.get("tags", [])) + list(a.get("categories", []))).lower()
        if words and not any(w in hay for w in words):
            continue
        out.append(hit("polyhaven", kind, aid, a.get("name"), f"https://cdn.polyhaven.com/asset_img/thumbs/{aid}.png?width=256&height=256", None,
                       f"https://polyhaven.com/a/{aid}", ", ".join((a.get("authors") or {}).keys()), "CC0",
                       "https://creativecommons.org/publicdomain/zero/1.0/", ".hdr" if t == "hdris" else ".zip"))
        if len(out) >= n:
            break
    return out


def sketchfab(kind, q, n, ctx):
    data = cached_json(f"https://api.sketchfab.com/v3/search?{ENC({'type': 'models', 'q': q, 'downloadable': 'true', 'count': n})}",
                       "search/sketchfab", WEEK, {"Authorization": f"Token {key('SKETCHFAB_API_TOKEN')}"})
    out = []
    for r in data.get("results", []):
        imgs = sorted((r.get("thumbnails") or {}).get("images", []), key=lambda i: abs(i.get("width", 0) - 400))
        lic = r.get("license") or {}
        out.append(hit("sketchfab", "model", r.get("uid"), r.get("name"), imgs[0]["url"] if imgs else None, None, r.get("viewerUrl"),
                       (r.get("user") or {}).get("displayName"), lic.get("label") or "see page", lic.get("url", ""), ".zip"))
    return out


# ---------------------------------------------------------------- resolving the download URL at fetch time
def resolve_url(h: dict) -> str | None:
    """Some providers give the file URL only when it is used: NASA (asset manifest), Noun Project (SVG),
    Sketchfab (an expiring archive link), Poly Haven (files endpoint), Fontsource (the woff2 per weight)."""
    p, ex = h["provider"], h.get("extra") or {}
    if p == "nasa" and ex.get("manifest"):
        files = json.loads(http(ex["manifest"])[0])
        pref = ["~medium.mp4", "~mobile.mp4", "~orig.mp4"] if h["kind"] == "video" else ["~large.jpg", "~medium.jpg", "~orig.jpg"]
        for suf in pref:
            for f in files:
                if f.endswith(suf):
                    return f.replace("http://", "https://")
        return None
    if p == "sketchfab":
        raw, _ = http(f"https://api.sketchfab.com/v3/models/{h['id']}/download", {"Authorization": f"Token {key('SKETCHFAB_API_TOKEN')}"})
        return (json.loads(raw).get("gltf") or {}).get("url")
    if p == "polyhaven":
        d = json.loads(http(f"https://api.polyhaven.com/files/{h['id']}")[0])
        if h["kind"] == "hdri":
            return (((d.get("hdri") or {}).get("1k") or {}).get("hdr") or {}).get("url")
        return (((d.get("gltf") or {}).get("1k") or {}).get("gltf") or {}).get("url")
    if p == "fontsource":
        d = json.loads(http(f"https://api.fontsource.org/v1/fonts/{h['id']}")[0])
        v = (d.get("variants") or {}).get("400", {}).get("normal", {})
        sub = v.get("latin") or next(iter(v.values()), {})
        return (sub.get("url") or {}).get("woff2")
    return h.get("url")


PROVIDERS = {
    # name: (search function, kinds it serves, env key it needs or None, where its files may be kept)
    "iconify": (iconify, {"icon"}, None, "cache"),
    "nounproject": (nounproject, {"icon"}, "NOUN_PROJECT_KEY", "build"),
    "wikimedia": (wikimedia, {"photo", "illustration", "video"}, None, "cache"),
    "openverse": (openverse, {"photo", "illustration", "sound", "music"}, None, "cache"),
    "nasa": (nasa, {"photo", "video"}, None, "cache"),
    "nasa_apod": (nasa_apod, {"photo"}, "NASA_API_KEY", "cache"),
    "smithsonian": (smithsonian, {"photo", "illustration"}, "SMITHSONIAN_API_KEY", "cache"),
    "europeana": (europeana, {"photo", "illustration"}, "EUROPEANA_API_KEY", "cache"),
    "met": (met, {"photo", "illustration"}, None, "cache"),
    "artic": (artic, {"photo", "illustration"}, None, "cache"),
    "cleveland": (cleveland, {"photo", "illustration"}, None, "cache"),
    "wellcome": (wellcome, {"photo", "illustration"}, None, "cache"),
    "pixabay": (pixabay, {"photo", "illustration", "vector", "video"}, "PIXABAY_API_KEY", "cache"),
    "unsplash": (unsplash, {"photo"}, "UNSPLASH_ACCESS_KEY", "cache"),
    "lottieweb": (lottieweb, {"lottie"}, None, "cache"),
    "freesound": (freesound, {"sound"}, "FREESOUND_API_KEY", "build"),
    "jamendo": (jamendo, {"music"}, "JAMENDO_CLIENT_ID", "build"),
    "fontsource": (fontsource, {"font"}, None, "cache"),
    "polyhaven": (polyhaven, {"hdri", "model"}, None, "cache"),
    "sketchfab": (sketchfab, {"model"}, "SKETCHFAB_API_TOKEN", "build"),
}

# Default order per kind: public domain and CC0 first, then CC, then the free-licence stock sites, Unsplash last.
ORDER = {
    "icon": ["iconify", "nounproject"],
    "photo": ["wikimedia", "smithsonian", "nasa", "met", "artic", "cleveland", "wellcome", "europeana", "openverse", "pixabay", "nasa_apod", "unsplash"],
    "illustration": ["pixabay", "wikimedia", "openverse", "smithsonian", "wellcome", "met", "artic", "cleveland", "europeana"],
    "vector": ["pixabay"],
    "video": ["pixabay", "nasa", "wikimedia"],
    "lottie": ["lottieweb"],
    "sound": ["freesound", "openverse"],
    "music": ["jamendo", "openverse"],
    "font": ["fontsource"],
    "hdri": ["polyhaven"],
    "model": ["polyhaven", "sketchfab"],
}

# A video's "topic" moves the providers that hold that subject to the front (F-005).
TOPIC_FIRST = {
    "space": ["nasa", "nasa_apod"], "astronomy": ["nasa_apod", "nasa"], "earth": ["nasa", "wikimedia"], "satellite": ["nasa", "wikimedia"],
    "climate": ["nasa", "wikimedia"], "art": ["met", "artic", "cleveland", "europeana"], "history": ["europeana", "smithsonian", "met", "wellcome"],
    "medicine": ["wellcome", "smithsonian"], "biology": ["wellcome", "smithsonian", "wikimedia"], "health": ["wellcome"],
    "nature": ["pixabay", "wikimedia", "unsplash"], "engineering": ["wikimedia", "smithsonian", "nasa"], "science": ["wikimedia", "wellcome", "smithsonian"],
    "computing": ["wikimedia", "openverse", "pixabay", "unsplash"], "security": ["wikimedia", "pixabay", "unsplash"],
    "ai": ["wikimedia", "pixabay", "unsplash", "openverse"], "business": ["unsplash", "pixabay"], "culture": ["europeana", "met", "artic"],
}
