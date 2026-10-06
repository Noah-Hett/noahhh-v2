import { useEffect, useState } from 'react';

// Shared viewport-width flag. The 600 default matches the app's mobile
// breakpoint — Home, SiteHeader, ContactSection, ExperienceDiagram and
// SiteFooter all pivot at 600px (tablet 601–1024, desktop 1025+).
export function useIsMobile(breakpoint = 600): boolean {
  const query = `(max-width: ${breakpoint}px)`;
  const [isMobile, setIsMobile] = useState<boolean>(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia(query).matches,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return isMobile;
}
