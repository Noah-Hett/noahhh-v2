// Shared prefers-reduced-motion check. Previously copied verbatim into
// App, PageTransition, SiteHeader, ProjectLayout, SiteFooter (plus inline
// variants in FeaturedCard/DotGrid/ViewMore/ShrinkReveal) — import this
// instead so the query string and the SSR guards stay in one place.
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
