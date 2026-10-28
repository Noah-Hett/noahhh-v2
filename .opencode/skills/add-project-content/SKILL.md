---
name: add-project-content
description: "Add a new Project dataset or update an existing one: conversational intake, optimize images/cover video locally, dry-run manifest + R2 upload plan. Use when user says add project, update project, new project content, or points to a folder of files."
disable-model-invocation: false
---

# Add Project Content

Conversational skill for adding one Project's dataset to this site, or
updating an existing one.
Harness-agnostic: works from OpenCode (`/add-project-content`), Claude Code,
Codex, or a plain "follow .opencode/skills/add-project-content/SKILL.md" prompt.

Content model: `src/content/projects.ts` is the single source of truth
(ADR-0002). Home "Selected" = `selected === true` (exactly 3).
Heavy files are linked, never bundled (ADR-0003).

A Project entry (`src/content/projects.ts` — canonical types `ProjectColors`,
`ProjectFont`, `ProjectCover` (image | video union), `ProjectCollaborator`,
`ProjectMeta`, `ChallengeGroup`, `BodyGroup`, `ProjectBlock`) is:

```ts
Project {
  slug; title; tags; selected: boolean;
  colors: { light: string; dark: string };       // pasted hexes, flip rule
  font: { family: string; src: string; fallback?: string }; // local, one weight
  cover: { kind: 'image'; src; alt; width; height; srcSet? } // local poster path
       | { kind: 'video'; src; srcMobile; poster; alt; width; height;
           card: { src; srcMobile; poster; posterMobile } }; // R2 mp4s + local posters
  groups: [
    ChallengeGroup { id: 'challenge', heading, summary, meta, blocks }, // challenge summary + date/scope/role/collabs live here
    BodyGroup { id: 'process' | 'outcome', heading, blocks },            // exactly one challenge per Project
  ];
}
ProjectBlock =
  | text { body; for? }            // for: generated pairing ref, never hand-written
  | image { id?; src; alt; width; height }
  | gallery { images[]; caption? } // trailing caption, dims required
  | showcase { image; body; strip? } // outcome shape: wide visual + copy + optional strip
  | pdf { href; label }            // lifted to the fixed end-slot button
  | model3d { src; label };        // standalone-only
```

## Hard rules (never break these)

1. **Dry-run only.** Never run `wrangler r2 object put`, never push to R2,
   never commit large originals. End with printable upload commands
   (`npm run media:upload-plan`), and say that `npm run media:check` must
   pass after the user uploads and **before** anything is pushed — the
   page references every variant, so deploying first breaks images.
2. **One cover — image local, video split.** An image cover is served from
   its local path only (~150KB AVIF/WebP in `public/posters/<slug>/`). A video cover is an
   R2 mp4 plus a local poster; the poster is load-bearing three times over
   (hero LCP, card thumbnail, reduced-motion fallback). Never point an image
   cover at R2, PDF, or full-res original. The cover has no group, but its
   `alt` is still required (blocking, like all alts).
3. **Colours are pasted, never invented.** Accept two `#rrggbb` hexes from the
   user, validate the format, warn on low contrast — never block on contrast
   (contrast is author-owned, workshopped before it reaches the user).
4. **Fonts are local, one weight.** Accept a user-pointed file (`.woff2`
   preferred, `.woff`/`.ttf`/`.otf` copied through as-is). Reject Google Fonts
   URLs — download the file first, then point at it. Stage to
   `public/fonts/projects/<slug>/`, never R2. Colours and fonts originate
   ONLY from `projects.ts` (tokens.css exception).
5. **No silent `selected: true`.** Read `src/content/projects.ts`, count
   existing `selected`. If adding a 4th, ask which one it replaces.
6. **Alts are blocking.** Every visual needs user-confirmed `alt`: solo
   images, gallery items, strip and showcase visuals, and the cover.
   Suggest from filename, require explicit confirm.
7. **ffmpeg is blocking for cover video.** If `ffmpeg`/`ffprobe` is missing
   and the Project has a video cover, stop — the poster frame is
   load-bearing three times over (hero LCP, card thumbnail, reduced-motion
   fallback), and the derived encodes (`npm run media:video`: Home card
   loops at 1080p/720p, 720p phone hero) are required, not optional — the
   full hero file on a card streams 20MB+ per visitor. Never re-encode the
   hero mp4 itself. Body video does not exist: video lives only as cover.
8. **Staging is gitignored.** Optimize into `.media-tmp/<slug>/`, never into
   `public/` directly. Originals stay where the user put them.
9. **Edits never clobber.** On update, print the current entry first and
   confirm per field (keep/change). Never overwrite workshopped
   colours/fonts unless explicitly re-supplied.
10. **Every image ships AVIF + WebP at every width.** The site serves
    AVIF with a WebP fallback (iOS ≤15 can't decode AVIF) and picks the
    width per screen, so every produced variant must exist: body images
    on R2 (all of them — not just 1600w AVIF), covers/posters/collage in
    `public/` with a same-named `.webp` beside each `.avif`.
11. **Regenerate the variants map after optimizing.**
    `npm run media:variants` rewrites `src/content/mediaVariants.ts` from
    the manifests; it is how Project pages know each image's sizes.
    Commit it with the entry. Skipping it silently serves 1600w AVIF only.

## Workflow

### 0. Load context (small first)

Read `src/content/projects.ts` (types + current `selected` count),
`src/components/blocks/renderItems.tsx` (render contract: pair rows,
gallery figure, showcase, end-slot PDF, standalone 3D) and
`src/components/ProjectLayout.tsx` (challenge section with intro row,
hero cover, title font).
Load `references/` files only when you reach the step
that needs them. For updates, also read the existing entry for the slug.

### 1. Intake — one question at a time

Follow `references/intake-questions.md` in order. Do not batch questions.
For new Projects, start at Q1. For updates, start at Q0 (resolve slug,
print the current entry, confirm keep/change per field).
Accept any source location (`~/Downloads/`, `_incoming/`, loose files).
Normalize internally to staging shape:

```text
_incoming/<slug>/  (or wherever the user pointed)
  cover.jpg
  bench.jpg
  clip.mp4
  report.pdf
```

Confirm back: slug (lowercase-hyphen), title, tags, challenge summary, file count,
cover branch (image file + alt, or mp4 + poster timestamp + alt), colours
pair, font file, meta (date/scope/role/collaborators — all land in the
challenge). No groups, no order yet — both come out of the assembly walk.

### 2. Inventory — read-only, present table

List every non-cover file with bytes + dims (no writes, no placement):

```text
| # | file | bytes | dims |
```

Plus separate rows for font file and colours (no bytes/dims — `n/a`).
State total size. Filenames stay as-is; order here is meaningless.

Load `references/media-playbook.md` from here on.

Assembly preview: after inventory, sketch the likely walk (pair candidates
by filename affinity, gallery/strip groupings) so the user can correct
before Q8 — never lock compositions without confirmation. The proceed
gate lives in intake Q10 — do not optimize until it passes.

### 3. Optimize locally

Run `node scripts/optimize-media.mjs --in <srcDir> --out .media-tmp/<slug> --cover <coverFile> [--font <fontFile>] [--slug <slug>] [--base <mediaBase>]`.
If `sharp` is missing, run `npm i -D sharp` first (or report + stop if
offline). For a video cover, verify `ffmpeg`/`ffprobe` first
(`command -v ffmpeg ffprobe`) — missing → stop before optimizing (rule 7),
then verify `faststart` and extract the poster frame — do not
re-encode 20-25MB files unless moov atom is at end. PDFs/GLBs/fonts: copy
through untouched (original filenames).

For a video cover, then run
`npm run media:video -- --in <hero.mp4> --out .media-tmp/<slug> --name <stem> [--trim-start 2] [--trim-end 10]`
(trim = the card loop skips the hero's first/last seconds; confirmed at
intake Q6). It writes `<stem>-card-1080.mp4`, `<stem>-card-720.mp4`,
`<stem>-720.mp4` and the card posters `<stem>-card-poster-1600/800.webp`.

Then always run `npm run media:variants` (rule 11). If the user picked
collage photos at Q6, run
`npm run media:collage -- --slug <slug> --names <name1>,<name2>` and add
each pick's R2 1600w AVIF URL to `COLLAGE_PICKS` in `src/pages/Home.tsx`
(finished-work photos only — no process graphics, renders or CAD).

Report what was produced: per-image AVIF+WebP (body 800/1600/2400w, cover
800/1600/2400 where the source allows), cover variants, poster file + size
(or "poster: missing" — stop, posters are triple-load-bearing; extract via
`ffmpeg`, rule 7), derived video sizes, font staged file + size. Record
every image's source dims — the manifest draft needs them transcribed
into solo, gallery, strip, and showcase visuals.

### 4. Manifest patch — diff first, validate, apply on approval

Draft the new `Project` entry: `cover` (image path + `srcSet` of every
promoted width, or video: hero mp4 `src`, `srcMobile` = `<stem>-720.mp4`,
`poster`, and `card: { src: <stem>-card-1080.mp4, srcMobile:
<stem>-card-720.mp4, poster: /posters/<slug>/<stem>-card-poster-1600.webp,
posterMobile: …-800.webp }` — all with dims), `colors`, `font` (staged
`public/fonts/projects/<slug>/...` path), challenge group (challenge
`summary`
+ `meta` with auto-derived initials unless overridden), body groups from
the assembly walk — `for`/`id` generated from filenames (never hand-written),
gallery `caption` + dims on every item, showcase `{ image, body, strip? }`,
pdf `{ href, label }` (renders end-slot), with
`https://media.noahhh.com/<slug>/...` URLs per playbook. For updates,
diff against the existing entry — changed fields only. Show the diff.

Then run `validateProject()` on the drafted entry — blocking. Duplicates,
dangling references, and missing-challenge must detonate here, never on
the live page. Fix everything it reports, re-show the diff, then apply to
`src/content/projects.ts` only after explicit "apply".

Preserve render contract: images carry `width`/`height` everywhere
(solo, gallery, strip, showcase, hero). Empty process/outcome groups render
nothing; the challenge section always renders its intro row.

### 5. Upload plan — pre-publish checklist, then print, don't execute

Before printing a single command, verify publishing is possible (two
minutes, catches the 404-class mistakes):

1. `npx wrangler whoami` succeeds (CLI logged in — `npx wrangler login`
   if not; wrangler is fetched on demand, not vendored).
2. Bucket `noahhh-media` exists (`npx wrangler r2 bucket list`, or R2
   dashboard). Create once if missing — never rename around it.
3. Custom domain `media.noahhh.com` shows Active on the bucket
   (dashboard → R2 → bucket → Settings → Custom Domains). Every printed
   URL depends on it.

Stop the run if any check fails — say which one, not just "publishing
is broken".

Output three sections, in this order — uploads land before the push.

1. R2 objects: run `npm run media:upload-plan -- --slug <slug>` and print
   its output verbatim. It lists every staged R2 file still missing from
   `media.noahhh.com` (all widths and both formats of every body image,
   the hero mp4 and its derived encodes, PDFs, GLBs) with the right
   `--content-type`, `--remote` (load-bearing: without it wrangler writes
   to local emulator storage while reporting success) and, for PDFs,
   `--content-disposition inline`. Never hand-write this list — a
   hand-picked list is how only the 1600w AVIFs once reached R2.
2. Verify: `npm run media:check` — must print `OK` before pushing. It
   HEAD-checks every R2 URL the site references and that every local
   poster/collage/font file (and each `.avif`'s `.webp` twin) exists.
3. Git files (commit these with the entry and `mediaVariants.ts`):

```bash
git add public/posters/<slug>/ public/fonts/projects/<slug>/ public/collage/ src/content/mediaVariants.ts src/content/projects.ts
npm run build
```

End with: "Dry-run complete. Run the uploads, then `npm run media:check`,
then commit and push." Never commit `.media-tmp/` or originals.
