# Research: look (2026-11-14, v0.2 sweep)

(a) SLOP ITEMS THE AVOID LIST DID NOT YET COVER (the main ones since added to docs/avoid-list.md)
Web lists, re-checked:
- Linear or default "ease" easing; more than one animated element at a time; animated rainbow or conic borders; glow rings under floating objects; layout-shifting motion; generic spinners. https://github.com/Laith0003/ux-skill/wiki/Anti-AI-slop-ban-list
- Floating products on gradients; full-bleed abstract "tech mesh" images; mocked-up generic UI; cartoon illustration mixed with line icons; several illustration or icon systems in one piece; decorative extreme variable-font settings; Title Case copy; headlines wrapping to 5+ lines; round-number stats ("10,000+"). Same URL.
- Hard unblurred offset shadows (neobrutalist); thick coloured borders on rounded cards; torn-paper image masks; images under near-opaque overlays; extreme radii; wiggling icons and floating badges. https://impeccable.style/slop
- Pure black or pure white backgrounds. https://cdn.jsdelivr.net/npm/pixelslop@0.3.8/dist/skill/resources/ai-slop-patterns.md
- Krebs and Developers Digest add nothing new; both name "VibeCode Purple". https://adriankrebs.ch/blog/design-slop/ https://www.developersdigest.tech/blog/ai-design-slop-and-how-to-spot-it

Video-specific (vendor blogs, so weak sources):
- Flat lighting; oversaturated colour; camera moves too smooth; gibberish text in generated images; repeating textures. Most relevant to local TTS: narration at one pitch and pace with no breaths or emphasis. https://www.opus.pro/blog/ai-slop-aesthetic-12-tells
- Objects feel weightless and slide instead of gripping. https://makeitpop.beehiiv.com/p/make-it-pop-09-the-2026-ai-video-playbook-for-brands-how-to-avoid-the-ai-slop-trap
- Pseudo-explainers: AI voice over AI art, nothing verified. https://www.opus.pro/blog/unhinged-ai-slop-videos-2026
- Corporate Memphis came from Buck's "Alegria" guide for Facebook. It is criticised for sameness and lack of specificity. https://eyeondesign.aiga.org/what-the-think-pieces-about-corporate-memphis-tell-us-about-the-state-of-illustration/ https://shots.net/news/view/corporate-memphis-the-design-style-that-quietly-took-over-the-internet
- Template look: overused After Effects templates read as generic. https://pitchworx.com/motion-not-stock
- Not found in any credible list (so add only on judgement): lens flares, glowing particles, sci-fi HUD overlays, isometric stock 3D, generic kinetic type.

(b) TYPEFACES
All are OFL-1.1 and variable. Package ids and weights are from the Fontsource API (https://api.fontsource.org/v1/fonts/<id>). Designers are from Google Fonts metadata (https://fonts.google.com/metadata/fonts/<Family>). I measured no x-heights. Only the fonts marked "documented" have published Il1/0O distinctions. Test the rest with "Il1 0O rn m" at 720p. The "default?" notes are my judgement.

- atkinson-hyperlegible-next: 200-800 plus italics. Braille Institute (2025; original 2019), made for low-vision readers. Documented: 1/I/l/i, O/0 and B/8 are distinct, counters are open. https://www.brailleinstitute.org/freefont/ Not yet a default, but its "special circles" give it a visible character.
- inclusive-sans (worth adding): 300-700 plus italics. Olivia King. Documented: Il1 and O0 distinct, raised x-height, wider default spacing, b/d/p/q not mirrored. https://github.com/LivKing/Inclusive-Sans Rare.
- b612: 400 and 700 plus italics. Airbus, ENAC and Intactile, for cockpit displays. Few weights limit hierarchy.
- lexend: 100-900, no italic. Bonnie Shaver-Troup and others, for reading fluency. Its own small study: 20 pupils, 128 vs 110 words per minute (a 16% gain), not replicated. https://www.lexend.com/ Common in edtech.
- source-sans-3: 200-900 plus italics. Paul D. Hunt, Adobe's first open-source family, for UI. Reads as a default.
- ibm-plex-sans: 100-700 plus italics, width axis 75-100 (a condensed width helps labels). Mike Abbink with Bold Monday, IBM's corporate face. Strongly branded and widely used.
- public-sans: 100-900 plus italics. USWDS, based on Libre Franklin, "neutral". Reads as a default.
- red-hat-text (300-700) and red-hat-display (300-900), both plus italics. Jeremy Mickel (MCKL) for Red Hat. Two optical sizes: Text for small sizes, Display for titles.
- recursive: 300-900 on Fontsource (1000 per the designer), slant axis instead of italics, Casual and Mono axes. Arrow Type, for code and UI. https://www.recursive.design/ The Mono axis conflicts with the avoid list's mono rule; Sans with some Casual is distinctive.

Serif voice:
- newsreader: 200-800 plus italics, optical size 6-72. Production Type, for long reading on screens.
- literata: 200-900 plus italics, optical size 7-72. TypeTogether, for Google Play Books.
- source-serif-4: 200-900 plus italics, optical size 8-60. Frank Griesshammer, pairs with Source Sans.

(c) COLOUR, CONTRAST, COMPRESSION
Palettes:
- Okabe-Ito: #E69F00 orange, #56B4E9 sky blue, #009E73 bluish green, #F0E442 yellow, #0072B2 blue, #D55E00 vermilion, #CC79A7 reddish purple, #000000. Hex values from R package code, not the primary page. https://search.r-project.org/CRAN/refmans/see/html/okabeito_colors.html
- Okabe-Ito guidance: use vermilion for red and bluish green for green; avoid yellow-green; alternate warm and cool; use dark blue and orange for thin lines and small text; never colour alone, add shape and direct labels. https://jfly.uni-koeln.de/color/
- Paul Tol Bright: #4477AA #EE6677 #228833 #CCBB44 #66CCEE #AA3377 #BBBBBB.
- Paul Tol Vibrant: #EE7733 #0077BB #33BBEE #EE3377 #CC3311 #009988 #BBBBBB.
- Paul Tol Muted (9 colours): #CC6677 #332288 #DDCC77 #117733 #88CCEE #882255 #44AA99 #999933 #AA4499.
- All three are colour-blind safe but too strong as fills behind black text (use his pale scheme there). His guidance assumes a white background; check them on dark. https://sronpersonalpages.nl/~pault/

Light or dark background:
- Dark text on light reads better, most of all for fine detail; the likely reason is smaller pupils. The finding holds for older adults too. https://cogsci.nl/blog/is-bright-text-on-a-dark-background-a-good-idea https://docserv.uni-duesseldorf.de/servlets/DerivateServlet/Derivate-31413
- A counterpoint: overall brightness may matter more than polarity. https://peerj.com/articles/8220.pdf
- 3Blue1Brown's black comes from Manim's default (secondary source); I found no statement of his reasons. https://blog-quantumsketch.pages.dev/how-to-animate-like-3blue1brown/
- Kurzgesagt describes its style (flat 2D plus 3D, vector and pixel art) but not its background choices. https://kurzgesagt.org/youtube/

Contrast and captions:
- WCAG AA is 4.5:1, or 3:1 for large text. https://www.w3.org/TR/WCAG22/#contrast-minimum
- BBC research: each subtitle line takes about 8% of screen height, and viewers strongly preferred BBC Reith Sans. I could not open the official guidelines, so verify the numbers. https://bbc.github.io/csun/how_big_should_subtitles_be/index.html
- White text on a semi-transparent black box sized to the text. https://dls.tepapa.govt.nz/_pages/patterns/video/

Compression:
- x264 "--tune animation" (meant for flat content): more B-frames, deblock 1:1, lower psy-rd, AQ strength 0.6, double reference frames.
- "--tune grain" has to spend bits to keep noise: AQ 0.5, no DCT decimate, deblock -2:-2, qcomp 0.8. https://raw.githubusercontent.com/mirror/x264/master/x264.c
- Grain is hard to compress. Netflix's AV1 film-grain synthesis (grain stripped before encoding, rebuilt at the decoder) cut average bitrate about 36% at 1080p and above, but only about 10% below 1080p. Secondary coverage; Netflix's own post blocked fetching. https://www.tvtechnology.com/news/netflix-rolls-out-av1-film-grain-synthesis-streams-for-film-content
- Banding shows in smooth low-texture areas (gradients, fades, flat animation fills) when the encoder is short of bits. Grain dithers it away but costs bitrate; 10-bit encoding bands less. https://www.forasoft.com/learn/video-quality/articles-vqm/banding-gradient-steps
- Static backgrounds encode small: no outside source fetched; the project's own note is "moving pixels cost file size" (CLAUDE.md).
