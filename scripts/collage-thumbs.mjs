#!/usr/bin/env node
// Homepage collage thumbnails (Home.tsx COLLAGE_PICKS): cells are ~25vw,
// so they use 480/720/960w AVIF + WebP in public/collage/ (git-bound,
// served by Pages) instead of the 1600w R2 files. Named
// <slug>-<name>-<w>.<ext> after the R2 image, which is what Home.tsx
// derives from each pick's src.
// Usage: node scripts/collage-thumbs.mjs --slug <slug> --names in-use,detail
// Reads the largest staged variant from .media-tmp/<slug>/<name>-<w>.avif.
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : (process.argv[i + 1] ?? fallback);
}
const slug = arg('slug', '');
const names = (arg('names', '') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
if (!slug || names.length === 0) {
  console.error('Usage: node scripts/collage-thumbs.mjs --slug <slug> --names name1,name2');
  process.exit(1);
}
const sharp = (await import('sharp')).default;
mkdirSync('public/collage', { recursive: true });
for (const name of names) {
  const src = [2400, 1600, 800].map((w) => join('.media-tmp', slug, `${name}-${w}.avif`)).find(existsSync);
  if (!src) {
    console.error(`[miss]  ${slug}/${name}: no staged .media-tmp/${slug}/${name}-<w>.avif — run media:optimize first`);
    process.exitCode = 1;
    continue;
  }
  for (const w of [480, 720, 960]) {
    const base = join('public/collage', `${slug}-${name}-${w}`);
    const img = sharp(src).resize(w);
    await img.clone().avif({ quality: 55, effort: 6 }).toFile(`${base}.avif`);
    await img.clone().webp({ quality: 76 }).toFile(`${base}.webp`);
    console.log(`[thumb] ${base}.avif/.webp (${(statSync(`${base}.avif`).size / 1024).toFixed(0)}KB avif)`);
  }
}
console.log('\nAdd each pick to COLLAGE_PICKS in src/pages/Home.tsx as its R2 1600w AVIF URL.');
