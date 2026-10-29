#!/usr/bin/env node
// Make one line-art SVG follow the page's colour scheme by embedding a
// prefers-color-scheme <style> that swaps its paint colours. Works through
// <img> (the site's dark mode is system-only, so the SVG's own media query
// always matches the page). Opt-in per file: only run it on art that
// disappears on one of the Project's canvases.
// Usage: node scripts/theme-svg.mjs --slug <slug> <file.svg|R2 url>
//          [--dark <swap>...] [--light <swap>...]
//   swap = [fill:|stroke:]<from>=<to>, matched against the exact attribute
//   value Figma exported, e.g. --dark black=white --light stroke:white=black
// A file staged in .media-tmp/<slug>/ and not yet on R2 is rewritten in
// place. Anything already live is written to <stem>-themed.svg instead (R2
// serves SVGs as immutable, so overwriting the old URL would never reach
// cached visitors) — point projects.ts at that URL.
// Then: npm run media:upload-plan -- --slug <slug>. <mask> contents are left alone (their black/white is
// coverage, not colour).
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
let slug = '';
let src = '';
const swaps = { dark: [], light: [] };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--slug') slug = args[++i];
  else if (a === '--dark' || a === '--light') swaps[a.slice(2)].push(args[++i]);
  else src = a;
}
if (!slug || !src || swaps.dark.length + swaps.light.length === 0) {
  console.error(
    'Usage: node scripts/theme-svg.mjs --slug <slug> <file.svg|url> [--dark black=white] [--light stroke:white=black]',
  );
  process.exit(1);
}

const svg = /^https?:/.test(src) ? await (await fetch(src)).text() : fs.readFileSync(src, 'utf8');
if (svg.includes('prefers-color-scheme')) {
  console.error(`${src} is already themed`);
  process.exit(1);
}

const rules = (list) =>
  list
    .flatMap((swap) => {
      const m = swap.match(/^(?:(fill|stroke):)?([^=]+)=(.+)$/);
      if (!m) throw new Error(`Bad swap "${swap}" (want [fill:|stroke:]from=to)`);
      const [, prop, from, to] = m;
      return (prop ? [prop] : ['fill', 'stroke']).map(
        (p) => `[${p}="${from}"]:not(mask):not(mask *){${p}:${to}}`,
      );
    })
    .join('');
const css = (['dark', 'light'])
  .filter((mode) => swaps[mode].length)
  .map((mode) => `@media (prefers-color-scheme:${mode}){${rules(swaps[mode])}}`)
  .join('');

const open = svg.match(/<svg\b[^>]*>/);
if (!open) throw new Error(`${src} has no <svg> tag`);
const at = open.index + open[0].length;
const out = `${svg.slice(0, at)}\n<style>${css}</style>${svg.slice(at)}`;

// A staged file that isn't on R2 yet is themed in place (keeps its name);
// anything already live gets a new -themed name.
const stem = path.basename(new URL(src, 'file:///').pathname, '.svg');
const dir = path.join('.media-tmp', slug);
const live = await fetch(`https://media.noahhh.com/${slug}/${stem}.svg`, { method: 'HEAD' })
  .then((r) => r.status === 200)
  .catch(() => true);
const inPlace = !/^https?:/.test(src) && path.resolve(path.dirname(src)) === path.resolve(dir) && !live;
const name = inPlace ? `${stem}.svg` : `${stem}-themed.svg`;
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, name);
fs.writeFileSync(file, out);
console.log(`${file}  →  https://media.noahhh.com/${slug}/${name}${inPlace ? '  (themed in place)' : ''}`);
