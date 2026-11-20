"""
@file sound.py
@description The sound of a video beyond its narration (v0.3, docs/v0.3-architecture.md section 5): a music bed
  that ducks under the voice, and sound effects placed on cues. This file is the hook make.py calls. The mix itself
  is work package C; until it is written, mix() returns None and the video keeps its narration alone.
@see make.py (calls mix once the narration buffer exists), render.py (encode muxes the file mix returns)
"""
from __future__ import annotations

from pathlib import Path


def mix(spec: dict, scenes: list, narration, sr: int, total: float, vdir: Path, pub: Path, used: list, warns: list,
        ctx: dict) -> str | None:
    """Mix the video's sound -> the name of the mixed file inside `pub` (for example "mix.wav"), or None when there
    is nothing to mix, and then the narration is the sound.

    spec: the whole spec.json ("music" is at its top level). scenes: the resolved scenes, each with "start", "dur",
    "words" and "visual"; a visual's "sfx" entries carry "at" in scene seconds, so an effect plays at
    scene["start"] + at + offset. narration: the narration of the whole video, mono float32 at `sr`, with the voice
    already at its place on the timeline. total: the video's length in seconds. used: the asset ledger; append what
    is fetched. warns: append warnings. ctx: topic, prefixes and private for asset search; append to
    ctx["placeholders"] what could not be made; put the measured levels in ctx["sound"], which make.py prints in its
    report. With a mix, the final encode uses a limiter in place of the loudness filter (render.encode)."""
    return None
