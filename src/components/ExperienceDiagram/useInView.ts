import { useEffect, useRef, useState } from 'react';

// useInView — fire-once entry trigger in the noahhh-v2 idiom:
// IntersectionObserver adds the state, no re-renders drive the
// animation itself (CSS transitions do), observers disconnect after
// firing, and reduced-motion / no-IO environments resolve to the
// final state immediately (CSS also forces the end state).
export function useInView<T extends Element>(threshold = 0.3, rootMargin = '0px') {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === 'undefined') return;
    const mq =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
    if (!mq || mq.matches) {
      setInView(true);
      return;
    }
    if (!('IntersectionObserver' in window)) {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries, o) => {
        if (entries[0].isIntersecting) {
          setInView(true);
          o.disconnect();
        }
      },
      { threshold, rootMargin },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold, rootMargin]);

  return { ref, inView };
}
