#!/usr/bin/env node
// Derived encodes for a Project's video cover (the hero mp4 itself ships
// untouched). Writes into the staging dir:
//   <name>-card-1080.mp4  Home card loop, desktop: hero minus first/last
//                          seconds, silent, H.264 High CRF 23, faststart
//   <name>-card-720.mp4   same loop at 720p for viewports under 1024px
//   <name>-720.mp4        720p hero with audio for phones (Project page)
//   <name>-card-poster-1600.webp / -800.webp
//                          first frame of the card loop (git-bound: promote
//                          to public/posters/<slug>/)
// CRF 23 measured VMAF ~95.7 against the source at 1080p (visually
// lossless); 720p is for small screens only.
// Usage: node scripts/encode-video.mjs --in <hero.mp4> --out .media-tmp/<slug> --name <stem> [--trim-start 2] [--trim-end 10]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : (process.argv[i + 1] ?? fallback);
}
const input = resolve(arg('in', ''));
const outDir = resolve(arg('out', ''));
const name = arg('name', '');
const trimStart = Number(arg('trim-start', '2'));
const trimEnd = Number(arg('trim-end', '10'));
if (!existsSync(input) || !arg('out') || !name) {
  console.error('Usage: node scripts/encode-video.mjs --in <hero.mp4> --out .media-tmp/<slug> --name <stem> [--trim-start 2] [--trim-end 10]');
  process.exit(1);
}
for (const bin of ['ffmpeg', 'ffprobe']) {
  try {
    execFileSync('sh', ['-c', `command -v ${bin}`], { stdio: 'ignore' });
  } catch {
    console.error(`${bin} is missing — install ffmpeg first (brew install ffmpeg). Nothing was written.`);
    process.exit(2);
  }
}
mkdirSync(outDir, { recursive: true });

const duration = Number(
  execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', input]).toString().trim(),
);
const loopLen = duration - trimStart - trimEnd;
if (!(loopLen > 3)) {
  console.error(`Clip is ${duration.toFixed(1)}s — too short for a ${trimStart}s/${trimEnd}s trim. Pass smaller --trim-start/--trim-end.`);
  process.exit(1);
}

const x264 = ['-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];
const jobs = [
  { file: `${name}-card-1080.mp4`, pre: ['-ss', String(trimStart)], post: ['-t', loopLen.toFixed(2), '-an', '-vf', 'scale=-2:1080:flags=lanczos'] },
  { file: `${name}-card-720.mp4`, pre: ['-ss', String(trimStart)], post: ['-t', loopLen.toFixed(2), '-an', '-vf', 'scale=-2:720:flags=lanczos'] },
  { file: `${name}-720.mp4`, pre: [], post: ['-vf', 'scale=-2:720:flags=lanczos', '-c:a', 'aac', '-b:a', '96k'] },
];
for (const j of jobs) {
  const out = join(outDir, j.file);
  console.log(`[enc]   ${j.file} …`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...j.pre, '-i', input, ...j.post, ...x264, out], { stdio: 'inherit' });
  console.log(`        ${(statSync(out).size / 1048576).toFixed(1)}MB`);
}

// Card posters: the loop's first frame, so the poster→video handoff
// doesn't jump. WebP (decodes everywhere, incl. iOS ≤15).
const frame = join(outDir, `${name}-card-frame.png`);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', join(outDir, `${name}-card-1080.mp4`), '-frames:v', '1', frame]);
const sharp = (await import('sharp')).default;
for (const w of [1600, 800]) {
  const out = join(outDir, `${name}-card-poster-${w}.webp`);
  await sharp(frame).resize(w).webp({ quality: 78 }).toFile(out);
  console.log(`[poster] ${name}-card-poster-${w}.webp (${(statSync(out).size / 1024).toFixed(0)}KB) → promote to public/posters/<slug>/`);
}
unlinkSync(frame);
console.log(`\nLoop: ${trimStart}s → ${(duration - trimEnd).toFixed(1)}s of ${duration.toFixed(1)}s. Upload the three mp4s to R2 (see media:upload-plan).`);
