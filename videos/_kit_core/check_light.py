"""
@file videos/_kit_core/check_light.py
@description The smoke check of the light rig (docs/v0.3-architecture.md section 6.8, "Light and colour"): the top
  of a matte slab under the studio look must read its own palette colour within 2 levels in a PNG still. It reads
  the slab colours from scene 3 of this folder's spec.json (hex values, or paint names resolved against the theme
  and the spec's design) and counts the pixels of the still that match each one. A colour with fewer than 2000
  matching pixels fails, because a slab top covers tens of thousands.
@usage  .venv\\Scripts\\python make.py videos\\_kit_core --still 3@5
        .venv\\Scripts\\python videos\\_kit_core\\check_light.py   (exit code 1 when a colour is off)
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
PNG = HERE / "out" / "still-03-5.png"
LEAST = 2000  # pixels within 2 levels; a slab top in this shot has more than 60 000

spec = json.loads((HERE / "spec.json").read_text("utf-8"))
themes = json.loads((ROOT / "src" / "themes.json").read_text("utf-8"))
theme = themes["themes"][spec.get("theme") or themes["default"]]
paints = {**theme["paint"], **((spec.get("design") or {}).get("paint") or {})}
wanted = [s["color"] if s["color"].startswith("#") else paints[s["color"]] for s in spec["scenes"][2]["visual"]["props"]["slabs"]]

size = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0",
                       str(PNG)], capture_output=True, text=True, check=True).stdout.strip().split(",")
w, h = int(size[0]), int(size[1])
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(PNG), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
img = np.frombuffer(raw, dtype=np.uint8).reshape(h, w, 3).astype(int)

bad = 0
for hx in wanted:
    c = np.array([int(hx[i:i + 2], 16) for i in (1, 3, 5)])
    n = int((np.abs(img - c).max(axis=2) <= 2).sum())
    ok = n >= LEAST
    bad += not ok
    print(f"{hx.upper()}: {n} px within 2 levels {'ok' if ok else 'fails'}")
sys.exit(1 if bad else 0)
