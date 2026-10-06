import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type { Location } from 'react-router-dom';
import { prefersReducedMotion } from '../../utils/reducedMotion.ts';
import { lockViewportScroll, unlockViewportScroll } from '../../utils/scrollLock.ts';
import { getProject } from '../../content/projects.ts';
import './PageTransition.css';

// Mask-rise page transition — TS port of experiments/motion-lab/transition.js.
// URL-first design: the router commits immediately (back button included)
// while the old page stays rendered under the rising mask; the visual swap
// happens under full cover. The cover duration is the loading budget — the
// incoming lazy chunk is fetched as the transition fires and the wait hides
// behind the hold, exactly like the prototype's chunk.ensure().
//
// Timing is locked (700ms decision). Change TIMING, not magic numbers.
//
// Scroll contract: PUSH/REPLACE land at top; POP restores the saved position
// for that history entry (browser-like). Positions are keyed by location.key.
// The cover hold uses the shared reference-counted viewport lock
// (see scrollLock.ts) so a concurrent mobile-menu hold can't be released
// early — whoever unlocks last restores.
export const TRANSITION_TIMING = {
  duration: 700,
  entryDelay: 220,
  settle: 30,
  exitMult: 1.25,
  exit2Ratio: 0.7,
  loadbarGrace: 600,
} as const;

type Phase = 'idle' | 'armed' | 'covering' | 'revealing';

interface PageTransitionProps {
  location: Location;
  action: 'POP' | 'PUSH' | 'REPLACE';
  preload: (pathname: string) => Promise<unknown> | null;
  children: (displayLocation: Location, active: boolean) => ReactNode;
}

function isHashOnly(a: Location, b: Location): boolean {
  return a.pathname === b.pathname && a.search === b.search && a.hash !== b.hash;
}

// Incoming canvas for the sweep: the mask rises in the TARGET page's
// colour so the swap under full cover is invisible by construction.
// Project targets resolve synchronously from the manifest (no chunk
// wait); everything else is the site canvas, read live off the
// --clay-* primitives (never overridden by html[data-project]) so the
// tokens stay the single source of truth. Lead panel mirrors the
// opposite palette variant on project targets, grey fallback otherwise.
interface CoverColors {
  cover: string;
  lead?: string;
}

function isDarkMode(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

function coverForPathname(pathname: string): CoverColors | null {
  if (typeof window === 'undefined') return null;
  const dark = isDarkMode();
  const match = pathname.match(/^\/project\/([^/]+)\/?$/);
  if (match) {
    const project = getProject(decodeURIComponent(match[1]));
    if (!project) return null;
    return dark
      ? { cover: project.colors.dark, lead: project.colors.light }
      : { cover: project.colors.light, lead: project.colors.dark };
  }
  // Site canvas: clay ink in dark, clay bg in light (see tokens.css).
  try {
    const primitive = dark ? '--clay-ink' : '--clay-bg';
    const value = getComputedStyle(document.documentElement).getPropertyValue(primitive).trim();
    return value ? { cover: value } : null;
  } catch {
    return null;
  }
}

function focusFirstHeading(): void {
  const h = document.querySelector('main h1, main h2, h1');
  if (h instanceof HTMLElement) {
    const prev = h.getAttribute('tabindex');
    h.setAttribute('tabindex', '-1');
    h.focus({ preventScroll: true });
    if (prev === null) h.removeAttribute('tabindex');
    else h.setAttribute('tabindex', prev);
  }
}

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

const nextFrame = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });

export default function PageTransition({ location, action, preload, children }: PageTransitionProps) {
  const [displayLocation, setDisplayLocation] = useState<Location>(location);
  const [phase, setPhase] = useState<Phase>('idle');
  const [showLoadbar, setShowLoadbar] = useState(false);
  const [status, setStatus] = useState('');
  // Incoming-page sweep colours, set per chain run before the mask
  // paints and cleared once the reveal settles (live tokens resume).
  const [cover, setCover] = useState<CoverColors | null>(null);
  const displayRef = useRef<Location>(location);
  const pendingRef = useRef<Location | null>(null);
  // Serialized like the prototype's chain: only one hold → mask → reveal
  // runs at a time, and each run re-reads pendingRef so rapid navigations
  // collapse to a single transition to the final route.
  const chainRef = useRef<Promise<void>>(Promise.resolve());
  // Whether this transition currently holds the shared viewport lock, and
  // whether the tree is still mounted (the chain outlives unmount).
  const transLockedRef = useRef(false);
  const mountedRef = useRef(true);
  const actionRef = useRef(action);
  actionRef.current = action;
  // Scroll positions by history-entry key, saved as each page is left.
  const positionsRef = useRef<Map<string, number>>(new Map());

  function swapScroll(target: Location): void {
    // A hashed target belongs to ScrollManager (element scroll after reveal)
    // — park at top until then. Otherwise POP (back/forward, incl.
    // ProjectLayout's Back) restores where that entry was left; everything
    // else starts at top.
    if (target.hash) {
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    const saved = positionsRef.current.get(target.key);
    const y = actionRef.current === 'POP' && saved !== undefined ? saved : 0;
    window.scrollTo({ top: y, behavior: 'auto' });
  }

  // Best-effort scroll-lock restore if the tree unmounts mid-transition.
  // Only releases this transition's own hold — a concurrent mobile-menu
  // hold (same counter) is untouched. The chain continuation checks the
  // flag, so the hold is released exactly once either way.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (transLockedRef.current) {
        transLockedRef.current = false;
        unlockViewportScroll();
      }
    };
  }, []);

  useEffect(() => {
    if (location.key === displayRef.current.key) return;
    // Remember where the outgoing page was before leaving it.
    positionsRef.current.set(displayRef.current.key, window.scrollY);
    // Hash-only moves land immediately. Adding a hash belongs to
    // ScrollManager (element scroll); removing one restores like a swap.
    if (isHashOnly(location, displayRef.current)) {
      displayRef.current = location;
      setDisplayLocation(location);
      if (!location.hash) swapScroll(location);
      return;
    }
    if (prefersReducedMotion()) {
      displayRef.current = location;
      pendingRef.current = null;
      setDisplayLocation(location);
      swapScroll(location);
      requestAnimationFrame(() => focusFirstHeading());
      return;
    }
    pendingRef.current = location;
    chainRef.current = chainRef.current.then(async () => {
      const target = pendingRef.current;
      if (!target || target.key === displayRef.current.key) return;
      pendingRef.current = null;

      // Fire the chunk load as the transition starts — the cover is its budget.
      const assetsP = preload(target.pathname);
      const needsWait = assetsP !== null;
      let grace = 0;
      if (needsWait) {
        grace = window.setTimeout(() => setShowLoadbar(true), TRANSITION_TIMING.loadbarGrace);
      }

      lockViewportScroll();
      transLockedRef.current = true;
      // Tint the sweep with the incoming canvas BEFORE the mask paints:
      // batched with 'armed' so the double-rAF below paints both together
      // and the rise can never batch-skip in the outgoing colour.
      setCover(coverForPathname(target.pathname));
      // Armed renders the base panel position; the double-rAF guarantees it
      // paints before .rising lands, so the transition can't batch-skip.
      setPhase('armed');
      await nextFrame();
      await nextFrame();
      setPhase('covering');

      let assetsOk = true;
      try {
        await Promise.all([
          delay(TRANSITION_TIMING.entryDelay + TRANSITION_TIMING.duration + TRANSITION_TIMING.settle),
          assetsP ?? Promise.resolve(),
        ]);
      } catch {
        assetsOk = false;
      }
      window.clearTimeout(grace);
      setShowLoadbar(false);
      if (!assetsOk) {
        // URL already committed (URL-first design), so there is nothing to
        // revert to — swap anyway and let the route render. Chunk failures
        // are deploy-mismatch edges, not navigation errors.
        setStatus('That page was slow to load — showing it now.');
      }
      // Swap under full cover, then reveal. The incoming route must paint
      // before positioning — scrolling against the outgoing (shorter)
      // document clamps to its max height, and focus must land on the new
      // heading. Still fully covered, so the extra frames are invisible.
      displayRef.current = target;
      setDisplayLocation(target);
      await nextFrame();
      await nextFrame();
      swapScroll(target);
      focusFirstHeading();
      setPhase('revealing');
      const exitDur = Math.round(TRANSITION_TIMING.duration * TRANSITION_TIMING.exitMult);
      await delay(exitDur + 40);
      setCover(null);
      setPhase('idle');
      if (transLockedRef.current) {
        transLockedRef.current = false;
        // Unmount cleanup already released our hold in that case — the
        // flag keeps the release exactly-once either way.
        if (mountedRef.current) unlockViewportScroll();
      }
    });
  }, [location, preload]);

  const exitDur = Math.round(TRANSITION_TIMING.duration * TRANSITION_TIMING.exitMult);
  const style = {
    '--t-d': `${TRANSITION_TIMING.duration}ms`,
    '--t-exit': `${exitDur}ms`,
    '--t-exit2': `${Math.round(exitDur * TRANSITION_TIMING.exit2Ratio)}ms`,
    ...(cover ? { '--ptrans-cover': cover.cover } : null),
    ...(cover?.lead ? { '--ptrans-cover-lead': cover.lead } : null),
  } as CSSProperties;
  const panelClass = phase === 'covering' ? 'rising' : phase === 'revealing' ? 'exit' : '';

  return (
    <>
      {children(displayLocation, phase !== 'idle')}
      <div className="ptrans" style={style} aria-hidden="true">
        <div className={`ptrans-loadbar${showLoadbar ? ' loading' : ''}`}>
          <span />
        </div>
        <div className={`ptrans-mask${panelClass ? ` ${panelClass}` : ''}`} />
        <div className={`ptrans-mask2${panelClass ? ` ${panelClass}` : ''}`} />
      </div>
      <p className="sr-only" aria-live="polite">
        {status}
      </p>
    </>
  );
}
