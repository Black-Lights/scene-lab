"""
@file cues.py
@description The cue grammar of free and world visuals (v0.3, docs/v0.3-architecture.md section 2) and the review
  times of a filmstrip. A cue is a phrase of the scene's narration as shown (the shown part of a {shown|spoken}
  group, narration.py, F-013: the words handed in are already the shown ones); make.py turns it into "at", seconds from the
  scene's start, so scene code never holds a spoken word. Rules: letters and digits only; a whole-word match wins
  over a prefix match; inside one list (and inside "beats") each cue is looked for after the previous one, then
  from the start; "nth" picks a later time the words are spoken; "until", a second phrase, becomes "over". A cue
  that cannot be found is an error, because a wrong word must fail at build time and never silently in a render.
  Old templates keep their own document-order rule in make.py (resolve_cues).
@see make.py (calls resolve_free and strip_times), custom.py (validates the blocks before this runs)
"""
from __future__ import annotations

import re

LEAD_IN = 0.12   # a change starts this long before its word, so the motion lands on the word
SKIP = {"image", "assets", "tracks", "places"}  # holds no timed entry: requests and declarations
# How long a change lasts when its entry gives no "over" (the kit's DUR table, src/motion.ts: camera 1.3, morph 0.9
# for numbers and lists of numbers, micro 0.25 for anything else, such as a colour): used to pick the frames of a
# filmstrip and to echo the timing in the cues table, never written into the props.
OVER = {"shots": 1.3, "set": 0.9}
OVER_ELSE = 0.5
OVER_MICRO = 0.25
EASE_DEFAULT = "move"  # what the kit's easeOf gives an entry that names no ease


def norm(s: str) -> str:
    return re.sub(r"[^0-9a-z]+", "", str(s).lower())


def phrase(text: str) -> list:
    return [norm(x) for x in str(text).split() if norm(x)]


def is_num(x) -> bool:
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def occurrences(spoken: list, cue: list) -> tuple:
    """Every place the phrase is spoken -> (word indexes, whole). Whole-word matches win: only when the phrase is
    never spoken as whole words do the places count where each cue word starts a spoken word."""
    if not cue:
        return [], True
    span = range(len(spoken) - len(cue) + 1)
    whole = [i for i in span if all(spoken[i + j] == c for j, c in enumerate(cue))]
    if whole:
        return whole, True
    return [i for i in span if all(spoken[i + j].startswith(c) for j, c in enumerate(cue))], False


def _name(node: dict, path: list) -> tuple:
    """(block, key) of an entry for the cue table: the visual's block it sits in, and what it acts on."""
    block = str(path[0]) if path else "visual"
    if block == "beats" and len(path) > 1:
        return block, str(path[1])
    for k in ("key", "keys", "on", "frame", "target", "sound", "id", "text", "preset"):
        v = node.get(k)
        if isinstance(v, str) and v:
            return block, v[:40]
        if isinstance(v, list) and v and all(isinstance(x, str) for x in v):
            return block, ",".join(v)[:40]
    tail = "".join(f"[{p + 1}]" if isinstance(p, int) else f".{p}" for p in path[1:])
    return block, tail.lstrip(".") or "entry"


def _entry(node: dict, path: list, ptr: list, st: dict) -> None:
    words, spoken, n = st["words"], st["spoken"], st["n"]
    block, key = _name(node, path)
    where = f"scene {n} {block} {key}"
    cue, has_at = node.get("cue"), "at" in node
    line = None
    after = 0  # the word index a following "until" is looked for from
    if cue is not None and not isinstance(cue, str):
        if not st["checked"]:  # custom.py has said so already for a custom or world visual
            st["errors"].append(f"{where}: \"cue\" must be words of the narration, not {type(cue).__name__}")
        return
    if has_at and not is_num(node["at"]):
        if cue is not None:
            st["warns"].append(f"{where}: \"cue\" beside a non-numeric \"at\" ({str(node['at'])[:30]}): \"at\" is a time in "
                               f"seconds, so the cue is not used; a position is \"pos\"")
        return
    if has_at:
        if cue is not None:
            st["warns"].append(f"{where}: has both \"cue\" and \"at\"; the time {node['at']} s is used and the cue is not")
        line = f"{n} {block} {key}: at {float(node['at']):.2f} s"
        after = next((i for i, w in enumerate(words) if w["s"] >= float(node["at"])), len(words))
    elif cue is not None:
        cw = phrase(cue)
        hits, whole = occurrences(spoken, cw)
        nth = node.get("nth")
        if not cw:
            st["errors"].append(f"{where}: cue '{cue}' has no letters or digits")
            return
        if not hits:
            st["errors"].append(f"{where}: cue '{cue}' is not in the narration")
            return
        if nth is not None:
            if not isinstance(nth, int) or isinstance(nth, bool) or nth < 1:
                st["errors"].append(f"{where}: \"nth\" must be a whole number from 1 up, not {nth!r}")
                return
            if nth > len(hits):
                st["errors"].append(f"{where}: cue '{cue}' is spoken {len(hits)} time{'s' if len(hits) != 1 else ''}, "
                                    f"so there is no \"nth\": {nth}")
                return
            k = nth - 1
        else:
            k = next((j for j, h in enumerate(hits) if h >= ptr[0]), 0)  # after the previous cue, then from the start
            if len(hits) > 1:
                st["warns"].append(f"{where}: cue '{cue}' is spoken {len(hits)} times; used the one at "
                                   f"{words[hits[k]]['s']:.1f} s (add \"nth\" to choose)")
        hit = hits[k]
        node["at"] = round(max(0.0, words[hit]["s"] - LEAD_IN), 3)
        ptr[0] = hit + 1
        after = hit + len(cw)
        said = " ".join(w["w"] for w in words[hit:hit + len(cw)]).strip(".,;:!?")
        line = (f"{n} {block} {key}: '{cue}' -> {node['at']:.2f} s, match {k + 1} of {len(hits)}"
                + ("" if whole else f", as the start of '{said}'"))
    # In a scene that carries on a world, an entry without a cue still moves: from t = 0, so it is timed like any other
    opening = bool(st.get("follows")) and opens(node, block, len(path))
    if opening:
        line = (f"{n} {block} {key}: no cue, so a {'camera move' if block == 'shots' else 'change'} from 0.00 s "
                f"(the scene carries on the world from the scene before)")
    if "until" in node:
        start = float(node.get("at", 0.0))
        unt, end, note = node["until"], None, ""
        if is_num(unt):
            end, note = float(unt), f"until {float(unt):.2f} s"
        elif isinstance(unt, str) and phrase(unt):
            hits, whole = occurrences(spoken, phrase(unt))
            later = [h for h in hits if h >= after]
            if not later:
                st["errors"].append(f"{where}: until '{unt}' is not spoken after the entry starts"
                                    if hits else f"{where}: until '{unt}' is not in the narration")
                return
            end = max(0.0, words[later[0]]["s"] - LEAD_IN)
            note = f"until '{unt}'" + ("" if whole else " (start of a word)") + f", match {hits.index(later[0]) + 1} of {len(hits)}"
        else:
            st["errors"].append(f"{where}: \"until\" must be words of the narration or a time in seconds")
            return
        if end - start <= 0:
            st["errors"].append(f"{where}: {note} ends at {end:.2f} s, which is not after its start at {start:.2f} s")
            return
        if "over" in node:
            st["warns"].append(f"{where}: has both \"over\" and \"until\"; \"until\" is used")
        node["over"] = round(end - start, 3)
        del node["until"]  # the props carry times only: a phrase left here could be read as seconds by scene code
        line = (line or f"{n} {block} {key}: from the scene's start") + f"; {note} -> over {node['over']:.2f} s"
    if line:
        st["table"].append(line + _motion(node, block, st, said=line.endswith(f"over {node.get('over', 0):.2f} s"),
                                          start=0.0 if opening else None))


def default_over(node: dict, block: str | None) -> float:
    """How long an entry lasts when it gives no "over", the way the kit decides it (world.ts lengthOf, camera.ts):
    a camera move 1.3 s, a set of a number or a list of numbers 0.9 s, a set of any other value (a colour, a word)
    0.25 s. The cues table, the strip and the changes carried over a seam all use this one rule."""
    if block == "shots":
        return OVER["shots"]
    if block == "set":
        to = node.get("to")
        return OVER["set"] if is_num(to) or (isinstance(to, list) and bool(to) and is_num(to[0])) else OVER_MICRO
    return OVER_ELSE


def _over(node: dict, block: str | None) -> float:
    return float(node["over"]) if is_num(node.get("over")) else default_over(node, block)


def opens(node: dict, block: str | None, path_len: int) -> bool:
    """A set or shot entry with neither "cue" nor "at": in a scene that carries on from a scene of the same world it
    is a change that starts at t = 0 (world.ts, camera.ts shotEntries); elsewhere it is the state the scene opens in."""
    return block in ("set", "shots") and path_len == 2 and "at" not in node and "cue" not in node


def _motion(node: dict, block: str, st: dict, said: bool = False, start: float | None = None) -> str:
    """The timing of a change for its cues line: its "over" (marked as the default when the entry gives none), its
    ease, and a note when it ends after the scene does (in a world run it carries on in the next scene). `said`: the
    line already gives the "over" an "until" became. `start`: the time of an entry that has no "at" (an opening
    change of a scene that carries on a world starts at 0)."""
    at = float(node["at"]) if is_num(node.get("at")) else start
    if at is None:
        return ""
    if block == "labels":
        return f"; shown for {float(node['over']):.2f} s" if is_num(node.get("over")) else ""
    if block not in ("set", "shots"):
        return ""
    given = is_num(node.get("over"))
    over = _over(node, block)
    out = ("," if said else f"; over {over:.2f} s" + ("" if given else " (default)") + ",") + f" ease {node.get('ease') or EASE_DEFAULT}"
    dur = st.get("dur")
    if is_num(dur) and at + over > dur:
        out += f"; ends at {at + over:.2f} s, after the scene's end at {dur:.2f} s"
    return out


def _walk(node, path: list, ptr: list, st: dict) -> None:
    if isinstance(node, dict):
        if path != ["beats"]:  # the beats dict itself is a table of names: a beat named "until" is not a time word
            _entry(node, path, ptr, st)
        for k, v in node.items():
            if k in SKIP:
                continue
            # "beats" is a timeline of its own, like every list; other dicts continue their parent's
            _walk(v, path + [k], [0] if (not path and k == "beats") else ptr, st)
    elif isinstance(node, list):
        own = [0]
        for i, x in enumerate(node):
            _walk(x, path + [i], own, st)


def resolve_free(visual: dict, words: list, n: int, warns: list, errors: list, table: list, dur: float | None = None,
                 follows: bool = False) -> None:
    """Resolve every cue of a free or world visual in place. `words` are the scene's spoken words in scene seconds.
    Each entry with "cue" gets "at"; each "until" becomes "over". `table` gains one line per timed entry (the
    report's "cues"); a cue that cannot be resolved goes to `errors`, which stop the render. A mistake of form that
    custom.py's validation already reports (custom and world visuals) is not reported a second time. `dur`, the
    scene's length, lets a line say that a change ends after the scene does. `follows`: the scene carries on a
    world from the scene before it (follows()), so a set or shot entry without a cue is a change from t = 0."""
    checked = visual.get("type") in ("custom", "world")
    beats = visual.get("beats")
    if isinstance(beats, dict):  # a beat is a phrase, {cue, nth} or a number of seconds
        out = {}
        for k, b in beats.items():
            if isinstance(b, str):
                out[k] = {"cue": b}
            elif is_num(b):
                out[k] = {"at": float(b)}
            elif isinstance(b, dict):
                out[k] = b
            elif not checked:  # custom.py reports a bad beat of a custom or world visual
                errors.append(f"scene {n} beats {k}: a beat is a phrase, {{\"cue\", \"nth\"}} or a number of seconds")
        visual["beats"] = out
    st = {"words": words, "spoken": [norm(w["w"]) for w in words], "n": n, "warns": warns, "errors": errors, "table": table,
          "checked": checked, "dur": dur, "follows": follows}
    _walk(visual, [], [0], st)


def follows(prev: dict | None, visual: dict) -> bool:
    """Whether a scene carries on a world from the scene before it, as the kit decides it (world.ts worldLine): the
    entry before it in the video (a chapter card counts) is a world scene of the same world. A cut between them
    does not change it; the state and the camera carry on either way."""
    return (prev is not None and visual.get("type") == "world" and isinstance(visual.get("world"), str)
            and (prev.get("visual") or {}).get("type") == "world" and prev["visual"].get("world") == visual["world"])


def timed(node, block: str | None = None, acc: list | None = None, follows_: bool = False, path_len: int = 0) -> list:
    """Every timed entry of a resolved visual -> [(at, over, block)], `over` with the default filled in. With
    `follows_`, a set or shot entry without a cue counts as a change at t = 0 (opens())."""
    acc = [] if acc is None else acc
    if isinstance(node, dict):
        if is_num(node.get("at")):
            acc.append((float(node["at"]), _over(node, block), block))
        elif follows_ and opens(node, block, path_len):
            acc.append((0.0, _over(node, block), block))
        for k, v in node.items():
            if k != "image":
                timed(v, block if block is not None else str(k), acc, follows_, path_len + 1)
    elif isinstance(node, list):
        for x in node:
            timed(x, block, acc, follows_, path_len + 1)
    return acc


def carried(prev_visual: dict, prev_dur: float, prev_follows: bool = False) -> list:
    """The changes of the scene before that are still running when this scene starts (a world run, where the state
    carries across the seam) -> [(start, end, block)] in this scene's seconds; start is negative."""
    out = []
    for at, over, block in timed(prev_visual, follows_=prev_follows):
        if at + over > prev_dur:
            out.append((round(at - prev_dur, 3), round(at + over - prev_dur, 3), block))
    return out


def strip_times(dur: float, visual: dict, free: bool, k: int = 8, most: int = 24, next_cut: float = 0.0,
                inherited: list = (), follows_: bool = False) -> list:
    """Review times in one scene -> [(seconds, label)]. An old template is seen at the cut in, a moment after each
    cue and at the settled end, eight frames in all. A free or world visual is seen at the middle of every timed
    change and just after its end (at + over / 2 and at + over + 0.1), so both the motion and its result are
    checked; the strip grows up to `most` frames to hold them. Gaps are split when there are fewer than `k`.
    `next_cut`: the length of the cut out of this scene. A cut is centred 0.2 s before the next scene starts
    (src/Explainer.tsx), so "end" is taken 0.1 s before it begins: the settled end of this scene, not the next one
    gliding in. `inherited`: changes of the scene before that run on into this one (carried()); each is seen at the
    middle of what is left of it and just after its end. `follows_`: the scene carries on a world (follows()), so its
    entries without a cue are changes from t = 0 and get their mid and done frames too."""
    last = max(0.1, dur - 0.3 if next_cut <= 0 else dur - 0.2 - next_cut / 2 - 0.1)
    pts = {0.1: "start"}

    def add(t: float, label: str) -> None:
        t = round(min(t, last), 2)
        if 0.1 < t < last:
            pts.setdefault(t, label)

    for start, end, block in inherited:
        add((max(0.0, start) + end) / 2, f"{block or 'entry'} from before mid")
        add(end + 0.1, f"{block or 'entry'} from before done")
    for at, over, block in sorted(timed(visual, follows_=follows_ and free), key=lambda e: e[0]):
        if free:
            add(at + over / 2, f"{block or 'entry'} mid")
            add(at + over + 0.1, f"{block or 'entry'} done")
        else:
            add(at + 0.25, "cue +0.25 s")
    pts[round(last, 2)] = "end"
    ts_ = sorted(pts)
    ts_ = [t for i, t in enumerate(ts_) if i == 0 or t - ts_[i - 1] > 0.15 or pts[t] == "end"]
    cap = min(max(k, len(ts_)), most) if free else k
    if len(ts_) > cap:
        ts_ = [ts_[round(j * (len(ts_) - 1) / (cap - 1))] for j in range(cap)]
    while len(ts_) < k:
        i = max(range(len(ts_) - 1), key=lambda j: ts_[j + 1] - ts_[j])
        mid = round((ts_[i] + ts_[i + 1]) / 2, 2)
        pts.setdefault(mid, "between")
        ts_.insert(i + 1, mid)
    return [(t, f"{t:.2f} s, {pts.get(t, 'between')}") for t in ts_]
