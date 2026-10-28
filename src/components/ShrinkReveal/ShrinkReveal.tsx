import { useEffect, useRef, type ReactNode } from 'react';
import './ShrinkReveal.css';

// ShrinkReveal — skeleton port of experiments/shrink-reveal/index.html.
// Edge-only mask: the wrapped block keeps its size (no transform, no scale)
// while a clip-path inset closes gutters in from the sides — and rounds
// its corners — as its tail exits the viewport. Scroll length and velocity
// are untouched, so the sticky SiteHeader keeps working (a transform
// ancestor would break it).
//
// Barebones rules followed: direct style mutation (no re-render),
// passive listeners, static output under prefers-reduced-motion. Gutter
// reveals the parent page canvas (surface-page token), so no global body
// flip like the experiment.
//
// Smoothed like the Home hero parallax: scroll only updates a target and a
// rAF loop lerps toward it every frame. iOS momentum scrolling delivers
// scroll events sparsely with large jumps, so writing progress straight
// through visibly stepped (read as low fps); the loop turns those jumps
// into a glide and settles exactly, then stops.
export default function ShrinkReveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === 'undefined') return;
    // Static skeleton under reduced motion (matches Hero/FeaturedCard/Header).
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    let last = '';
    let target = 0;
    let current = 0;

    const progress = () => {
      const vh = window.innerHeight;
      const bottom = el.getBoundingClientRect().bottom;
      // Tail-exit progress: starts as the bottom edge reaches the fold (so
      // the whole tail, corners included, is on screen from the first
      // frame) and keeps going until that edge leaves the top of the
      // viewport — a full-viewport runway, so the shrink is never seen to
      // stop. Linear: no release snap. START is the timing control;
      // START - END sets the speed.
      const start = vh * 1.0;
      const end = 0;
      return Math.max(0, Math.min(1, (start - bottom) / (start - end)));
    };

    const paint = (p: number) => {
      const w = window.innerWidth;
      // Responsive gutter: experiment's fixed 58px would eat ~30% of a
      // 390px viewport, so cap at ~6vw on narrow screens. Past the 1512px
      // design canvas it keeps the 58/1512 proportion (capped at 120), so
      // there is no step at the boundary.
      const max = Math.min(120, Math.max(Math.min(58, w * 0.06), (w * 58) / 1512));
      // Corners round in step with the gutters, so the block lifts off the
      // page as a card instead of ending on a hard square cut. Large end
      // radius (~6vw: 32px on phones, ~86px at 1440, 96px cap) so the
      // growth reads.
      const maxR = Math.min(96, Math.max(32, w * 0.06));
      const g = (p * max).toFixed(1);
      const r = (p * maxR).toFixed(1);
      // Each clip-path write repaints this whole block, so only write when
      // the value actually changes: outside the runway p parks at 0/1 and
      // the string goes quiet.
      const v = `inset(0px ${g}px 0px ${g}px round ${r}px)`;
      if (v !== last) {
        last = v;
        el.style.clipPath = v;
      }
    };

    const tick = () => {
      raf = 0;
      current += (target - current) * 0.2;
      if (Math.abs(target - current) < 0.001) current = target;
      paint(current);
      if (current !== target) raf = requestAnimationFrame(tick);
    };
    const onScroll = () => {
      target = progress();
      if (raf === 0) raf = requestAnimationFrame(tick);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    // Land on the right state immediately (restored scroll / hash landing),
    // no glide-in from 0.
    target = current = progress();
    paint(current);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} className="shrink-reveal">
      {children}
    </div>
  );
}
