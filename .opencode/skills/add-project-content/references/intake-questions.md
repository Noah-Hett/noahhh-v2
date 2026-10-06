# Intake Questions — ask in order, one at a time

Do not batch. Wait for each answer before asking the next.
Accept any folder layout; normalize internally. Filenames need only be
recognizable ("the clock one") — never ask the user to rename or order
files beforehand. Order, pairing, and references all come out of the
assembly walk (Q8), never out of filenames.

## 0. New or update (edits only — skip for new Projects)

> "New Project, or update an existing one? If update, which slug?"

For updates: read `src/content/projects.ts`, print the current entry for
the slug, then go field by field — "keep or change?" for title, tags,
challenge (summary + date/scope/role/collaborators), colours, font, cover,
groups, media. Only changed fields go through the questions below;
untouched fields (especially workshopped colours/fonts) carry over
verbatim. Media additions rejoin at Q7. Block/group removal is always
explicit ("remove X?") — never inferred.

## 1. Location

> "Where are the files? Give me a folder path (e.g. `~/Downloads/my-shoot/`
> or `_incoming/my-slug/`) or list the files."

Accept: absolute path, repo-relative path, or pasted file list.
Resolve to a real directory with `ls` before continuing. If missing, stop
and ask again — never guess filenames.

## 2. Identity + challenge summary

> "What slug should this use? Lowercase-hyphen, e.g. `harbour-light`."

Then, in the same turn once slug is confirmed:

> "Title, tags (comma-separated, can be empty — reserved for future
> filtering, shown nowhere today), and the challenge summary — one or two
> sentences. The summary opens the page beside the date, and doubles as the
> Home card description, so make it count."

The challenge summary renders in the intro row, not in any group. Longer
thinking lives in process copy (prompted at Q8).

## 3. Meta (lands in the challenge)

One question at a time, in this order:

> "Date? Month + year, e.g. `March 2024`."

> "Scope? What was made (one line)."

> "Role? Your responsibility (one line)."

> "Collaborators? One answer: `Name, url` pairs separated by `;` or newlines
> (e.g. `Mara Chen, https://linkedin.com/in/marachen; Jo Okafor, https://linkedin.com/in/jookafor`).
> Empty if solo. Initials auto-derive unless you override with `Name (Initials), url`."

## 4. Colours

> "Paste the light + dark hex pair, e.g. `#E8E2D9 / #1E2A32`."

Validate `#rrggbb` format; ask again on mismatch. Warn (never block) on
low contrast — contrast is author-owned, workshopped before it reaches
the user. Never invent hexes. Confirm back the flip rule:
"Light mode → light bg / dark text, dark mode → flipped."

## 5. Font

> "Point at the display font file (`.woff2` preferred, `.woff`/`.ttf`/`.otf`
> accepted as-is, one weight only)."

Must resolve to exactly one existing file. No Google Fonts URLs — download
the file first, then point at it. Warn if the file is >100KB or the
filename suggests a second weight in the same folder; if multiple weights
surface, ask which one wins before drafting. Confirm back:
"`<file>` → stages to `public/fonts/projects/<slug>/`, title only."

## 6. Cover — image or video

> "Still image or video hero?"

For an image cover:

> "Which file is the ONE homepage cover?"

Must resolve to exactly one image file. The cover has no group — it is
the hero + card thumbnail. Then:

> "Alt text for the cover? (What is actually in the frame — I suggest one
> from the filename, you confirm or rewrite.)"

Confirm back:
"Cover = `<file>` → will ship as local ~150KB AVIF, Home loads only this."

For a video cover:

> "Which mp4 is the hero? Poster timestamp (default 0:01)? Alt text?"

The mp4 lives on R2; its poster is local and load-bearing three times
over — hero LCP image, Home/All-Projects thumbnail, and reduced-motion
fallback. If `ffmpeg`/`ffprobe` is missing, stop here (rule 7). Confirm
back: "`<file>` → R2 mp4 + local poster; page autoplays muted-loop with
pause + unmute."

## 7. Inventory — read-only, no placement yet

List every non-cover file with bytes + dims (no writes, no groups, no
order — placement happens at Q8):

```text
| # | file | bytes | dims |
```

Plus separate rows for font file and colours (bytes/dims `n/a`).
State total size. Filenames stay as-is; order here is meaningless.

## 8. Assembly walk — top to bottom, one position at a time

Walk the page in render order: challenge (usually skip — summary + meta are
already placed), then process, then outcome. Display order decided here IS
the render order — it also drives pair alternation, so show the running
pair count as you go ("this lands copy-right, pair 2 of 3 so far").

At each position, ask what goes here and follow exactly one branch:

**Solo text** → prompt for the paragraph (never invent copy). One
paragraph per Block.

**Solo visual** → confirm alt (blocking, suggest-from-filename rule).

**Pair** → prompt for the paragraph, then "which visual goes with it?"
(`for`/`id` are generated from the filename invisibly — the user never
sees them). Confirm the alternation side from the running count.

**Gallery** → "which files belong to it?" (claimed as a set — members can
never mis-pair), then prompt for the trailing caption. Any count works;
rebalancing is automatic (4 renders as a quartet, 7 as 3+4).

**Showcase** (outcome only, usually) → main visual, then body copy prompt,
then "detail strip? which files?" (or skip — the strip is optional).

**PDF** → "Link label? (e.g. `Full report`.)" Renders as the fixed end-spot
button after outcome, wherever authored — say so when confirming.

**3D model** → "Label? (e.g. `Interactive massing model`.)" Standalone-only;
pairing does not extend to 3D.

Rules while walking:
- Never invent copy or alts. Never proceed with missing alts.
- Gallery / showcase / strip members are claimed as sets and excluded
  from pairing candidates.
- Group headings default to Challenge / Process / Outcome but are editable
  per Project — accept a rename ("call it `Making` instead of `Process`?")
  and record it.

## 9. Selected flag

Read `src/content/projects.ts`, count `selected === true`.

> "This Project as Selected? There are currently N/3 Selected (<slugs>).
> If yes, which one does it replace?"

Never exceed 3 without an explicit replacement.

## 10. Validate gate (blocking) + proceed

Draft the entry, then run `validateProject()` on it before showing
anything — duplicates, dangling references, and missing-challenge must
detonate here, never on the live page. Fix everything it reports, then
present the inventory table with composition roles:

```text
| # | file | bytes | dims | section | role (pair/gallery/showcase/solo) |
```

Plus font row and colours row (bytes/dims `n/a`), and:

> "Proceed with optimize? (Local staging only, no uploads.)"

Only after yes → run `scripts/optimize-media.mjs`.
Only after optimize report → show manifest diff → "Apply?"
Only after apply → promote cover/posters/fonts to `public/` →
print git + R2 commands → "Dry-run complete."
