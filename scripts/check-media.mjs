#!/usr/bin/env node
// Pre-deploy guard: every media URL the site references must exist.
//  - each https://media.noahhh.com/... URL in projects.ts, Home.tsx and
//    mediaVariants.ts answers 200 (HEAD)
//  - each /posters/, /fonts/, /portrait/, /collage/ path exists in public/
//  - each AVIF poster/collage file has its .webp twin (no-AVIF fallback)
// Exit 1 on any miss. Run after uploads, before pushing.
// Usage: node scripts/check-media.mjs
import { existsSync, readFileSync } from 'node:fs';

const sources = ['src/content/projects.ts', 'src/content/mediaVariants.ts', 'src/pages/Home.tsx'];
const text = sources.map((f) => readFileSync(f, 'utf8')).join('\n');
const remote = [...new Set([...text.matchAll(/https:\/\/media\.noahhh\.com\/[^'"`\s)]+/g)].map((m) => m[0]))];
// Quoted paths, including srcset strings ("a.avif 800w, b.avif 1600w").
const local = [
  ...new Set(
    [...text.matchAll(/['"](\/(?:posters|fonts|portrait|collage)\/[^'"]+)['"]/g)].flatMap((m) =>
      m[1].split(',').map((part) => part.trim().split(/\s+/)[0]),
    ),
  ),
];

// Collage thumbs are derived in Home.tsx from each COLLAGE_PICKS src
// (<slug>-<name>-<w>.<ext>), so derive the same paths here.
const home = readFileSync('src/pages/Home.tsx', 'utf8');
const picks = home.slice(home.indexOf('COLLAGE_PICKS'), home.indexOf('];', home.indexOf('COLLAGE_PICKS')));
for (const m of picks.matchAll(/media\.noahhh\.com\/([^/]+)\/(.+?)-1600\.avif/g))
  for (const w of [480, 720, 960]) for (const ext of ['avif', 'webp']) local.push(`/collage/${m[1]}-${m[2]}-${w}.${ext}`);

const misses = [];
await Promise.all(
  remote.map(async (u) => {
    const r = await fetch(u, { method: 'HEAD' }).catch(() => null);
    if (r?.status !== 200) misses.push(`${r?.status ?? 'ERR'} ${u}`);
  }),
);
for (const p of local) {
  const f = `public${p}`;
  if (!existsSync(f)) misses.push(`missing ${f}`);
  else if (f.endsWith('.avif') && /\/(posters|collage)\//.test(f) && !existsSync(f.replace(/\.avif$/, '.webp')))
    misses.push(`no .webp twin for ${f}`);
}
if (misses.length) {
  console.error(`${misses.length} problem(s):\n` + misses.sort().join('\n'));
  process.exit(1);
}
console.log(`OK: ${remote.length} R2 URLs live, ${local.length} public files present.`);
