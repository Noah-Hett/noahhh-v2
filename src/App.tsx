import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation, useNavigationType, useParams, type Location } from 'react-router-dom';
import SiteHeader from './components/SiteHeader/SiteHeader.tsx';
import SiteFooter from './components/SiteFooter/SiteFooter.tsx';
import PageTransition from './components/PageTransition/PageTransition.tsx';
import ProjectErrorBoundary from './components/ProjectErrorBoundary.tsx';
import { prefersReducedMotion } from './utils/reducedMotion.ts';
import Home from './pages/Home.tsx';

// Route-level splitting: everything below the fold ships on demand.
// Home is eager (LCP); the rest lazy so initial JS stays small.
const About = lazy(() => import('./pages/About.tsx'));
const Projects = lazy(() => import('./pages/Projects.tsx'));
const ProjectPage = lazy(() => import('./pages/ProjectPage.tsx'));
const Archive = lazy(() => import('./pages/Archive.tsx'));
const NotFound = lazy(() => import('./pages/NotFound.tsx'));

// Intent prefetch map. Specifiers match the lazy() calls above exactly so
// hover intent warms the same chunk the route will render — the transition
// cover duration becomes the loading budget (see PageTransition).
export function preloadForPathname(pathname: string): Promise<unknown> | null {
  if (pathname === '/about') return import('./pages/About.tsx');
  if (pathname === '/projects') return import('./pages/Projects.tsx');
  if (pathname.startsWith('/project/')) return import('./pages/ProjectPage.tsx');
  if (pathname === '/archive') return import('./pages/Archive.tsx');
  if (pathname === '/') return null;
  return import('./pages/NotFound.tsx');
}

// Hash scrolling only: React Router doesn't scroll on its own, so any
// #hash scrolls to that element (retried briefly so lazy pages can mount
// first). Plain route changes scroll in PageTransition's under-cover swap
// (top on PUSH, restored position on POP) — never here, or the restore
// gets clobbered when the transition releases the hold. Held while the
// transition owns the scroll position.
function ScrollManager({ location, held }: { location: Location; held: boolean }) {
  const { pathname, hash } = location;
  useEffect(() => {
    if (held || !hash) return;
    const id = hash.slice(1);
    let tries = 0;
    let timer = 0;
    const attempt = () => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      } else if (tries < 10) {
        tries += 1;
        timer = window.setTimeout(attempt, 100);
      }
    };
    attempt();
    return () => window.clearTimeout(timer);
  }, [pathname, hash, held]);
  return null;
}

// One broken Project entry must not blank the whole app — the boundary
// catches validateProject throws and shows a fallback for that page only.
function ProjectRoute() {
  const { slug } = useParams();
  return (
    <ProjectErrorBoundary slug={slug}>
      <ProjectPage />
    </ProjectErrorBoundary>
  );
}

// Project pages close with the ContactSection end prompt — the big
// footer never renders there. Footer follows the displayed route (not the
// URL) so it swaps under full cover and never flashes.
function Shell() {
  const location = useLocation();
  const navigationType = useNavigationType();

  // Custom scroll restoration (top on PUSH, saved position on POP) lives in
  // PageTransition — tell the browser not to fight it on traversals.
  useEffect(() => {
    try {
      window.history.scrollRestoration = 'manual';
    } catch {
      // Non-supporting browsers: no-op, PageTransition still positions.
    }
  }, []);

  // Intent prefetch: hovering or keyboard-focusing an internal link warms
  // its chunk, mirroring the motion-lab prototype. Rejections are swallowed
  // — a failed prefetch just means the navigation attempt loads it instead.
  useEffect(() => {
    const warm = (anchor: HTMLAnchorElement | null) => {
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || !href.startsWith('/')) return;
      let pathname = href;
      try {
        pathname = new URL(href, window.location.origin).pathname;
      } catch {
        pathname = href;
      }
      void preloadForPathname(pathname)?.catch(() => {});
    };
    const onPointer = (e: PointerEvent) => {
      if (e.target instanceof Element) warm(e.target.closest('a[href]'));
    };
    const onFocus = (e: FocusEvent) => {
      if (e.target instanceof Element) warm(e.target.closest('a[href]'));
    };
    document.addEventListener('pointerover', onPointer);
    document.addEventListener('focusin', onFocus);
    return () => {
      document.removeEventListener('pointerover', onPointer);
      document.removeEventListener('focusin', onFocus);
    };
  }, []);

  return (
    <>
      <SiteHeader />
      <PageTransition location={location} action={navigationType} preload={preloadForPathname}>
        {(displayLocation, active) => (
          <>
            <ScrollManager location={displayLocation} held={active} />
            <Suspense fallback={<p>Loading…</p>}>
              <Routes location={displayLocation}>
                <Route path="/" element={<Home />} />
                <Route path="/about" element={<About />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/project/:slug" element={<ProjectRoute />} />
                <Route path="/archive" element={<Archive />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            {!displayLocation.pathname.startsWith('/project/') && <SiteFooter />}
          </>
        )}
      </PageTransition>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
