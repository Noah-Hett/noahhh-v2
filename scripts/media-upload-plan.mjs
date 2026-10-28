#!/usr/bin/env node
// Prints (never runs) the R2 upload commands for one Project: every staged
// file that belongs on R2 — every width AND format of every body image
// (the page serves AVIF with a WebP fallback at 800/1600/2400), the hero
// mp4 + derived encodes, PDFs, GLBs. Skips git-bound files (covers,
// posters, fonts, collage) and anything already live on media.noahhh.com.
// Usage: node scripts/media-upload-plan.mjs --slug <slug>
import { readdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const i = process.argv.indexOf('--slug');
const slug = i === -1 ? '' : process.argv[i + 1];
if (!slug) {
  console.error('Usage: node scripts/media-upload-plan.mjs --slug <slug>');
  process.exit(1);
}
const TYPES = {
  '.avif': 'image/avif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.glb': 'model/gltf-binary',
  '.svg': 'image/svg+xml',
};
const dir = join('.media-tmp', slug);
const files = readdirSync(dir).filter((f) => {
  if (!TYPES[extname(f).toLowerCase()]) return false; // manifest, fonts, frames
  return !/^cover-|poster/i.test(f); // git-bound: public/posters/<slug>/
});
const pending = [];
for (const f of files) {
  const res = await fetch(`https://media.noahhh.com/${slug}/${f}`, { method: 'HEAD' }).catch(() => null);
  if (res?.status !== 200) pending.push(f);
}
console.log(`# ${pending.length} of ${files.length} R2 files for ${slug} still to upload (rest already live)`);
for (const f of pending) {
  const ext = extname(f).toLowerCase();
  const disp = ext === '.pdf' ? ' --content-disposition inline' : '';
  console.log(
    `npx wrangler r2 object put --remote "noahhh-media/${slug}/${f}" --file="${dir}/${f}" --content-type ${TYPES[ext]}${disp} --cache-control "public, max-age=31536000, immutable"`,
  );
}
if (pending.length) console.log('# then: npm run media:check');
