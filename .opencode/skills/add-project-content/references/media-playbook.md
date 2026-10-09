# Media Playbook

Sizes, formats, and R2 conventions for this site.
Cloudflare Pages serves code; R2 (`noahhh-media`) serves bytes.

## Where things go

| What | Stays in | Served as |
|---|---|---|
| `cover.*` image (~50-200KB) | git, `public/posters/<slug>/` | Pages, instant LCP |
| Cover video `poster.*` (~50-200KB) | git, `public/posters/<slug>/` | Pages, LCP + card thumbnail + reduced-motion fallback |
| Display font, one weight (`.woff2` preferred) | git, `public/fonts/projects/<slug>/` | Pages, on-demand `@font-face` |
| Body images, gallery, strip (AVIF/WebP, 800/1600/2400w) | R2 | `https://media.noahhh.com/<slug>/...` |
| Cover video 20-25MB MP4 | R2 | same base, progressive MP4, muted-loop autoplay |
| PDF max 20MB | R2 | same base, end-slot button (see below) |
| 3D `.glb` | R2 | same base, link placeholder until viewer lands |

Git-committed (cover, posters, fonts) ship with the deploy — add them
explicitly (`git add public/posters/<slug>/ public/fonts/projects/<slug>/`).
R2 objects ship via `wrangler r2 object put` (dry-run printed, never
executed by the skill). `.media-tmp/` is staging only, never committed.

`MEDIA_BASE` default: `https://media.noahhh.com`. Ask if different.

Override: set `MEDIA_BASE` env or pass `--base` to the optimize script
when drafting URLs. Never hardcode a second base in `projects.ts`.

## Images

* Input: highest-quality JPG/PNG/TIFF from user. Never ask user to convert.
* Output per image: `name-800.avif/.webp`, `name-1600.avif/.webp`,
  `name-2400.avif/.webp` (skip 2400 if source narrower).
* Quality: AVIF `quality 50, effort 4`, WebP `quality 80`. Cover target
  <200KB at 800w; poster target 50-100KB.
* Manifest: `src` = 1600w AVIF URL (or WebP fallback note), plus
  `width`/`height` of source for CLS. `alt` is user-confirmed, required.
* Transcribe `width`/`height` into EVERY manifest image — solo, gallery,
  strip, and showcase visuals all require dims (no-shift rule). The
  optimizer prints them per file (`manifest.json` → `outputs[].srcWidth`
  / `srcHeight`); copy them across, never guess.
* Filenames: `<slug>/<name>-<w>.<ext>`, content-hash optional but
  recommended for immutable caching.

## Cover + poster promotion

The optimize script stages everything into `.media-tmp/<slug>/`. After
the manifest is applied, promote the git-bound files out of staging:

```bash
mkdir -p public/posters/<slug>
cp .media-tmp/<slug>/cover-800.avif public/posters/<slug>/cover-800.avif
cp .media-tmp/<slug>/cover-800.webp public/posters/<slug>/cover-800.webp
cp .media-tmp/<slug>/cover-1600.avif public/posters/<slug>/cover-1600.avif
cp .media-tmp/<slug>/cover-2400.avif public/posters/<slug>/cover-2400.avif
cp .media-tmp/<slug>/*poster-800.avif public/posters/<slug>/  # video posters
```

The manifest `cover` for an image cover points at the `public/posters/<slug>/` path
(e.g. `/posters/<slug>/cover-800.avif`), with `width`/`height` from the
source. Covers that render large (hero up to 1196px, featured cards) also
take `srcSet` — one entry per promoted width, first entry MUST equal `src`
(enforced by `validateProject`); hero + cards serve `srcset`/`sizes` off it
while thumbnails keep using `src`. A video cover drafts as `{ kind: 'video', src: <R2 mp4 URL>,
poster: <local poster path>, alt, width, height }` — poster dims from the
extracted frame. Body images keep their R2 URLs. Never upload covers or posters
to R2.

## Fonts

* Input: one user-pointed file, `.woff2` preferred; `.woff`/`.ttf`/`.otf`
  accepted and copied through as-is (no conversion — `sharp` doesn't do
  fonts and offline converters can't be relied on). Google Fonts URLs are
  rejected: download the file first, then point at it.
* One weight per Project. Warn if the file is >100KB or sibling files
  suggest a second weight in the same folder.
* Staged to: `public/fonts/projects/<slug>/<Family>.woff2` (rename on
  change — `public/` files aren't content-hashed, so version the filename
  instead of overwriting).
* Manifest: `font: { family, src: "/fonts/projects/<slug>/<Family>.woff2",
  fallback }`. The page injects one `@font-face` (`font-display: swap`)
  only while that Project page is mounted; body copy stays on system-ui.
* R2: never. Fonts are git-bound like covers.

## Video (cover only, 20-25MB, already compressed)

* `ffmpeg`/`ffprobe` are required — if missing and the Project has a video
  cover, the skill stops (the poster is load-bearing three times over:
  hero LCP image, Home/All-Projects thumbnail, reduced-motion fallback).
* Do NOT re-encode unless broken. Verify only:
  `ffprobe -v error -show_entries format_tags=major_brand -of default=noprint_wrappers=1 file.mp4`
  and moov position: `qt-faststart`-style check or
  `ffmpeg -v trace -i file.mp4 2>&1 | grep -i moov`.
* If moov atom is at end: `ffmpeg -i in.mp4 -c copy -movflags +faststart out.mp4`.
* Poster: `ffmpeg -ss <timestamp, default 0:01> -i clip.mp4 -frames:v 1 poster.jpg`,
  then run poster through the image pipeline (AVIF, local in
  `public/posters/<slug>/` per the promotion step above).
* Render: hero autoplays muted-loop (`playsInline`, poster-reserved layout)
  with pause + unmute toggles; reduced motion starts paused on the poster
  (see `HeroVideo`). There is no body-video kind — video exists only as cover.
* R2 upload: `--content-type video/mp4`. Range requests handle scrubbing;
  no HLS/Stream needed at this size.

## PDF (max 20MB, end-slot button)

* No conversion, no embed, no prefetch. `{ kind: 'pdf', href, label }`
  renders as the fixed end-spot button after outcome content (wherever
  authored), opening in a new tab (`target="_blank" rel="noreferrer"`).
  Button styling is still open — placement is fixed, look TBD.
* R2 upload: `--content-type application/pdf` **plus**
  `--content-disposition inline`:

```bash
wrangler r2 object put --remote noahhh-media/<slug>/doc.pdf --file=.media-tmp/<slug>/doc.pdf --content-type application/pdf --content-disposition inline --cache-control "public, max-age=31536000, immutable"
```

  Without the disposition flag the PDF downloads instead of opening in a
  new tab — the flag is load-bearing, not cosmetic.

## 3D

* Input `.glb` as-is. If >15MB, suggest Draco/meshopt but don't block.
* Standalone-only (pairing does not extend to 3D). Renders as a link
  placeholder until the viewer lands — collect the label + file like a PDF.

## R2 object conventions

Body media — plus a cover mp4 when the hero is video. Image covers,
posters, and fonts never go to R2:

```text
<slug>/<name>-1600.avif
<slug>/clip.mp4
<slug>/doc.pdf
<slug>/model.glb
```

Upload flags per object (every `wrangler r2 object put` takes `--remote` —
without it wrangler writes to local emulator storage while reporting
success, and the domain 404s):

```bash
--cache-control "public, max-age=31536000, immutable"
--content-type image/avif | image/webp | video/mp4 | application/pdf | model/gltf-binary
```

Stays free: whole portfolio (~10 projects x 50MB) < 1GB of 10GB R2 free tier.
