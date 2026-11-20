"""
@file page.py
@description Package a rendered explainer as self-contained web pages. Every part is one HTML page with the video
  embedded as a data URI, so a host that serves single HTML files (and nothing beside them) can carry it, and the
  file also opens straight from disk. The defaults fit a host that takes 4 MB per page and 20 MB per link: videos up
  to ~3.5 min become one part; longer ones are cut into chapters at scene boundaries, one part each, re-encoded small
  (720p, mono 32k audio). Subtitles are already burned into the video. This script only builds files; publishing
  is the user's own step. A machine that has its own host can put the commands that publish the parts in
  local/page.json (never shared): {"publish": "... {parts} ... {title} ...", "attach": "..."}; page.py then prints
  them filled in.
@usage  .venv\\Scripts\\python page.py videos/<slug>
@see make.py (produces out/<slug>.mp4 and build/props.json)
"""
from __future__ import annotations

import argparse
import base64
import html
import json
import shutil
import subprocess
import sys
from pathlib import Path

from narration import shown_text  # the transcript shows what the captions show (F-013)
from render import BT709_VF  # the colour tags every ffmpeg encode carries (architecture section 3)

PART_MB = 2.85   # raw MP4 per part; base64 (x4/3) plus the page stays under a 4 MB page cap
LINK_MB = 20.0   # a host's cap per link, all parts together
CHAPTER_S = 180  # chapter length target, seconds (measured: 2:39 of the demo packs into a 2.4 MB part)
AUDIO_K = 32     # mono AAC at 24 kHz: Kokoro speech has no content above 12 kHz anyway
LOCAL = Path(__file__).resolve().parent / "local" / "page.json"  # optional: this machine's publish commands
CSS = (":root{--bg:#E3ECF4;--surface:#F7FAFC;--ink:#14202F;--ink2:#2E3D50;--line:#B8C6D4}"
       "@media (prefers-color-scheme: dark){:root{--bg:#121A23;--surface:#1B2632;--ink:#E8EEF4;--ink2:#B9C5D2;--line:#33414F}}"
       "body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.6 system-ui,'Segoe UI',sans-serif}"
       "main{max-width:980px;margin:0 auto;padding:20px 16px 64px}h1{font-size:26px;line-height:1.25;margin:6px 0 2px}"
       ".sub{color:var(--ink2);margin:0 0 14px}video{width:100%;border-radius:10px;background:#000;display:block;"
       "border:2px solid var(--ink);box-sizing:border-box}"
       "details{margin-top:18px;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:10px 16px}"
       "summary{cursor:pointer;font-weight:600}p{margin:.6em 0}.cr{color:var(--ink2);font-size:15px;margin-top:16px}")


def encode(src: Path, dst: Path, start: float, dur: float, height: int, crf: int, vk: int) -> float:
    ff = shutil.which("ffmpeg") or "ffmpeg"
    subprocess.run([ff, "-y", "-v", "error", "-ss", f"{start:.3f}", "-i", str(src), "-t", f"{dur:.3f}",
                    "-vf", f"fps=30,scale=-2:{height},{BT709_VF}", "-c:v", "libx264", "-preset", "slow", "-tune", "animation",
                    "-crf", str(crf), "-maxrate", f"{vk}k", "-bufsize", f"{2 * vk}k", "-pix_fmt", "yuv420p",
                    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
                    "-c:a", "aac", "-ac", "1", "-ar", "24000", "-b:a", f"{AUDIO_K}k", "-movflags", "+faststart",
                    str(dst)], check=True)
    return dst.stat().st_size / 1e6


def chapters(scenes: list) -> list:
    total = scenes[-1]["start"] + scenes[-1]["dur"]
    if total <= CHAPTER_S + 30:
        return [(0, len(scenes))]
    out, a = [], 0
    for i, s in enumerate(scenes):
        # cut only where a chapter begins (its card), or at any scene if a chapter alone is too long
        starts_chapter = s.get("kind") == "card" or (s.get("heading") and (i == 0 or scenes[i - 1].get("kind") != "card"))
        if i > a and s["start"] + s["dur"] - scenes[a]["start"] > CHAPTER_S and (starts_chapter or s["start"] - scenes[a]["start"] > CHAPTER_S):
            out.append((a, i))
            a = i
    out.append((a, len(scenes)))
    return out


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="Build self-contained web pages (video embedded) for a rendered explainer")
    ap.add_argument("video_dir")
    vdir = Path(ap.parse_args().video_dir).resolve()
    slug = vdir.name
    props = json.loads((vdir / "build" / "props.json").read_text("utf-8"))
    says = json.loads((vdir / "spec.json").read_text("utf-8"))["scenes"]
    src = vdir / "out" / f"{slug}.mp4"
    if not src.exists():
        sys.exit(f"render first: {src} not found (run make.py)")
    scenes, title = props["scenes"], props["title"]
    share = vdir / "out" / "share"
    if share.exists():
        shutil.rmtree(share)
    share.mkdir(parents=True)
    chs = chapters(scenes)
    cr = f"<p class='cr'>Credits: {html.escape('; '.join(props['credits']))}</p>" if props.get("credits") else ""
    files, total_mb, warns = [], 0.0, []
    for n, (a, b) in enumerate(chs, 1):
        start = scenes[a]["start"]
        dur = scenes[b - 1]["start"] + scenes[b - 1]["dur"] - start
        vk = max(60, int(PART_MB * 8000 * 0.93 / dur - AUDIO_K))  # kbit/s left for video in this part
        mp4 = share / f"part-{n:02d}.mp4"
        for height, crf, k in ((720, 30, vk), (540, 32, vk), (540, 35, int(vk * 0.7))):
            mb = encode(src, mp4, start, dur, height, crf, k)
            if mb <= PART_MB:
                break
        else:
            warns.append(f"part {n} is {mb:.2f} MB (limit {PART_MB}): lower CHAPTER_S in page.py")
        heading = next((scenes[i].get("heading") for i in range(a, b) if scenes[i].get("heading")), None)
        mins = f"{int(dur // 60)}:{int(dur % 60):02d}"
        if len(chs) > 1:
            ptitle = f"{n}. {heading or f'Part {n}'}"
            sub = f"Part {n} of {len(chs)}, {mins}"
        else:
            ptitle, sub = title, f"Narrated explainer, {mins}"
        spec_ids = [scenes[i]["n"] - 1 for i in range(a, b) if scenes[i].get("n")]  # chapter cards have no spec scene
        tr = "".join(f"<p>{f'<strong>{html.escape(says[j][chr(104) + 'eading'])}.</strong> ' if says[j].get('heading') else ''}"
                     f"{html.escape(shown_text(says[j].get('say') or ''))}</p>" for j in spec_ids)
        b64 = base64.b64encode(mp4.read_bytes()).decode("ascii")
        page = (f"<!doctype html><html lang='en'><head><meta charset='utf-8'>"
                f"<meta name='viewport' content='width=device-width,initial-scale=1'><title>{html.escape(ptitle)}</title>"
                f"<style>{CSS}</style></head><body><main><h1>{html.escape(title)}</h1><p class='sub'>{html.escape(sub)}</p>"
                f"<video controls playsinline preload='metadata' src='data:video/mp4;base64,{b64}'></video>"
                f"<details><summary>Transcript</summary>{tr}</details>{cr}</main></body></html>")
        f = share / f"part-{n:02d}.html"
        f.write_text(page, "utf-8")
        total_mb += f.stat().st_size / 1e6
        files.append(f)
    ledger_p = vdir / "ledger.json"
    for e in json.loads(ledger_p.read_text("utf-8")) if ledger_p.exists() else []:
        bad = {"COPYRIGHT", "NC", "ND"} & set(e.get("flags") or [])
        if bad:
            warns.append(f"'{e.get('title')}' ({e.get('license')}) is {'/'.join(sorted(bad))}: fine for a private video, "
                         "ask the owner before sharing this link")
    if total_mb > LINK_MB:
        warns.append(f"all parts total {total_mb:.1f} MB, over the {LINK_MB} MB link cap: split into two videos")
    quoted = " ".join(f'"{f}"' for f in files)
    result = {
        "parts": [f"{f} ({f.stat().st_size / 1e6:.2f} MB)" for f in files],
        "total_mb": round(total_mb, 2),
        "warnings": warns,
    }
    hosts = {}
    if LOCAL.exists():
        try:
            hosts = json.loads(LOCAL.read_text("utf-8"))
        except (OSError, ValueError) as exc:
            warns.append(f"local/page.json could not be read ({exc}); no publish commands printed")
    if isinstance(hosts, dict) and hosts.get("publish"):
        fill = lambda s: str(s).replace("{parts}", quoted).replace("{title}", title)  # noqa: E731
        result["publish_new_link"] = fill(hosts["publish"])
        if hosts.get("attach"):
            result["attach_to_existing_page"] = fill(hosts["attach"])
    else:
        result["next"] = "each part is one self-contained HTML page: open it in a browser, or put it on any web host"
    print(json.dumps(result, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
