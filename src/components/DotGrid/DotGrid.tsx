import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import './DotGrid.css';

// DotGrid — faithful portfolio port of the fluid-lab drift_lattice experiment.
// Locked tuning from the original (count 850 · settle 0.97 · push 0.05 ·
// speed 0.80): same spring, damping, exp falloff, influence radius, heat
// curve, alpha ramp, and dot sizes. Only the rendering is batched (resting
// dots = 1 draw call) and the loop sleeps at idle — neither changes any pixel.
// Transparent canvas; the page background shows through.
// Decorative only (aria-hidden).

export type RGB = [number, number, number];

export type DotGridProps = {
  /** px between dots, identical on every viewport. 49 = original count 850. */
  gap?: number;
  /** cursor strength — original locked value 0.05 */
  push?: number;
  /** snap-back — original UI label "settle", locked 0.97 */
  settle?: number;
  /** how far/fast dots travel — original locked 0.80 */
  speed?: number;
  /** resting dot colour */
  ink?: RGB;
  /** fully-stirred dot colour */
  hot?: RGB;
  /** max device-pixel-ratio scaling — original capped 1.5 */
  dprCap?: number;
  className?: string;
  style?: CSSProperties;
};

const TAU = Math.PI * 2;
const STEPS = 16; // colour/size lookup resolution — no per-frame string alloc

// Heat response: heat = min(disp / 60, 1); size = 1.35 + heat*2.4.
// Alpha ramps per OS theme (see LIGHT/DARK_ALPHA below) and colour lerps
// ink -> hot. Resting dots share one shade -> one batched path.
const HEAT_RANGE = 60;
const BASE_SIZE = 1.35;
const GROW = 2.4;
// Light canvas (white ink on clay): resting bright and clearly visible,
// heat pushes to fully opaque bright white.
const LIGHT_ALPHA: [number, number] = [0.65, 0.35];
// Dark canvas (clay ink on ink): a touch fainter at rest than before,
// heat pushes to bright white.
const DARK_ALPHA: [number, number] = [0.16, 0.6];
// Locked stir colour — bright white in both modes, so movement always
// brightens toward white instead of muddying toward grey.
const DEFAULT_HOT: RGB = [255, 255, 255];

// Resting ink resolves live from the --artwork token (white on light,
// clay on dark — same ink as the line-art SVG), so the canvas can never
// drift from the token source. Falls back to white when unreadable.
function artworkRGB(): RGB {
  if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
    return [255, 255, 255];
  }
  const raw = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue('--artwork')
    .trim();
  const m = /^#([0-9a-fA-F]{6})$/.exec(raw);
  if (!m) return [255, 255, 255];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Precompute `rgba()` strings per heat bucket so the frame loop allocates nothing.
function buildLUT(ink: RGB, hot: RGB, baseAlpha: number, alphaRange: number): string[] {
  const lut: string[] = new Array(STEPS);
  for (let i = 0; i < STEPS; i++) {
    const t = i / (STEPS - 1);
    lut[i] =
      `rgba(${Math.round(mix(ink[0], hot[0], t))},` +
      `${Math.round(mix(ink[1], hot[1], t))},` +
      `${Math.round(mix(ink[2], hot[2], t))},` +
      `${baseAlpha + t * alphaRange})`;
  }
  return lut;
}

type EngineOpts = {
  gap: number;
  push: number;
  settle: number;
  speed: number;
  ink: RGB;
  hot: RGB;
  baseAlpha: number;
  alphaRange: number;
  dprCap: number;
};

function createEngine(canvas: HTMLCanvasElement, opts: EngineOpts): () => void {
  const ctxOrNull = canvas.getContext('2d');
  if (!ctxOrNull) return () => undefined;
  // non-nullable alias: narrowing doesn't propagate into the closures below,
  // so bind the guarded value to a freshly-declared non-null type.
  const ctx: CanvasRenderingContext2D = ctxOrNull;

  const { gap, push, settle, speed, ink, hot, baseAlpha, alphaRange, dprCap } = opts;
  const lut = buildLUT(ink, hot, baseAlpha, alphaRange);

  let W = 0;
  let H = 0;
  let appliedDpr = 0;
  let n = 0;
  let hx = new Float32Array(0);
  let hy = new Float32Array(0);
  let x = new Float32Array(0);
  let y = new Float32Array(0);
  let vx = new Float32Array(0);
  let vy = new Float32Array(0);

  const mouse = { x: -9999, y: -9999, vx: 0, vy: 0 };
  let raf = 0;
  let running = false;
  let lastMove = 0;
  let disposed = false;
  let observer: IntersectionObserver | null = null;
  let sizeObserver: ResizeObserver | null = null;
  const hotList: number[] = []; // reused per frame — no per-frame array alloc

  const reduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Touch devices get a static grid: there is no cursor to stir the lattice
  // (touch moves are ignored in onMove below), so running the rAF loop only
  // burns battery and holds composited layers for what is a parked frame.
  // pointer:coarse keeps physics on touchscreen laptops (fine primary
  // pointer) and disables it on phones/tablets.
  const coarse =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;
  const staticMode = reduced || coarse;

  function seed(): void {
    const cols = Math.max(1, Math.floor(W / gap));
    const rows = Math.max(1, Math.floor(H / gap));
    n = cols * rows;
    hx = new Float32Array(n);
    hy = new Float32Array(n);
    x = new Float32Array(n);
    y = new Float32Array(n);
    vx = new Float32Array(n);
    vy = new Float32Array(n);
    let i = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // original origin: half-gap inset from top-left, fixed px gap —
        // identical perceived density on mobile/desktop/iPad.
        const px = gap / 2 + c * gap;
        const py = gap / 2 + r * gap;
        hx[i] = px;
        hy[i] = py;
        x[i] = px;
        y[i] = py;
        i++;
      }
    }
  }

  function resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    // canvas fills its parent — size to element, not window
    const rect = canvas.parentElement?.getBoundingClientRect() ?? {
      width: window.innerWidth,
      height: window.innerHeight,
    };
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    // no-op when nothing changed: ResizeObserver and window resize both fire
    // on a window drag, and reseeding twice per event would be wasteful.
    if (w === W && h === H && dpr === appliedDpr && n > 0) return;
    W = w;
    H = h;
    appliedDpr = dpr;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed();
    if (staticMode) paintStatic();
    else kick();
  }

  function frame(): void {
    raf = 0;
    if (disposed) return;

    // original derived constants — do not retune:
    //   R = 200 * (0.5 + push*0.5), spring = 0.002 + (1-settle)*0.06, damp = 0.93
    const R = 200 * (0.5 + push * 0.5);
    const R2 = R * R;
    const spring = 0.002 + (1 - settle) * 0.06;
    const damp = 0.93;

    const mvx = mouse.vx;
    const mvy = mouse.vy;
    // 0 when still -> cursor exerts no force, lattice fully settles
    const motion = Math.min(Math.hypot(mvx, mvy) * 0.22, 1);

    // idle sleep: cursor still + everything home -> stop rAF, resume on pointermove.
    // The parked frame is pixel-identical to what the endless loop would draw.
    let active = motion > 0.001;
    mouse.vx *= 0.92;
    mouse.vy *= 0.92;

    ctx.clearRect(0, 0, W, H); // transparent — page bg shows through

    // Resting dots share one shade -> ONE path + ONE fill. Stirred dots get
    // their own heat bucket. Quantized to 16 steps; visually identical.
    ctx.fillStyle = lut[0];
    ctx.beginPath();
    hotList.length = 0;

    for (let i = 0; i < n; i++) {
      const xi = x[i];
      const yi = y[i];
      const dx = xi - mouse.x;
      const dy = yi - mouse.y;
      const d2 = dx * dx + dy * dy;

      // wake-drag: mostly cursor velocity, small radial push — both gated by motion
      if (motion > 0.001 && d2 < R2 * 4 && d2 > 1) {
        const d = Math.sqrt(d2);
        const f = Math.exp(-d2 / R2) * push * motion * speed;
        vx[i] += (mvx * 0.3 + (dx / d) * 1.1) * f;
        vy[i] += (mvy * 0.3 + (dy / d) * 1.1) * f;
      }

      vx[i] += (hx[i] - xi) * spring;
      vy[i] += (hy[i] - yi) * spring;
      vx[i] *= damp;
      vy[i] *= damp;

      const spd = Math.hypot(vx[i], vy[i]);
      const cap = 12 * Math.max(speed, 0.3);
      if (spd > cap) {
        vx[i] = (vx[i] / spd) * cap;
        vy[i] = (vy[i] / spd) * cap;
      }

      // snap tiny residuals so grid goes perfectly still after idle
      const ox = xi - hx[i];
      const oy = yi - hy[i];
      const home2 = ox * ox + oy * oy;
      if (home2 < 0.04 && spd < 0.02) {
        x[i] = hx[i];
        y[i] = hy[i];
        vx[i] = 0;
        vy[i] = 0;
      } else {
        x[i] = xi + vx[i];
        y[i] = yi + vy[i];
        active = true;
      }

      // heat from displacement; bucket 0 joins the single batched path
      const disp = Math.sqrt(home2);
      const b = disp / HEAT_RANGE >= 1 ? STEPS - 1 : ((disp / HEAT_RANGE) * STEPS) | 0;
      if (b === 0) {
        ctx.moveTo(x[i] + BASE_SIZE, y[i]);
        ctx.arc(x[i], y[i], BASE_SIZE, 0, TAU);
      } else {
        hotList.push(i);
      }
    }
    ctx.fill(); // all resting dots in one call

    for (let k = 0; k < hotList.length; k++) {
      const i = hotList[k];
      const ox = x[i] - hx[i];
      const oy = y[i] - hy[i];
      const disp = Math.sqrt(ox * ox + oy * oy);
      const heat = disp / HEAT_RANGE > 1 ? 1 : disp / HEAT_RANGE;
      const b = Math.min(STEPS - 1, (heat * STEPS) | 0);
      ctx.fillStyle = lut[b];
      ctx.beginPath();
      ctx.arc(x[i], y[i], BASE_SIZE + (GROW * b) / (STEPS - 1), 0, TAU);
      ctx.fill();
    }

    // keep looping while anything moves; otherwise park until next pointermove
    if (active || performance.now() - lastMove < 1200) {
      kick();
    } else {
      running = false;
    }
  }

  function kick(): void {
    if (disposed || document.hidden) return;
    if (!running) {
      running = true;
      raf = requestAnimationFrame(frame);
    } else if (!raf) {
      raf = requestAnimationFrame(frame);
    }
  }

  // reduced-motion / first paint: static grid, no loop
  function paintStatic(): void {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = lut[0];
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      ctx.moveTo(hx[i] + BASE_SIZE, hy[i]);
      ctx.arc(hx[i], hy[i], BASE_SIZE, 0, TAU);
    }
    ctx.fill();
  }

  let px = -9999;
  let py = -9999;
  function onMove(e: PointerEvent): void {
    // Touch never stirs the lattice: on touch devices every scroll gesture
    // is a window-level pointermove storm, which would keep the loop awake
    // for the whole scroll (+1200ms tail) — on a tall canvas that is the
    // jank. Mouse/pen only; there is no cursor to follow on touch anyway.
    if (e.pointerType === 'touch') return;
    const r = canvas.getBoundingClientRect();
    const cx = e.clientX - r.left;
    const cy = e.clientY - r.top;
    // ignore moves outside the canvas box
    if (cx < 0 || cy < 0 || cx > W || cy > H) return;
    if (px < -9998) {
      px = cx;
      py = cy;
    }
    const dx = cx - px;
    const dy = cy - py;
    px = cx;
    py = cy;
    mouse.x = cx;
    mouse.y = cy;
    mouse.vx = mouse.vx * 0.6 + dx * 0.4;
    mouse.vy = mouse.vy * 0.6 + dy * 0.4;
    lastMove = performance.now();
    if (staticMode) return;
    kick();
  }

  function onVis(): void {
    if (!document.hidden) kick();
  }

  // Static grids (touch / reduced-motion) still need re-seed + repaint on
  // size changes, but never stir: no pointer tracking, no wake observer.
  if (!staticMode) {
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('visibilitychange', onVis);
    if ('IntersectionObserver' in window && canvas.parentElement) {
      observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) kick();
      });
      observer.observe(canvas.parentElement);
    }
  }
  window.addEventListener('resize', resize);
  // Synchronous reseed, like the original. The old 150ms debounce let the
  // browser stretch the stale bitmap into the new CSS box mid-drag — that was
  // the compress/warp. Reseeding a ~2k-dot grid is microseconds, so there is
  // nothing to debounce. The observer also catches non-window size changes
  // (fonts loading, layout shifts) and fires pre-paint, so no torn frame.
  if ('ResizeObserver' in window) {
    sizeObserver = new ResizeObserver(() => resize());
    sizeObserver.observe(canvas);
  }

  resize();

  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', onVis);
    observer?.disconnect();
    sizeObserver?.disconnect();
  };
}

export function DotGrid({
  gap = 49,
  push = 0.05,
  settle = 0.97,
  speed = 0.8,
  ink: inkProp,
  hot = DEFAULT_HOT,
  dprCap = 1.5,
  className,
  style,
}: DotGridProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Re-resolve theme-dependent paint when the OS theme flips (the computed
  // token already reflects the media query — this just re-reads it).
  // Memoised values keep the engine effect from remounting every render.
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setIsDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const ink = useMemo<RGB>(() => inkProp ?? artworkRGB(), [inkProp, isDark]);
  const [baseAlpha, alphaRange] = isDark ? DARK_ALPHA : LIGHT_ALPHA;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return createEngine(canvas, { gap, push, settle, speed, ink, hot, baseAlpha, alphaRange, dprCap });
  }, [gap, push, settle, speed, ink, hot, baseAlpha, alphaRange, dprCap]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className ? `dot-grid ${className}` : 'dot-grid'}
      style={style}
    />
  );
}
