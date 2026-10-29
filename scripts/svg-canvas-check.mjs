#!/usr/bin/env node
// Render every staged SVG for one Project on the canvas it will actually
// sit on: the light colour under a light scheme and the dark colour under a
// dark scheme (so SVGs already themed by theme-svg.mjs show their swap).
// Line art that vanishes on one side gets fixed with theme-svg.mjs.
// Usage: node scripts/svg-canvas-check.mjs --slug <slug> --light <#hex> --dark <#hex>
// Writes .media-tmp/<slug>/svg-check.png (gitignored, never uploaded) and
// prints each file's black/white paint counts outside <mask> as a hint.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? '' : process.argv[i + 1];
};
const slug = arg('slug');
const canvas = { light: arg('light'), dark: arg('dark') };
if (!slug || !/^#[0-9a-f]{6}$/i.test(canvas.light) || !/^#[0-9a-f]{6}$/i.test(canvas.dark)) {
  console.error('Usage: node scripts/svg-canvas-check.mjs --slug <slug> --light <#hex> --dark <#hex>');
  process.exit(1);
}
const dir = path.resolve('.media-tmp', slug);
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.svg')).sort() : [];
if (files.length === 0) {
  console.log(`No SVGs staged in .media-tmp/${slug} — nothing to check.`);
  process.exit(0);
}

for (const f of files) {
  const raw = fs.readFileSync(path.join(dir, f), 'utf8');
  const svg = raw.replace(/<(mask|style)\b[\s\S]*?<\/\1>/g, '');
  const count = (c) => (svg.match(new RegExp(`(fill|stroke)="${c}"`, 'g')) ?? []).length;
  const themed = raw.includes('prefers-color-scheme') ? '  (themed)' : '';
  console.log(`${f}: black×${count('black')} white×${count('white')}${themed}`);
}

const browser = await chromium.launch();
const shots = [];
for (const scheme of ['light', 'dark']) {
  const rows = files
    .map(
      (f) =>
        `<p>${f} — ${scheme} page</p><div style="background:${canvas[scheme]}"><img src="${f}"></div>`,
    )
    .join('');
  const html = path.join(dir, `.svg-check-${scheme}.html`);
  fs.writeFileSync(
    html,
    `<style>body{margin:0;width:600px;font:12px system-ui;background:#888}p{margin:8px 8px 4px}div{padding:16px;display:flex;justify-content:center}img{max-width:100%;max-height:320px}</style>${rows}`,
  );
  const page = await browser.newPage({ viewport: { width: 600, height: 400 }, colorScheme: scheme });
  await page.goto(`file://${html}`);
  await page.waitForLoadState('load');
  shots.push(await page.screenshot({ fullPage: true }));
  fs.rmSync(html);
}
await browser.close();

const [a, b] = await Promise.all(shots.map((s) => sharp(s).metadata()));
const out = path.join(dir, 'svg-check.png');
await sharp({
  create: { width: a.width + b.width, height: Math.max(a.height, b.height), channels: 3, background: '#888' },
})
  .composite([
    { input: shots[0], left: 0, top: 0 },
    { input: shots[1], left: a.width, top: 0 },
  ])
  .png()
  .toFile(out);
console.log(`\n${files.length} SVGs → ${path.relative(process.cwd(), out)} (left: light page, right: dark page)`);
