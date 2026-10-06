#!/usr/bin/env node
// Optimize Project images into AVIF+WebP variants for R2.
// Usage: node scripts/optimize-media.mjs --in <srcDir> --out .media-tmp/<slug> --cover <coverFile> [--font <fontFile>] [--base https://media.noahhh.com] [--slug <slug>]
// Dry-run friendly: reads sources, writes only into --out (gitignored).
// Video/PDF/GLB are passed through untouched; fonts are copied through
// untouched (no conversion — see media-playbook.md).

import { mkdirSync, readdirSync, statSync, copyFileSync, existsSync } from 'node:fs';
import { join, basename, extname, resolve } from 'node:path';

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.tif', '.tiff', '.webp']);
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm']);
const PASSTHROUGH_EXTS = new Set(['.mp4', '.mov', '.webm', '.pdf', '.glb', '.gltf']);
const FONT_EXTS = new Set(['.woff2', '.woff', '.ttf', '.otf']);
const WIDTHS = [800, 1600, 2400];
const FONT_WARN_BYTES = 100 * 1024;

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}

const inDir = resolve(arg('in') ?? '');
const outDir = resolve(arg('out') ?? '');
const coverFile = arg('cover', '');
const fontArg = arg('font', '');
const slug = arg('slug', basename(outDir));
const base = (arg('base', process.env.MEDIA_BASE ?? 'https://media.noahhh.com') ?? '').replace(/\/$/, '');

if (!inDir || !existsSync(inDir)) {
  console.error(`Missing --in directory: ${inDir}\nUsage: node scripts/optimize-media.mjs --in <srcDir> --out .media-tmp/<slug> --cover <coverFile>`);
  process.exit(1);
}
if (!outDir) {
  console.error('Missing --out directory.');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const entries = readdirSync(inDir).filter((f) => !f.startsWith('.'));
const images = entries.filter((f) => IMAGE_EXTS.has(extname(f).toLowerCase()));
const passthrough = entries.filter((f) => PASSTHROUGH_EXTS.has(extname(f).toLowerCase()));
const dirFonts = entries.filter((f) => FONT_EXTS.has(extname(f).toLowerCase()));
const skipped = entries.filter(
  (f) =>
    !IMAGE_EXTS.has(extname(f).toLowerCase()) &&
    !PASSTHROUGH_EXTS.has(extname(f).toLowerCase()) &&
    !FONT_EXTS.has(extname(f).toLowerCase()),
);

const manifest = { slug, base, cover: coverFile, font: null, fontFiles: [], outputs: [], passthrough: [], videos: [], skipped };

let sharp = null;
if (images.length > 0) {
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.error("sharp is not installed. Run: npm i -D sharp\nThen re-run this script. No files were written.");
    process.exit(2);
  }
}

for (const file of images) {
  const src = join(inDir, file);
  const stem = basename(file, extname(file)).replace(/\s+/g, '-').toLowerCase();
  const meta = await sharp(src).metadata();
  const srcW = meta.width ?? 0;
  const isCover = coverFile !== '' && basename(coverFile) === file;
  // Covers and posters are git-bound (public/posters/<slug>/) — never R2.
  // Covers are renamed to cover-<w> regardless of source stem so the
  // manifest path matches the promoted file exactly.
  const isPosterAsset = !isCover && /poster/i.test(file);
  const gitBound = isCover || isPosterAsset;
  // Covers only need 800/1600; body images get 2400 too if source allows.
  // Never queue widths above the source (sharp won't enlarge anyway).
  const useWidths = WIDTHS.filter((w) => w <= srcW);
  if (useWidths.length === 0 && srcW > 0) useWidths.push(srcW);
  const produced = [];
  for (const w of useWidths) {
    for (const fmt of ['avif', 'webp']) {
      const outName = isCover ? `cover-${w}.${fmt}` : `${stem}-${w}.${fmt}`;
      const out = join(outDir, outName);
      const pipeline = sharp(src).resize({ width: w, withoutEnlargement: true });
      if (fmt === 'avif') pipeline.avif({ quality: 50, effort: 4 });
      else pipeline.webp({ quality: 80 });
      await pipeline.toFile(out);
      const bytes = statSync(out).size;
      const url = gitBound ? `/posters/${slug}/${outName}` : `${base}/${slug}/${outName}`;
      produced.push({ file: outName, width: w, format: fmt, bytes, url });
    }
  }
  manifest.outputs.push({ source: file, srcWidth: srcW, srcHeight: meta.height ?? 0, cover: isCover, produced });
  console.log(`${isCover ? '[cover]' : '[img]  '} ${file} (${srcW}x${meta.height ?? 0}) -> ${produced.length} variants`);
}

for (const file of passthrough) {
  copyFileSync(join(inDir, file), join(outDir, file));
  const bytes = statSync(join(outDir, file)).size;
  manifest.passthrough.push({ file, bytes, url: `${base}/${slug}/${file}` });
  console.log(`[pass]  ${file} (${(bytes / 1048576).toFixed(1)}MB) copied untouched`);
  if (VIDEO_EXTS.has(extname(file).toLowerCase())) {
    // Poster check: the skill stops on missing posters (load-bearing for
    // <video poster>), so report presence per video, don't guess.
    const stem = basename(file, extname(file)).toLowerCase();
    const posterHit = entries.find(
      (f) =>
        IMAGE_EXTS.has(extname(f).toLowerCase()) &&
        (f.toLowerCase().startsWith(`${stem}-poster`) ||
          f.toLowerCase().startsWith(`${stem}.poster`) ||
          f.toLowerCase().startsWith('poster-') ||
          f.toLowerCase().startsWith('poster.')),
    );
    const status = posterHit ? `present (${posterHit})` : 'MISSING — stop, extract via ffmpeg (see media-playbook.md)';
    manifest.videos.push({ file, bytes, poster: posterHit ?? null });
    console.log(`[poster] ${file} -> ${status}`);
  }
}

// Fonts: copy through untouched (one weight per Project). --font may point
// anywhere; bare filenames in --in are picked up too.
const fontSources = [];
if (fontArg) {
  const resolved = resolve(fontArg);
  if (!existsSync(resolved)) {
    console.error(`Missing --font file: ${fontArg}\nPoint at an existing .woff2/.woff/.ttf/.otf file (no Google Fonts URLs).`);
    process.exit(1);
  }
  fontSources.push({ src: resolved, via: '--font' });
}
for (const file of dirFonts) fontSources.push({ src: join(inDir, file), via: '--in' });
if (fontSources.length > 1) {
  console.log(`[warn]  ${fontSources.length} font files — one weight per Project. Confirm which one wins.`);
}
for (const { src, via } of fontSources) {
  const file = basename(src);
  copyFileSync(src, join(outDir, file));
  const bytes = statSync(join(outDir, file)).size;
  const entry = { file, bytes, via, stagedest: `public/fonts/projects/${slug}/${file}` };
  manifest.fontFiles.push(entry);
  // First font wins the manifest slot; extras are staged but flagged.
  if (!manifest.font) manifest.font = entry;
  const warn = bytes > FONT_WARN_BYTES ? ' — over 100KB, consider a latin-subset woff2' : '';
  console.log(`[font]  ${file} (${(bytes / 1024).toFixed(0)}KB via ${via}) -> ${entry.stagedest}${warn}`);
}

for (const file of skipped) console.log(`[skip]  ${file} (unsupported extension)`);

const { writeFileSync } = await import('node:fs');
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`\nWrote ${manifest.outputs.length} images, ${manifest.passthrough.length} passthrough, ${fontSources.length} fonts -> ${outDir}/manifest.json`);
console.log('Dry-run safe: nothing uploaded. Upload with wrangler r2 object put (see SKILL.md step 5).');
