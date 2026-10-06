// Hero layout check: screenshots + geometry at Figma frame sizes.
// Viewports mirror Figma: 1512x857 (95:206), 1354x857 (95:236),
// 834x1194 (82:175 iPad), 390x844 (82:177 iPhone).
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

const BASE = process.env.BASE_URL || 'http://localhost:4173/';
const cases = [
  { name: 'desktop-1512x857', width: 1512, height: 857 },
  { name: 'desktop-1354x857', width: 1354, height: 857 },
  { name: 'ipad-834x1194', width: 834, height: 1194 },
  { name: 'iphone-390x844', width: 390, height: 844 },
];

const browser = await chromium.launch();
try {
  for (const c of cases) {
    const page = await browser.newPage({ viewport: { width: c.width, height: c.height } });
    // Kill motion: DotGrid canvas + parallax + header transitions vary pixels.
    await page.addInitScript(() => {
      window.matchMedia = (q) => ({
        matches: q.includes('reduce') ? true : false,
        media: q,
        addEventListener() {}, removeEventListener() {},
        addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false,
      });
    });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForSelector('.hero-photo', { timeout: 10000 });
    await page.waitForTimeout(600);
    const geom = await page.evaluate(() => {
      const r = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), bottom: Math.round(b.bottom) };
      };
      return {
        viewport: { w: window.innerWidth, h: window.innerHeight },
        hero: r('.hero'), copy: r('.hero-copy'), art: r('.hero-art'),
        photo: r('.hero-photo'), header: r('.site-header'),
      };
    });
    console.log(`--- ${c.name} ---`);
    console.log(JSON.stringify(geom));
    await page.screenshot({ path: path.join(dir, `${c.name}.png`) });
    await page.close();
  }
} finally {
  await browser.close();
}
