import { useEffect, useRef, type ReactNode } from 'react';
import './ShrinkReveal.css';

// ShrinkReveal — skeleton port of experiments/shrink-reveal/index.html.
// Edge-only mask: the wrapped block keeps its size (no transform, no scale)
// while a clip-path inset closes gutters in from the sides as its tail
// exits the viewport. Scroll length and velocity are untouched, so the
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
      // Tail-exit progress: starts while the bottom is still ~0.6 viewports
      // below the fold and completes once it has travelled to ~10% viewport
      // height — a ~1.5-viewport runway, linear so it stays gradual right to
      // the end with no release snap. START is the spacing control: raise it
      // to trigger earlier / stretch the transition further.
      const start = vh * 1.6;
      const end = vh * 0.1;
      const p = Math.max(0, Math.min(1, (start - rect.bottom) / (start - end)));
      // Responsive gutter: experiment's fixed 58px would eat ~30% of a
      // 390px viewport, so cap at ~6vw on narrow screens. Above the 1512px
      // design canvas the 58px edge reads proportionally thinner, so scale
      // it up there (XL layer) — at/below 1512px this branch never runs and
      // behaviour is byte-identical.
      const max =
        window.innerWidth > 1512
          ? Math.min(120, window.innerWidth * 0.045)
          : Math.min(58, window.innerWidth * 0.06);
      const g = (p * max).toFixed(1);
      // Each clip-path write repaints this whole block, so only write when
      // the value actually changes: outside the runway p parks at 0/1 and
      // the string goes quiet instead of repainting on every scroll event.
      const v = `inset(0px ${g}px 0px ${g}px)`;
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
