import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import './FeaturedCard.css';
import { useLazyVideo, useWideViewport } from '../../utils/useLazyVideo.ts';
import { viewTimeline } from '../../utils/scrollTimeline.ts';
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

export type FeaturedCardMedia = {
  type: 'img' | 'video';
  src: string;
  thumb?: string;
  alt?: string;
  /** Responsive variants (`"src 800w, …"`); omitted for single-file covers. */
  srcSet?: string;
  sizes?: string;
  /** WebP twins of `src`/`srcSet` for browsers without AVIF (iOS ≤15). */
  srcWebp?: string;
  srcSetWebp?: string;
  /** Video only: lighter encode + poster used below 1024px viewports. */
  srcMobile?: string;
  thumbMobile?: string;
};

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
  subtitle?: string;
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
  const wide = useWideViewport();
  const videoSrc = !wide && media.srcMobile ? media.srcMobile : media.src;
  const poster = !wide && media.thumbMobile ? media.thumbMobile : media.thumb;
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
    // Per-frame mask work is then two lerps + one polygon string (~17µs),
    // computed from the exact progress rather than a quantized step — a
    // 128-step cache made the edge jump ~8px at a time mid-reveal. The
    // per-tick getBoundingClientRect (a forced layout) is gone entirely.
    let cw = 0;
    let ch = 0;
    let baseC: Point[] = [];
    let baseP: Point[] = [];
    let baseF: Point[] = [];
    let lastPoly = '';
    const rebuildBase = (): void => {
      const W = cw || 100;
      const H = ch || 100;
      baseC = toOuterPercent(smallPillPoints(), W, H);
      baseP = toOuterPercent(pillPoints(), W, H);
      baseF = fullPoints();
    }
    const polygonFor = (eased: number): string => {
      const s1 = smoothstep(0, s1End, eased);
      const s2 = smoothstep(s2Start, 1, eased);
      return pointsToPolygon(lerpPoints(lerpPoints(baseC, baseP, s1), baseF, s2));
    }
    const measure = (): void => {
      // clientWidth/Height read once per resize — never in the frame loop.
      cw = clip.clientWidth || 100;
      ch = clip.clientHeight || 100;
      rebuildBase();
    }

    // Scroll-driven path: the same lift/scale/mask math is sampled into
    // keyframes once per size and played on a ViewTimeline, so the browser
    // applies each frame in step with the scroll itself instead of waiting
    // on a rAF that can land a frame late (visible snapping on slower
    // machines). Browsers without ViewTimeline keep the rAF scrub below.
    const timeline = viewTimeline(el);
    if (timeline) {
      const SAMPLES = 96;
      let anims: Animation[] = [];
      const build = (): void => {
        anims.forEach((a) => a.cancel());
        cw = clip.clientWidth || 100;
        ch = clip.clientHeight || 100;
        rebuildBase();
        const lift: Keyframe[] = [];
        const mask: Keyframe[] = [];
        // The rAF path measures the card's rect *with* its own lift and
        // scale applied, so it settles where p = progress(transformed
        // rect). The timeline reports untransformed layout progress q;
        // solve that same fixed point per sample so both rest identically.
        const vh = window.innerHeight;
        const h = el.offsetHeight;
        const settle = (q: number): number => {
          const topLayout = vh - q * (vh + h);
          let p = q;
          for (let k = 0; k < 40; k++) {
            const e = applyCardHangs(p);
            const sc = cardScale + (1 - cardScale) * e;
            const top = topLayout + (1 - e) * cardY + ((1 - sc) * h) / 2;
            p = Math.max(0, Math.min(1, (vh - top) / (vh + sc * h)));
          }
          return p;
        };
        for (let i = 0; i <= SAMPLES; i++) {
          const p = settle(i / SAMPLES);
          const cardEased = applyCardHangs(p);
          const y = (1 - cardEased) * cardY;
          const s = cardScale + (1 - cardScale) * cardEased;
          lift.push({ offset: i / SAMPLES, transform: `translateY(${y.toFixed(2)}px) scale(${s.toFixed(4)})` });
          mask.push({ offset: i / SAMPLES, clipPath: polygonFor(applyHangs(p)) });
        }
        const opts = { timeline, rangeStart: 'cover 0%', rangeEnd: 'cover 100%', fill: 'both', easing: 'linear' } as unknown as KeyframeAnimationOptions;
        anims = [el.animate(lift, opts), clip.animate(mask, opts)];
      };
      build();
      const sizeObs = 'ResizeObserver' in window ? new ResizeObserver(build) : null;
      sizeObs?.observe(clip);
      window.addEventListener('resize', build);
      return () => {
        sizeObs?.disconnect();
        window.removeEventListener('resize', build);
        anims.forEach((a) => a.cancel());
      };
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

  // Lazy video (see useLazyVideo); reduced-motion visitors keep the poster.
  const videoRef = useRef<HTMLVideoElement>(null);
  useLazyVideo(videoRef, videoSrc, isVideo && !prefersReduced, poster);

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
              // --track-accent / --track-bg come from FeaturedCard.css so
              // they can flip under prefers-color-scheme: dark — an inline
              // value here would pin the light-mode pair in both themes.
            } as CSSProperties)
          : ({ background: bg, '--track-accent': accent, '--track-bg': bg } as CSSProperties)
      }
    >
      <div className="fc-inner">
        <div className="fc-media-wrap">
          <div
            ref={clipRef}
            className={`fc-clip ${isVideo ? 'is-video' : ''}`}
            style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)', willChange: 'clip-path' }}
          >
            {isVideo || !media.srcWebp ? (
              <img
                src={isVideo ? poster || media.src : media.src}
                srcSet={isVideo ? undefined : media.srcSet}
                sizes={isVideo ? undefined : media.sizes}
                alt={media.alt || title}
                draggable={false}
                loading="lazy"
              />
            ) : (
              // display: contents (FeaturedCard.css) keeps the <img> the box.
              <picture>
                <source type="image/avif" srcSet={media.srcSet ?? media.src} sizes={media.sizes} />
                <source type="image/webp" srcSet={media.srcSetWebp ?? media.srcWebp} sizes={media.sizes} />
                <img src={media.srcWebp} alt={media.alt || title} draggable={false} loading="lazy" />
              </picture>
            )}
            {isVideo && (
              <video
                ref={videoRef}
                muted
                loop
                playsInline
                preload="none"
                aria-label={media.alt || title}
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
            {subtitle && (
              <span className="rv rv-d1">
                <span className="rv-inner">{subtitle}</span>
              </span>
            )}
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
