import { useEffect, useRef, type ReactNode } from 'react';
import './ShrinkReveal.css';

// ShrinkReveal — skeleton port of experiments/shrink-reveal/index.html.
// Edge-only mask: the wrapped block keeps its size (no transform, no scale)
// while a clip-path inset closes gutters in from the sides — and rounds
// its corners — as its tail exits the viewport. Scroll length and velocity are untouched, so the
// sticky SiteHeader keeps working (a transform ancestor would break it).
//
// Barebones rules followed: direct style mutation (no re-render),
// one rAF-throttled tick, passive listeners, static output under
// prefers-reduced-motion. Gutter reveals the parent page canvas
// (surface-page token), so no global body flip like the experiment.
export default function ShrinkReveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === 'undefined') return;
    // Static skeleton under reduced motion (matches Hero/FeaturedCard/Header).
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    let last = '';
    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      const rect = el.getBoundingClientRect();
      // Tail-exit progress: starts as the bottom edge reaches the fold (so
      // the whole tail, corners included, is on screen from the first
      // frame) and completes once it has risen to 40% viewport height — a
      // 0.6-viewport runway, linear so there is no release snap. START is
      // the timing control: raise it to trigger earlier; END - START sets
      // the speed.
      const start = vh * 1.0;
      const end = vh * 0.4;
      const p = Math.max(0, Math.min(1, (start - rect.bottom) / (start - end)));
      // Responsive gutter: experiment's fixed 58px would eat ~30% of a
      // 390px viewport, so cap at ~6vw on narrow screens. Past the 1512px
      // design canvas it keeps the 58/1512 proportion (capped at 120), so
      // there is no step at the boundary.
      const w = window.innerWidth;
      const max = Math.min(120, Math.max(Math.min(58, w * 0.06), (w * 58) / 1512));
      const g = (p * max).toFixed(1);
      // Corners round in step with the gutters, so the block lifts off the
      // page as a card instead of ending on a hard square cut.
      const maxR = Math.min(64, Math.max(20, window.innerWidth * 0.035));
      const r = (p * maxR).toFixed(1);
      // Each clip-path write repaints this whole block, so only write when
      // the value actually changes: outside the runway p parks at 0/1 and
      // the string goes quiet instead of repainting on every scroll event.
      const v = `inset(0px ${g}px 0px ${g}px round ${r}px)`;
      if (v !== last) {
        last = v;
        el.style.clipPath = v;
      }
    };
    const requestUpdate = () => {
      if (raf === 0) raf = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    requestUpdate();
    return () => {
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} className="shrink-reveal">
      {children}
    </div>
  );
}
