import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import './FeaturedCard.css';
import {
  fullPoints,
  getMaskPoints,
  lerpPoints,
  pillPoints,
  pointsToPolygon,
  smallPillPoints,
  smoothstep,
  toOuterPercent,
  type Point,
} from './maskGeometry';

export type FeaturedCardMedia = { type: 'img' | 'video'; src: string; thumb?: string; alt?: string };

export type FeaturedCardProps = {
  media: FeaturedCardMedia;
  /** Blank-slate defaults: light grey track, dark text. Figma tokens replace these later. */
  bg?: string;
  accent?: string;
  /** Per-Project flip pair. When set, the track follows the OS theme
      (light OS → light bg/dark ink, dark OS → flipped) instead of the
      static bg/accent. Colours originate ONLY from projects.ts. */
  colors?: { light: string; dark: string };
  titleStyle?: CSSProperties;
  title: string;
  subtitle: string;
  description: string;
  meta?: string[];
  children?: ReactNode;
};

const hang = 0.4, hold = 0.8, s1End = 0.45, s2Start = 0.35;
const cardIn = 0, cardOut = 0.6, cardY = 86, cardScale = 0.97;

function applyHangs(t: number) {
  const lo = hang * 0.42, hi = 1 - hold * 0.42;
  if (t <= lo) return 0;
  if (t >= hi) return 1;
  const x = (t - lo) / (hi - lo);
  return x * x * (3 - 2 * x);
}

function applyCardHangs(t: number) {
  const lo = cardIn * 0.6, hi = 1 - cardOut * 0.6;
  if (t <= lo) return 0;
  if (t >= hi) return 1;
  const x = (t - lo) / (hi - lo);
  return x * x * (3 - 2 * x);
}

export function FeaturedCard({
  media,
  bg = '#e5e5e5',
  accent = '#111111',
  colors,
  titleStyle,
  title,
  subtitle,
  description,
  meta,
  children,
}: FeaturedCardProps) {
  const prefersReduced =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData =
    typeof navigator !== 'undefined' &&
    (navigator as unknown as { connection?: { saveData?: boolean } }).connection?.saveData === true;
  // Save-data visitors never autoplay video: poster image only.
  const isVideo = media.type === 'video' && !saveData;
  const trackRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = trackRef.current;
    const clip = clipRef.current;
    if (!el || !clip || typeof window === 'undefined') return;

    if (prefersReduced) {
      const r = clip.getBoundingClientRect();
      const pts = getMaskPoints(1, r.width || 100, r.height || 100, s1End, s2Start);
      const poly = pointsToPolygon(pts);
      clip.style.clipPath = poly;
      (clip.style as unknown as { webkitClipPath: string }).webkitClipPath = poly;
      el.style.transform = 'none';
      return;
    }

    let target = 0;
    let current = 0;
    let raf: number | null = null;
    let ro: ResizeObserver | null = null;
    el.style.willChange = 'transform';
    clip.style.willChange = 'clip-path';

    // Mask geometry cache: the pill→full point sets only depend on the clip
    // box size, so they are rebuilt on resize (rare) instead of every frame.
    // Per-frame mask work is then two lerps + one polygon string, memoized
    // per quantized progress step — settled frames are cache hits with no
    // allocation, and the per-tick getBoundingClientRect (a forced layout)
    // is gone entirely.
    const Q = 128;
    let cw = 0;
    let ch = 0;
    let baseC: Point[] = [];
    let baseP: Point[] = [];
    let baseF: Point[] = [];
    let polyCache: string[] = [];
    let lastPoly = '';
    const rebuildBase = (): void => {
      const W = cw || 100;
      const H = ch || 100;
      baseC = toOuterPercent(smallPillPoints(), W, H);
      baseP = toOuterPercent(pillPoints(), W, H);
      baseF = fullPoints();
      polyCache = new Array(Q + 1).fill('');
    }
    const polygonFor = (eased: number): string => {
      const q = Math.max(0, Math.min(Q, Math.round(eased * Q)));
      const hit = polyCache[q];
      if (hit) return hit;
      const s1 = smoothstep(0, s1End, eased);
      const s2 = smoothstep(s2Start, 1, eased);
      const pts = lerpPoints(lerpPoints(baseC, baseP, s1), baseF, s2);
      const poly = pointsToPolygon(pts);
      polyCache[q] = poly;
      return poly;
    }
    const measure = (): void => {
      // clientWidth/Height read once per resize — never in the frame loop.
      cw = clip.clientWidth || 100;
      ch = clip.clientHeight || 100;
      rebuildBase();
    }

    const tick = () => {
      raf = null;
      current += (target - current) * 0.12;
      if (Math.abs(target - current) < 0.0005) current = target;
      const easedVal = applyHangs(current);
      const cardEased = applyCardHangs(current);
      const y = (1 - cardEased) * cardY;
      const s = cardScale + (1 - cardScale) * cardEased;
      el.style.transform = `translateY(${y.toFixed(2)}px) scale(${s.toFixed(4)})`;
      const poly = polygonFor(easedVal);
      if (poly !== lastPoly) {
        lastPoly = poly;
        clip.style.clipPath = poly;
        (clip.style as unknown as { webkitClipPath: string }).webkitClipPath = poly;
      }
      if (Math.abs(target - current) > 0.001) raf = requestAnimationFrame(tick);
    };

    const onScroll = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const raw = (vh - rect.top) / (vh + rect.height);
      target = Math.max(0, Math.min(1, raw));
      if (raf === null) raf = requestAnimationFrame(tick);
    };

    const onSize = () => {
      measure();
      lastPoly = '';
      onScroll();
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onSize);
    if ('ResizeObserver' in window) {
      ro = new ResizeObserver(onSize);
      ro.observe(clip);
    }
    measure();
    onScroll();

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onSize);
      if (ro) ro.disconnect();
      if (raf !== null) cancelAnimationFrame(raf);
    };
    // Intentionally runs once: scrub loop owns its own targets after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const copy = copyRef.current;
    if (!copy || typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      copy?.classList.add('in');
      return;
    }
    const check = () => {
      const r = copy.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.62 && r.bottom > 0) {
        copy.classList.add('in');
        return true;
      }
      return false;
    };
    if (check()) return;
    const obs = new IntersectionObserver(
      (ents) => {
        ents.forEach((e) => {
          if (e.isIntersecting || e.boundingClientRect.top < window.innerHeight * 0.62) {
            copy.classList.add('in');
            obs.disconnect();
          }
        });
      },
      { threshold: 0.4, rootMargin: '0px 0px -8% 0px' },
    );
    obs.observe(copy);
    return () => {
      obs.disconnect();
    };
  }, []);

  return (
    <div
      ref={trackRef}
      className={`fc-track${colors ? ' fc-themed' : ''}`}
      style={
        colors
          ? ({
              '--card-light': colors.light,
              '--card-dark': colors.dark,
              '--track-accent': colors.dark,
            } as CSSProperties)
          : ({ background: bg, '--track-accent': accent } as CSSProperties)
      }
    >
      <div className="fc-inner">
        <div className="fc-media-wrap">
          <div
            ref={clipRef}
            className={`fc-clip ${isVideo ? 'is-video' : ''}`}
            style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)', willChange: 'clip-path' }}
          >
            <img
              src={isVideo ? media.thumb || media.src : media.src}
              alt={media.alt || `${title} ${subtitle}`}
              draggable={false}
              loading="lazy"
            />
            {isVideo && (
              <video
                src={media.src}
                muted
                loop
                playsInline
                autoPlay
                preload="none"
                onError={(e) => {
                  const v = e.currentTarget;
                  v.style.display = 'none';
                  const img = v.previousElementSibling as HTMLElement | null;
                  if (img) img.style.display = 'block';
                }}
              />
            )}
          </div>
        </div>
        <div ref={copyRef} className="fc-copy">
          <h3 style={titleStyle}>
            <span className="rv">
              <span className="rv-inner">{title}</span>
            </span>
            <span className="rv rv-d1">
              <span className="rv-inner">{subtitle}</span>
            </span>
          </h3>
          <p className="rv rv-d2">
            <span className="rv-inner">{description}</span>
          </p>
          {meta && (
            <div className="fc-meta rv rv-d3">
              <span className="rv-inner" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {meta.map((m) => (
                  <span key={m}>{m}</span>
                ))}
              </span>
            </div>
          )}
          {children && (
            <div className="fc-children rv rv-d4">
              <span className="rv-inner">{children}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
