"""
@file source.py
@description Turn source material into compact plain text before writing a spec, so a session reads only the
  words: an HTML report or web page (scripts, styles, SVG and embedded images dropped; headings, paragraphs,
  lists, tables, captions and image alt text kept), a Markdown/text file, or a URL.
  Also prints a suggested video length from the amount of material.
@usage  .venv\\Scripts\\python source.py <file-or-url> videos/<slug>    -> videos/<slug>/source.md
"""
from __future__ import annotations

import re
import sys
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

BLOCK = {"p", "div", "section", "article", "li", "tr", "br", "h1", "h2", "h3", "h4", "h5", "h6", "figcaption",
         "blockquote", "pre", "table", "ul", "ol", "dt", "dd", "summary", "details", "caption", "header", "footer"}
SKIP = {"script", "style", "svg", "noscript", "template", "head", "button"}


class Text(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.out: list[str] = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in SKIP:
            self.skip += 1
            return
        if self.skip:
            return
        if tag in BLOCK:
            self.out.append("\n")
        if re.fullmatch(r"h[1-6]", tag):
            self.out.append("#" * int(tag[1]) + " ")
        elif tag == "li":
            self.out.append("- ")
        elif tag in ("td", "th"):
            self.out.append(" | ")
        elif tag == "img" and dict(attrs).get("alt"):
            self.out.append(f" [figure: {dict(attrs)['alt']}] ")

    def handle_endtag(self, tag):
        if tag in SKIP:
            self.skip = max(0, self.skip - 1)
        elif not self.skip and tag in BLOCK:
            self.out.append("\n")

    def handle_data(self, data):
        if not self.skip:
            self.out.append(data)


def suggest(words: int) -> str:
    if words < 400:
        return "1-2 min"
    if words < 1500:
        return "2-4 min"
    if words < 4000:
        return "5-7 min"
    if words < 9000:
        return "8-12 min"
    return "over 12 min of material: make two or three videos (one video of about 12 min is easier to watch and to share)"


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    src, vdir = sys.argv[1], Path(sys.argv[2])
    if src.startswith(("http://", "https://")):
        from make import UA, ssl_ctx  # certifi bundle: an out-of-date Windows certificate store fails on some sites
        req = urllib.request.Request(src, headers={"User-Agent": UA})
        raw = urllib.request.urlopen(req, timeout=60, context=ssl_ctx()).read().decode("utf-8", "replace")
        is_html = True
    else:
        p = Path(src)
        raw, is_html = p.read_text("utf-8", errors="replace"), p.suffix.lower() in (".html", ".htm")
    if is_html:
        parser = Text()
        parser.feed(raw)
        raw = "".join(parser.out)
    lines = [re.sub(r"[ \t ]+", " ", ln).strip(" |") for ln in raw.splitlines()]
    text = re.sub(r"\n{3,}", "\n\n", "\n".join(ln for ln in lines)).strip()
    vdir.mkdir(parents=True, exist_ok=True)
    (vdir / "source.md").write_text(text + "\n", "utf-8")
    words = len(text.split())
    print(f"{vdir / 'source.md'}: {words} words. Suggested video length: {suggest(words)}")


if __name__ == "__main__":
    main()
