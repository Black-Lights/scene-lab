# Asset sources

Status, limits and the terms already agreed for every asset provider. Keys live in `.env` (gitignored);
`.env.example` is the empty template, so a key never goes there. Never print, log or commit a key (assets.py reads
them with `key()` and scrubs them from every error message). Code: `providers.py` (one function per provider),
`assets.py` (order, merging, cache, ledger). Checked 2026-11-14.

## How a video gets an asset

- A spec asks by kind and query: `"image": "padlock"` or `"image": {"q": "padlock", "kind": "photo", "pick": 3}`,
  optionally `"provider": "nasa"`. Kinds: icon, photo, illustration, vector, video, lottie, sound, music, font,
  hdri, model.
- make.py asks the providers for that kind in order and merges their results round-robin by rank. A provider whose
  key is missing is skipped quietly, unless the request names it with `"provider"`: then the report says which key
  it needs. The spec's `"topic"` moves the providers that hold that subject to the front (`TOPIC_FIRST` in
  providers.py: space puts NASA first, art and history the museums, medicine Wellcome).
- `make.py videos/<slug> --assets` renders one numbered contact sheet per request in `out/assets/`, with the source
  and licence under each candidate. Pick with `"pick": n` after one image read, and check that the picture fits
  the meaning (F-004: the v0.1 "padlock" was love locks on a bridge).
- Every asset used is written to `videos/<slug>/ledger.json` (source, author, licence, URL, flags), which feeds the
  credits. Icons are credited per icon set.
- Licences: public domain, CC0 and CC BY are preferred. NC, ND and SA are flagged on the contact sheet and in the
  report. Music or sound under ND is never offered: syncing audio to moving images is an adaptation under the CC 4.0
  legal code, which ND forbids. "All rights reserved" is rejected.
- `"private": true` in a spec (a video only the user watches) also lets copyrighted APOD pictures through, flagged
  COPYRIGHT. page.py warns before it builds page parts that contain anything flagged COPYRIGHT, NC or ND.

## Providers

| Provider | Kinds | Key in .env | Files kept in | Live test 2026-11-14 (make.py --assets) |
|---|---|---|---|---|
| Iconify | icon (resolved by name; sheets search the theme's set) | none | shared cache | pass: "key" in Bootstrap Icons, 5 |
| The Noun Project | icon | NOUN_PROJECT_KEY, NOUN_PROJECT_SECRET | build folder, fetched per render | pass: "key", 12 (public domain only) |
| Wikimedia Commons | photo, illustration (SVG drawings), video | none | shared cache | pass: photo 12, illustration 12, video 12 |
| Openverse | photo, illustration, sound, music | optional OPENVERSE_CLIENT_ID/SECRET (empty) | shared cache | partial: sound "rain" 12 and photos inside the merged search passed; a photo-only query failed with 504 Gateway Timeout from Openverse's servers, twice, even after a retry with a smaller page |
| NASA Image and Video Library | photo, video | none | shared cache | pass: photo "mars rover" 12, video "rocket launch" 12 |
| NASA APOD | photo | NASA_API_KEY | shared cache | pass for a date ("2022-07-12": 1); a text query only searches the last 90 days and "galaxy" matched none |
| Smithsonian Open Access | photo, illustration | SMITHSONIAN_API_KEY | shared cache | pass after a fix: "telegraph" 12 (needs `media_usage:CC0` in the query) |
| Europeana | photo, illustration | EUROPEANA_API_KEY | shared cache | pass: "printing press" 12 |
| The Met | photo, illustration | none | shared cache | pass: "astrolabe" 12 (search v1.1; public domain filtered per object) |
| Art Institute of Chicago | photo, illustration | none | shared cache | pass: "lighthouse" 11 (added in v0.2, CC0 works only) |
| Cleveland Museum of Art | photo, illustration | none | shared cache | pass: "map" 12 (added in v0.2, CC0) |
| Wellcome Collection | photo, illustration | none | shared cache | pass: "microscope" 12 (added in v0.2, CC0, CC BY, PDM) |
| Pixabay | photo, illustration, vector, video | PIXABAY_API_KEY | shared cache (responses 24 h) | pass: photo 12, illustration 12, video 12 |
| Unsplash | photo | UNSPLASH_ACCESS_KEY | shared cache | pass: "laptop" 12 (Unsplash+ results dropped) |
| lottie-web test files | lottie | none | shared cache | pass: "ripple" 1 (MIT; added in v0.2) |
| Freesound | sound | FREESOUND_API_KEY | build folder (temporary copies) | pass: "click" 12 (HQ MP3 previews) |
| Jamendo | music | JAMENDO_CLIENT_ID | build folder, no caching | pass: "ambient piano" 12 (ND excluded) |
| Fontsource | font | none | shared cache | pass: "hyperlegible" 3 |
| Poly Haven | hdri, model | none | shared cache | pass: "studio" HDRIs 12 |
| Sketchfab | model | SKETCHFAB_API_TOKEN | build folder | pass: "satellite" 12 (downloadable only) |
| Pexels | photo, video | PEXELS_API_KEY | | unavailable: new key issuance paused |

No template draws 3D models or HDRIs yet (that needs @remotion/three); the asset system already finds and fetches
them. Listed in docs/backlog.md.

## Terms that shape the code

- **Pixabay** (API docs read 2026-11-14): 100 requests per 60 s per key; API responses must be cached for 24 hours;
  no systematic mass downloads; images must be downloaded, never hotlinked; videos may be stored. Credit Pixabay and
  the contributor. Without approved full access, images go up to 1280 px (`largeImageURL`); `webformatURL` expires
  after 24 h. Videos: use medium (1080p).
- **The Noun Project** (API terms): do not cache SVG files, so they are fetched per render into the
  video's build folder and never into assets/cache; no use for AI training; do not replicate Noun Project. OAuth 1.0a
  with key and secret, signed in providers.py. Free access covers public-domain icons only, so searches send
  `limit_to_public_domain=1`. Credit the creator. Kept behind Iconify.
- **Unsplash** (API terms): credit "Photo by <name> on Unsplash"; the photo's download endpoint is called each time a
  photo is used in a render; demo apps get 50 requests per hour (search responses are cached 1 h). Unsplash+ results
  are dropped. Kept last for photos.
- **Jamendo**: the client ID is enough. API terms: free for non-commercial use, no caching beyond what an operation
  needs, credit the artist and Jamendo with a link to the track. NC tracks are flagged; ND tracks are excluded.
- **Freesound**: token authentication covers search and the HQ MP3 previews, enough for sound effects. API terms:
  keep only temporary copies, so files stay in the video's build folder. CC BY needs a credit; NC is flagged.
- **NASA**: no copyright on NASA-made media, but credit NASA, use no NASA logos and imply no endorsement; read the
  description for third-party rights. APOD: a non-empty `copyright` field means the photographer owns the picture.
- **Smithsonian, Met, Art Institute of Chicago, Cleveland**: CC0 only (filtered in the query or per object).
- **Europeana**: `reusability=open` (public domain, CC0, CC BY, CC BY-SA); the personal key is for personal use.
- **Wellcome**: CC0, CC BY and public-domain mark only.
- **Poly Haven**: CC0; a descriptive User-Agent is sent; credit "Poly Haven" when the live API is used.
- **Sketchfab**: download links expire in about 5 minutes, so models are fetched at once into the build folder;
  CC licences need a credit, NC and ND are flagged.
- **api.data.gov keys** (Smithsonian, NASA): 1,000 requests per hour by default.
- **Openverse**: anonymous use is rate-limited and was timing out on 2026-11-14. Registering free credentials
  (POST /v1/auth_tokens/register/, needs a name and an email) raises the limits; the code already uses
  OPENVERSE_CLIENT_ID/SECRET when they are set.

## Looked at and not added (research/assets.md)

- Lordicon free tier: needs attribution and is built on a NoDerivatives licence, so recolouring or animating is out.
- LottieFiles search: no documented public search API; the Lottie Simple License allows hand-picked single files, so
  a spec may use a LottieFiles JSON URL directly.
- Openclipart (API availability unverified), ccMixter (mostly NC or sampling licences), Internet Archive (licences
  vary per item), NASA 3D Resources (a git repository, no API), Library of Congress (20 requests per minute and a
  1 h block on a breach: needs a rate limiter first), Bioicons, Smart Servier and Kenney (no API: candidates for a
  local pack later).
