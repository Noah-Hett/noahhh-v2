// MorphWord — the footer word engine. Single copy lives here (it was
// prototyped in experiments, now removed). Cursor proximity ripples
// letters toward the next font, click fires a shockwave that lands on the
// next font and rotates the cycle, idle 10s triggers one ambient sweep.
// Owns its rAF loop — it self-parks after ~1s idle and wakes for the
// ambient sweep, but still call stop() when offscreen (sweep timing is
// wall-clock) and destroy() on unmount.
import { contourInterpolate } from './geom.ts';
import type { Font, Path } from 'opentype.js';

export interface MorphFont {
  font: Font;
  label: string;
  color: string;
}

export interface MorphWordOptions {
  text?: string;
  fonts?: MorphFont[];
  cycle?: number[];
  tightness?: number;
  speed?: number;
  pad?: number;
}

const BASE = 200;
const TARGET_H = 200;
const SVG_NS = 'http://www.w3.org/2000/svg';

// Shockwave + sweep physics (tuned — don't fiddle without re-feeling it).
const SHOCK_DUR = 1350;
const SHOCK_WIDTH = 0.45;
const SHOCK_DELAY_SPREAD = 0.55;
const SWEEP_IDLE_MS = 10000;
const SWEEP_DUR = 2100;
// Park the rAF loop after this many fully-idle frames (~1s at 60fps).
const IDLE_PARK_FRAMES = 60;
// Layout reads are cached this long — one getBoundingClientRect per frame max.
const RECT_CACHE_MS = 64;

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function wordPaths(font: Font, text: string, size: number, ox = 0, oy = 0): Path[] {
  const paths: Path[] = [];
  let x = 0;
  for (const ch of text) {
    if (ch.trim()) {
      const p = font.getPath(ch, x + ox, oy, size);
      if (p.commands.length) paths.push(p);
    }
    x += font.getAdvanceWidth(ch, size);
  }
  return paths;
}

function measureWidth(font: Font, text: string): number {
  const probe = wordPaths(font, text, BASE);
  if (!probe.length) return 10;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const p of probe) {
    const b = p.getBoundingBox();
    x1 = Math.min(x1, b.x1); y1 = Math.min(y1, b.y1);
    x2 = Math.max(x2, b.x2); y2 = Math.max(y2, b.y2);
  }
  const s = TARGET_H / ((y2 - y1) || 1);
  return (x2 - x1) * s;
}

function buildWord(font: Font, text: string): { paths: Path[]; w: number } {
  const probe = wordPaths(font, text, BASE);
  if (!probe.length) return { paths: [], w: 10 };
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const p of probe) {
    const b = p.getBoundingBox();
    x1 = Math.min(x1, b.x1); y1 = Math.min(y1, b.y1);
    x2 = Math.max(x2, b.x2); y2 = Math.max(y2, b.y2);
  }
  const s = TARGET_H / ((y2 - y1) || 1);
  const w = (x2 - x1) * s;
  const ox = -(x1 * s) - w / 2;
  return { paths: wordPaths(font, text, BASE * s, ox, -(y1 * s) - TARGET_H / 2), w };
}

interface Shock { start: number; dur: number; w: number }

export class MorphWord {
  private mount: HTMLElement;
  private text: string;
  private fonts: MorphFont[];
  private cycle: number[];
  private tightness: number;
  private speed: number;
  private pad: number;
  private reducedMotion: boolean;

  private svg: SVGSVGElement | null = null;
  private g: SVGGElement | null = null;
  private paths: SVGPathElement[] = [];
  private interps: Array<(t: number) => string> = [];
  private cx: number[] = [];
  private ts: number[] = [];
  private renderedT: number[] = [];
  private targets: number[] = [];
  private lastD: string[] = [];
  private delays: number[] = [];
  private xMin = 0;
  private xSpan = 1;
  private rgbA: RGB = [255, 255, 255];
  private rgbB: RGB = [255, 255, 255];
  private active = false;
  private shock: Shock | null = null;
  private sweep: { start: number } | null = null;
  private lastTouch = 0;
  private raf = 0;
  private lastNow = 0;
  private idleFrames = 0;
  private parkTimer = 0;
  private cachedRect: DOMRect | null = null;
  private cachedAt = 0;

  constructor(mount: HTMLElement, opts: MorphWordOptions = {}) {
    this.mount = mount;
    this.text = opts.text ?? 'MORPH';
    this.fonts = opts.fonts ?? [];
    this.cycle = opts.cycle ?? this.fonts.map((_, i) => i);
    this.tightness = opts.tightness ?? 6;
    this.speed = opts.speed ?? 10;
    this.pad = opts.pad ?? 24;
    this.reducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.lastTouch = performance.now();
    if (this.fonts.length) this.rebuild();
  }

  /** Live reduced-motion switch (e.g. OS pref toggled mid-session). */
  setReducedMotion(on: boolean): void {
    this.reducedMotion = on;
    if (on) {
      this.active = false;
      this.sweep = null;
      this.targets = this.targets.map(() => 0);
      this.stop();
    }
  }

  private currentFont(): MorphFont | undefined {
    return this.fonts[this.cycle[0]] ?? this.fonts[0];
  }

  private nextFont(): MorphFont | undefined {
    return this.fonts[this.cycle[1]] ?? this.fonts[0];
  }

  private ensureSvg(): void {
    if (this.svg) return;
    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.g = document.createElementNS(SVG_NS, 'g');
    this.svg.appendChild(this.g);
    this.mount.appendChild(this.svg);
    this.svg.addEventListener('pointermove', this.onPointerMove);
    this.svg.addEventListener('pointerleave', this.onPointerLeave);
  }

  private applyViewBox(): void {
    this.svg?.setAttribute(
      'viewBox',
      `${this.xMin - this.pad} ${-TARGET_H / 2 - this.pad} ${this.xSpan + this.pad * 2} ${TARGET_H + this.pad * 2}`,
    );
  }

  private cursorF(clientX: number): number {
    if (!this.svg) return 0;
    const now = performance.now();
    if (!this.cachedRect || now - this.cachedAt > RECT_CACHE_MS) {
      this.cachedRect = this.svg.getBoundingClientRect();
      this.cachedAt = now;
    }
    const r = this.cachedRect;
    const ux = (this.xMin - this.pad) + ((clientX - r.left) / r.width) * (this.xSpan + this.pad * 2);
    return (ux - this.xMin) / this.xSpan;
  }

  private rebuild(): void {
    if (!this.fonts.length || !this.cycle.length || !this.mount.isConnected) return;
    const A = this.currentFont();
    const B = this.nextFont();
    if (!A || !B) return;
    this.rgbA = hexToRgb(A.color);
    this.rgbB = hexToRgb(B.color);
    const wa = buildWord(A.font, this.text);
    const wb = buildWord(B.font, this.text);
    // Stage = widest font across the whole cycle: viewBox comes out
    // identical on every rebuild, so the word never rescales mid-cycle.
    let W = Math.max(wa.w, wb.w);
    for (const idx of this.cycle) {
      const f = this.fonts[idx];
      if (f) W = Math.max(W, measureWidth(f.font, this.text));
    }

    this.ensureSvg();
    if (!this.svg || !this.g) return;
    this.xMin = -W / 2;
    this.g.setAttribute('transform', 'translate(0,0)');
    this.xSpan = Math.max(1e-6, W);
    this.cachedRect = null;
    this.applyViewBox();

    while (this.g.childNodes.length > wa.paths.length) {
      const last = this.g.lastChild;
      if (last) this.g.removeChild(last);
      else break;
    }
    while (this.g.childNodes.length < wa.paths.length) {
      this.g.appendChild(document.createElementNS(SVG_NS, 'path'));
    }
    this.paths = Array.from(this.g.querySelectorAll('path'));
    this.ts = new Array(wa.paths.length).fill(0);
    this.renderedT = new Array(wa.paths.length).fill(Number.NaN);
    this.targets = new Array(wa.paths.length).fill(0);
    this.lastD = new Array(wa.paths.length).fill('');
    this.interps = [];
    this.cx = [];
    for (let i = 0; i < wa.paths.length; i++) {
      this.interps.push(contourInterpolate(wa.paths[i].toPathData(4), wb.paths[i].toPathData(4)));
      const bb = wa.paths[i].getBoundingBox();
      this.cx.push(((bb.x1 + bb.x2) / 2 - this.xMin) / this.xSpan);
    }
    this.renderAll();
  }

  private fillFor(t: number): string {
    const [ar, ag, ab] = this.rgbA;
    const [br, bg, bb] = this.rgbB;
    return `rgb(${Math.round(ar + (br - ar) * t)},${Math.round(ag + (bg - ag) * t)},${Math.round(ab + (bb - ab) * t)})`;
  }

  private renderAll(): void {
    for (let i = 0; i < this.paths.length; i++) {
      const t = this.ts[i] || 0;
      this.renderedT[i] = t;
      this.lastD[i] = this.interps[i](t);
      this.paths[i].setAttribute('d', this.lastD[i]);
      this.paths[i].setAttribute('fill', this.fillFor(t));
    }
  }

  /** Only rewrite letters whose morph amount actually moved. */
  private renderDirty(): void {
    for (let i = 0; i < this.paths.length; i++) {
      const t = this.ts[i] || 0;
      if (Math.abs(t - (this.renderedT[i] ?? Number.NaN)) < 1e-4) continue;
      this.renderedT[i] = t;
      this.lastD[i] = this.interps[i](t);
      this.paths[i].setAttribute('d', this.lastD[i]);
      this.paths[i].setAttribute('fill', this.fillFor(t));
    }
  }

  private computeTargets(fx: number): number[] {
    return this.cx.map((c) => Math.min(1, Math.exp(-Math.pow((fx - c) * this.tightness, 2))));
  }

  private fireShock(clientX: number): void {
    if (this.reducedMotion) return;
    if (this.shock || this.cycle.length < 2 || !this.paths.length || !this.g) return;
    const fx = Math.min(1, Math.max(0, this.cursorF(clientX)));
    const nextIdx = this.cycle[1];
    const next = this.fonts[nextIdx];
    if (!next) return;
    const pw = buildWord(next.font, this.text);

    while (this.g.childNodes.length > pw.paths.length) {
      const last = this.g.lastChild;
      if (last) this.g.removeChild(last);
      else break;
    }
    while (this.g.childNodes.length < pw.paths.length) {
      this.g.appendChild(document.createElementNS(SVG_NS, 'path'));
    }
    this.paths = Array.from(this.g.querySelectorAll('path'));
    this.interps = pw.paths.map((p, i) => contourInterpolate(this.lastD[i] || p.toPathData(4), p.toPathData(4)));
    this.renderedT = new Array(this.paths.length).fill(Number.NaN);
    this.delays = this.cx.map((c) => Math.abs(c - fx) * SHOCK_DELAY_SPREAD);
    this.targets = this.cx.map(() => 0);
    this.active = false;
    this.sweep = null;
    this.rgbB = hexToRgb(next.color);
    this.shock = { start: performance.now(), dur: SHOCK_DUR, w: SHOCK_WIDTH };
  }

  private rotateCycle(): void {
    const first = this.cycle.shift();
    if (first !== undefined) this.cycle.push(first);
  }

  /** Click/programmatic trigger: shockwave from word centre. */
  pokeCenter(): void {
    if (!this.svg || this.reducedMotion) return;
    const r = this.svg.getBoundingClientRect();
    this.fireShock(r.left + r.width / 2);
    if (!this.raf) this.start();
  }

  /** Instant cycle step for reduced-motion users (no shock animation). */
  advance(): void {
    if (this.cycle.length < 2) return;
    this.rotateCycle();
    this.rebuild();
  }

  start(): void {
    if (this.raf || this.reducedMotion) return;
    this.clearWake();
    this.idleFrames = 0;
    const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
    const tick = (now: number): void => {
      const dt = Math.min(0.05, (now - this.lastNow) / 1000 || 0.016);
      this.lastNow = now;

      if (this.shock) {
        const shock = this.shock;
        const p = ((now - shock.start) / shock.dur) * (0.55 + shock.w);
        let done = true;
        this.ts = this.cx.map((_, i) => {
          const lt = Math.min(1, Math.max(0, (p - (this.delays[i] || 0)) / shock.w));
          if (lt < 1) done = false;
          return easeOutCubic(lt);
        });
        this.renderDirty();
        if (done) {
          this.shock = null;
          this.rotateCycle();
          this.rebuild();
        }
        this.raf = requestAnimationFrame(tick);
        return;
      }

      if (this.sweep) {
        const p = (now - this.sweep.start) / SWEEP_DUR;
        if (p >= 1) { this.sweep = null; this.lastTouch = now; this.targets = this.targets.map(() => 0); }
        else { this.targets = this.computeTargets(-0.3 + p * 1.6); }
      } else if (!this.reducedMotion && !this.active && !this.shock && now - this.lastTouch > SWEEP_IDLE_MS) {
        this.sweep = { start: now };
      }

      if (!this.active && !this.sweep) this.targets = this.targets.map(() => 0);

      let moved = false;
      this.ts = this.ts.map((tv, i) => {
        const target = this.targets[i] || 0;
        const raw = (tv || 0) + (target - (tv || 0)) * Math.min(1, dt * this.speed);
        const nt = Math.abs(target - raw) < 0.002 ? target : raw;
        if (Math.abs(nt - (tv || 0)) > 1e-4) moved = true;
        return nt;
      });
      if (moved) {
        this.renderDirty();
        this.idleFrames = 0;
      } else if (!this.sweep && !this.active) {
        // Fully settled — park the loop instead of waking at 60Hz
        // forever. A timer re-arms the ambient sweep on schedule.
        this.idleFrames++;
        if (this.idleFrames >= IDLE_PARK_FRAMES) {
          this.raf = 0;
          this.scheduleWake();
          return;
        }
      } else {
        this.idleFrames = 0;
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    this.clearWake();
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  destroy(): void {
    this.stop();
    if (this.svg) {
      this.svg.removeEventListener('pointermove', this.onPointerMove);
      this.svg.removeEventListener('pointerleave', this.onPointerLeave);
      this.svg.remove();
      this.svg = null;
      this.g = null;
    }
  }

  private scheduleWake(): void {
    this.clearWake();
    if (this.reducedMotion || typeof window === 'undefined') return;
    const delay = Math.max(0, SWEEP_IDLE_MS - (performance.now() - this.lastTouch));
    this.parkTimer = window.setTimeout(() => {
      this.parkTimer = 0;
      this.start();
    }, delay);
  }

  private clearWake(): void {
    if (this.parkTimer) {
      clearTimeout(this.parkTimer);
      this.parkTimer = 0;
    }
  }

  private onPointerMove = (e: PointerEvent): void => {
    // Touch drags scroll the page — rippling mid-scroll is accidental.
    if (this.reducedMotion || e.pointerType === 'touch') return;
    this.lastTouch = performance.now();
    if (this.shock) return;
    this.sweep = null;
    this.active = true;
    this.targets = this.computeTargets(this.cursorF(e.clientX));
    if (!this.raf) this.start();
  };

  private onPointerLeave = (): void => {
    if (this.reducedMotion) return;
    this.active = false;
    if (!this.raf) this.start();
  };
}
