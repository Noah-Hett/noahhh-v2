import { useEffect, useState, type RefObject } from 'react';

// Viewport class, picked once per mount: a resize across 1024px keeps the
// file it has. Below it, video uses the lighter 720p encodes.
export function useWideViewport(): boolean {
  const [wide] = useState(
    () => typeof window === 'undefined' || window.matchMedia('(min-width: 1024px)').matches,
  );
  return wide;
}

// Lazy ambient video: no src (so no download) until the element is within
// a screen of the viewport, then it plays only while on screen and pauses
// when it leaves. Callers must NOT set autoPlay — it overrides
// preload="none" and pulls the whole file at page load. `enabled: false`
// (reduced motion) leaves the poster up.
export function useLazyVideo(
  ref: RefObject<HTMLVideoElement | null>,
  src: string,
  enabled = true,
): void {
  useEffect(() => {
    const v = ref.current;
    if (!v || !enabled || !('IntersectionObserver' in window)) return;
    const near = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        v.src = src;
        near.disconnect();
      },
      { rootMargin: '100% 0px' },
    );
    const onScreen = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) v.play().catch(() => undefined);
      else v.pause();
    });
    // Order matters: `near` is created first, so when both fire in the
    // same frame the src is set before play().
    near.observe(v);
    onScreen.observe(v);
    return () => {
      near.disconnect();
      onScreen.disconnect();
    };
  }, [ref, src, enabled]);
}
