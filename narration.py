"""
@file narration.py
@description What is said and what is shown may differ (F-013). Inside a scene's "say", {shown|spoken} puts "shown"
  on screen (captions, transcript, SRT and VTT, the cues table, the words handed to scene code, cue matching) and
  gives "spoken" to the voice. Example: "the token {[INST]|inst} opens a user turn" is spoken as "the token inst
  opens a user turn" and captioned as "the token [INST] opens a user turn". Both parts are non-empty, either may hold
  several words, and groups do not nest. The voice returns times for the spoken words; each group's span of time is
  handed to its shown words, split evenly when there are several. A "say" without a group is passed through
  untouched, so every older spec keeps its words, its captions and its cached narration.
@see make.py (validates every scene before any synthesis, then calls spoken(), shown() and shown_words()),
  page.py (the transcript of each page part), SPEC.md section 3
"""
from __future__ import annotations

import re
from difflib import SequenceMatcher

# Written abbreviations the voice reads badly; outside a group they earn a warning that names F-013
ABBREV = re.compile(r"(?<![0-9A-Za-z])(i\.e\.|e\.g\.|etc\.|vs\.)", re.IGNORECASE)


class SayError(ValueError):
    """A "say" text whose groups cannot be read: the scene must not be synthesized."""


def parse(text: str) -> list:
    """A "say" text -> segments: a str is plain text (said and shown alike), a tuple (shown, spoken) is a group.
    Whitespace inside a part is collapsed, so "{ [INST] | inst }" is the same group as "{[INST]|inst}"."""
    segs, buf, i = [], [], 0
    while i < len(text):
        c = text[i]
        if c == "{":
            close, again = text.find("}", i + 1), text.find("{", i + 1)
            if close < 0:
                raise SayError(f"the '{{' at character {i + 1} has no closing '}}'")
            if 0 <= again < close:
                raise SayError(f"the '{{' at character {again + 1} opens a group inside a group; groups do not nest")
            body = text[i + 1:close]
            if body.count("|") != 1:
                raise SayError(f"the group '{{{body}}}' needs exactly one '|' between the shown and the spoken words")
            shown, spoken = (" ".join(x.split()) for x in body.split("|"))
            if not shown or not spoken:
                raise SayError(f"the group '{{{body}}}' has an empty {'shown' if not shown else 'spoken'} part")
            if buf:
                segs.append("".join(buf))
                buf = []
            segs.append((shown, spoken))
            i = close + 1
        elif c == "}":
            raise SayError(f"the '}}' at character {i + 1} has no opening '{{'")
        else:
            buf.append(c)
            i += 1
    if buf:
        segs.append("".join(buf))
    return segs


def has_groups(segs: list) -> bool:
    return any(isinstance(s, tuple) for s in segs)


def spoken(segs: list) -> str:
    """What the voice gets, and what the narration cache is keyed on."""
    return "".join(s if isinstance(s, str) else s[1] for s in segs).strip()


def shown(segs: list) -> str:
    """What the captions, the transcript and the cues read."""
    return "".join(s if isinstance(s, str) else s[0] for s in segs).strip()


def shown_text(text: str) -> str:
    """The shown form of a "say" text for a reader (page.py); a text that does not parse is returned as it is."""
    try:
        return shown(parse(text))
    except SayError:
        return text


def check(text: str, n: int, errors: list, warns: list) -> None:
    """Validate one scene's "say": a group that cannot be read is an error naming the scene; a written abbreviation
    left outside a group is a warning naming F-013."""
    try:
        segs = parse(text)
    except SayError as exc:
        errors.append(f"scene {n}: say: {exc} (write {{shown|spoken}}, for example {{[INST]|inst}})")
        return
    found = [m.group(1) for s in segs if isinstance(s, str) for m in ABBREV.finditer(s)]
    for ab in dict.fromkeys(found):
        warns.append(f"scene {n}: say holds '{ab}' outside a {{shown|spoken}} group; the voice reads it as written. "
                     f"Write it for the ear (F-013), for example {{{ab}|{ab_spoken(ab)}}}")


def ab_spoken(ab: str) -> str:
    return {"i.e.": "that is", "e.g.": "for example", "etc.": "and so on", "vs.": "versus"}.get(ab.lower(), ab)


def _layout(segs: list) -> tuple:
    """-> (spoken string S, owner of each S char: -1 plain or the group index, shown string D, source of each D char:
    an S index for plain text or ("g", group index))."""
    S, s_own, D, d_src, g = [], [], [], [], 0
    for seg in segs:
        if isinstance(seg, str):
            for ch in seg:
                d_src.append(len(S))
                D.append(ch)
                S.append(ch)
                s_own.append(-1)
        else:
            sh, sp = seg
            S += list(sp)
            s_own += [g] * len(sp)
            D += list(sh)
            d_src += [("g", g)] * len(sh)
            g += 1
    # spoken() and shown() strip the ends; the voice's words come from the stripped text, so the layout matches it
    return "".join(S), s_own, "".join(D), d_src, g


def shown_words(segs: list, words: list) -> list:
    """The voice's words (times of the spoken text) -> the shown words with times. Plain words keep the voice's
    times; the words shown for a group share the time span of the group's spoken words evenly. Text without a group
    returns `words` itself."""
    if not has_groups(segs) or not words:
        return words
    S, s_own, D, d_src, n_groups = _layout(segs)
    # Every letter or digit of the spoken text -> the voice word it was read in. The voice's words are slices of the
    # text it was given (measured on 107 scenes), so the two streams are normally equal; difflib covers the rest.
    s_al = [i for i, ch in enumerate(S) if ch.isalnum()]
    w_al = [wi for wi, w in enumerate(words) for ch in w["w"] if ch.isalnum()]
    a = "".join(S[i].lower() for i in s_al)
    b = "".join(ch.lower() for w in words for ch in w["w"] if ch.isalnum())
    to_word: dict = {}
    if a == b:
        to_word = {s_al[k]: w_al[k] for k in range(len(a))}
    else:
        for blk in SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks():
            for k in range(blk.size):
                to_word[s_al[blk.a + k]] = w_al[blk.b + k]
    span: dict = {}  # group -> (start, end) of its spoken words
    for i, own in enumerate(s_own):
        if own >= 0 and i in to_word:
            w = words[to_word[i]]
            s0, e0 = span.get(own, (w["s"], w["e"]))
            span[own] = (min(s0, w["s"]), max(e0, w["e"]))
    toks = [(m.group(0), range(m.start(), m.end())) for m in re.finditer(r"\S+", D)]
    members: dict = {g: [] for g in range(n_groups)}  # group -> the shown tokens it touches, in order
    for t, (_, rng) in enumerate(toks):
        for g in dict.fromkeys(src[1] for p in rng if isinstance(src := d_src[p], tuple)):
            members[g].append(t)
    out = []
    for t, (text, rng) in enumerate(toks):
        times = []
        for p in rng:
            src = d_src[p]
            if not isinstance(src, tuple) and src in to_word:
                w = words[to_word[src]]
                times.append((w["s"], w["e"]))
        for g, ts in members.items():
            if t in ts and g in span:
                s0, e0 = span[g]
                k, j = len(ts), ts.index(t)
                times.append((s0 + (e0 - s0) * j / k, s0 + (e0 - s0) * (j + 1) / k))
        out.append({"w": text, "s": round(min(x[0] for x in times), 3), "e": round(max(x[1] for x in times), 3)}
                   if times else {"w": text, "s": None, "e": None})
    # A token with no letter the voice spoke (a lone symbol) sits at the end of the word before it, as synth does
    for i, w in enumerate(out):
        if w["s"] is None:
            prev = out[i - 1]["e"] if i else next((x["s"] for x in out[i + 1:] if x["s"] is not None), words[0]["s"])
            w["s"] = w["e"] = prev
    return out
