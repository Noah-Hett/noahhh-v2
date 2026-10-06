import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { prefersReducedMotion } from '../../utils/reducedMotion.ts';
import { useIsMobile } from '../../utils/useIsMobile.ts';
import { useViewportScrollLock } from '../../utils/scrollLock.ts';
import './SiteHeader.css';

// Mixed page + hash header: brand (home top), About + All work + Archive
// are pages; Contact is a smart hash — it scrolls to #contact in place
// when the current page has one (Home / About / Project pages), and
// falls back to the homepage contact (/#contact) otherwise.

// Card-style header exit: scroll velocity slides the links up out of
// overflow-hidden masks (same expo easing + stagger language as the
// FeaturedCard reveals). Pure slide, no opacity. The away flag is React
// state (not a classList toggle): the loop below must survive re-renders —
// a direct DOM toggle gets wiped the next time React reconciles className
// (e.g. the load-play timeout commit), while the loop still believes the
// bar is hidden and never re-adds it. State flips only on hide/show
// transitions; the per-frame decay math stays in refs. Decay is normalised
// to 60fps units so hide timing matches on 60/120Hz displays.
export default function SiteHeader() {
  const headerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstOverlayLinkRef = useRef<HTMLAnchorElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  // Hide-on-scroll flag — state, so re-renders (load-play drop, menu
  // toggles) preserve it instead of wiping a hand-toggled class (see above).
  const [away, setAway] = useState(false);
  // Fresh-load entrance (see SiteHeader.css .load-play): one-shot mask-rise
  // cascade, home-only — the header lives outside Routes so it mounts once
  // per app load and never replays on route change, and the delayed rise
  // only makes sense as the tail of the home hero cascade. Direct loads
  // of any other route (or hash / restored-scroll landings where Home
  // skips its intro) show the bar immediately. Skipped entirely under
  // reduced-motion (CSS forces the end state there anyway).
  const [loadPlay, setLoadPlay] = useState(() => {
    if (prefersReducedMotion()) return false;
    if (typeof window !== 'undefined') {
      if (window.location.pathname !== '/') return false;
      if (window.location.hash) return false;
      if (window.scrollY > 80) return false;
    } else if (location.pathname !== '/') {
      return false;
    }
    return true;
  });
  useEffect(() => {
    if (!loadPlay) return;
    // Last stagger lands at 2.66s + 1s duration; drop the class with a
    // small buffer so later transitions own the masks undisturbed.
    const t = window.setTimeout(() => setLoadPlay(false), 3800);
    return () => window.clearTimeout(t);
  }, [loadPlay]);

  // Opening the menu cancels the entrance — the running fill would
  // otherwise keep overriding the menu-open bar-link tuck.
  useEffect(() => {
    if (open) setLoadPlay(false);
  }, [open ]);
  // Overlay logic only applies at ≤600px — tablet and up keep the full
  // inline row, and the overlay isn't rendered there at all (see below).
  const isMobile = useIsMobile(600);
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open ]);
  // Mirror for the hide loop below (which attaches once at mount): lets a
  // scroll during the entrance cancel it without re-subscribing.
  const loadPlayRef = useRef(loadPlay);
  useEffect(() => {
    loadPlayRef.current = loadPlay;
  }, [loadPlay]);

  // Viewport scroll lock is owned by boolean state (see scrollLock.ts):
  // held while the menu is open on mobile, released on close/unmount.
  // Holds are reference-counted against PageTransition's, so closing into
  // a route transition can't release the transition's hold (or vice versa).
  // Closing never touches scroll state directly — the hook owns it.
  useViewportScrollLock(open && isMobile);

  // Leaving mobile closes the menu (the overlay unmounts with it).
  const wasMobileRef = useRef(isMobile);
  useEffect(() => {
    if (wasMobileRef.current && !isMobile) setOpen(false);
    wasMobileRef.current = isMobile;
  }, [isMobile]);

  // Route change closes the menu (covers NavLink navigations + back/forward).
  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.hash]);

  // While open: force the header shown, move focus into the menu.
  // preventScroll — the viewport is locked; focusing must not fight it.
  useEffect(() => {
    if (!open || !isMobile) return;
    setAway(false);
    firstOverlayLinkRef.current?.focus({ preventScroll: true });
  }, [open, isMobile]);

  // Escape closes the menu and returns focus to the toggle.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!headerRef.current || typeof window === 'undefined') return;
    if (prefersReducedMotion()) return;
    const HIDE_AT = 2; // speed above this hides
    const HOLD = 200; // ms of stillness before return may start
    let speed = 0;
    let hidden = false;
    let last = window.scrollY;
    let lastMove = 0;
    let lastTick = 0;
    let raf = 0;
    const tick = (now: number) => {
      raf = 0;
      // Menu open suspends the hide loop — the header stays put.
      if (openRef.current) {
        lastTick = 0;
        return;
      }
      // Normalise decay to ~60fps units so 120Hz doesn't settle 2x faster.
      const dt = lastTick === 0 ? 1 : Math.min(64, now - lastTick) / 16.7;
      lastTick = now;
      speed += (0 - speed) * Math.min(1, 0.12 * dt);
      if (!hidden && speed > HIDE_AT) {
        hidden = true;
        setAway(true);
      } else if (hidden && speed < 0.5 && performance.now() - lastMove > HOLD) {
        hidden = false;
        setAway(false);
      }
      if (speed > 0.5 || hidden) {
        raf = requestAnimationFrame(tick);
      } else {
        lastTick = 0;
      }
    };
    const onScroll = () => {
      // While the mobile menu is open the header is forced shown.
      if (openRef.current) return;
      // A scroll during the entrance cancels it — headers only (the Home
      // hero intro keeps playing). The one-shot rise animation (fill `both`)
      // would otherwise override the .away transition target for the whole
      // 3.8s window, so early scrolls would never hide the bar. Cancelling
      // here lets this same gesture drive the hide loop below immediately.
      if (loadPlayRef.current) {
        loadPlayRef.current = false;
        setLoadPlay(false);
      }
      const y = window.scrollY;
      // At the very top the return starts at once — no HOLD wait, no
      // velocity settle — but the normal stagger between links is kept.
      // Everywhere else the delayed return applies.
      if (y <= 0) {
        speed = 0;
        last = y;
        lastMove = performance.now();
        if (hidden) {
          hidden = false;
          setAway(false);
        }
        return;
      }
      speed = Math.min(400, speed * 0.5 + Math.abs(y - last) * 0.5);
      last = y;
      lastMove = performance.now();
      if (raf === 0) raf = requestAnimationFrame(tick);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const closeMenu = () => {
    setOpen(false);
  };

  // Same-page closes leave focus on a link that is about to go inert —
  // return it to the toggle so keyboard/SR users don't drop to <body>.
  const closeMenuToToggle = () => {
    setOpen(false);
    toggleRef.current?.focus({ preventScroll: true });
  };

  // Brand is home: already on / → smooth-scroll to top instead of
  // re-navigating (same-route NavLink clicks don't scroll otherwise).
  const onBrand = (e: MouseEvent<HTMLAnchorElement>) => {
    const wasOpen = open;
    if (wasOpen) closeMenuToToggle();
    if (location.pathname !== '/') return;
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    window.history.replaceState(null, '', '/');
  };

  const onContact = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const wasOpen = open;
    if (wasOpen) closeMenuToToggle();
    const el = document.getElementById('contact');
    if (el) {
      // Double rAF: the scroll-lock release lands in a passive effect after
      // close, so wait past paint — a single frame can still run locked and
      // the scroll gets swallowed.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
        });
      });
      window.history.replaceState(null, '', '#contact');
    } else {
      navigate('/#contact');
    }
  };

  return (
    <header
      ref={headerRef}
      className={`site-header${open ? ' menu-open' : ''}${loadPlay ? ' load-play' : ''}${away ? ' away' : ''}`}
    >
      <nav className="site-nav" aria-label="Primary">
        <ul className="site-nav-list">
          <li className="nav-mask nav-d1 brand">
            <NavLink to="/" onClick={onBrand}>noahhh</NavLink>
          </li>
          <li className="nav-mask hide-mobile nav-d2">
            <NavLink to="/about">About</NavLink>
          </li>
          <li className="nav-mask nav-d3">
            <NavLink to="/projects">All work</NavLink>
          </li>
          <li className="nav-mask hide-mobile nav-d4">
            <a href="/#contact" onClick={onContact}>Contact</a>
          </li>
          <li className="nav-mask hide-mobile nav-d5">
            <NavLink to="/archive">Archive</NavLink>
          </li>
          <li className="nav-mask nav-toggle-item nav-d6">
            <button
              ref={toggleRef}
              type="button"
              className="menu-toggle"
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? 'Close menu' : 'Open menu'}
              onClick={() => setOpen((v) => !v)}
            >
              <span className="burger-stack" aria-hidden="true">
                <span className="burger-line" />
                <span className="burger-line" />
              </span>
            </button>
          </li>
        </ul>
      </nav>
      {/* Mobile-only: desktop/tablet never mount this (no DOM cost, no
          duplicate hrefs). `inert` alone hides it from AT/focus while
          closed; the exit choreography plays through close since the node
          stays mounted while isMobile is true. */}
      {isMobile && (
        <nav id="mobile-menu" className="mobile-overlay" aria-label="Mobile" inert={!open}>
          <ul className="overlay-list">
            <li className="overlay-mask od-1 brand">
              <NavLink ref={firstOverlayLinkRef} to="/" onClick={onBrand}>noahhh</NavLink>
            </li>
            <li className="overlay-mask od-2">
              <NavLink to="/about" onClick={closeMenu}>About</NavLink>
            </li>
            <li className="overlay-mask od-3">
              <NavLink to="/projects" onClick={closeMenu}>All work</NavLink>
            </li>
            <li className="overlay-mask od-4">
              <a href="/#contact" onClick={onContact}>Contact</a>
            </li>
            <li className="overlay-mask od-5">
              <NavLink to="/archive" onClick={closeMenu}>Archive</NavLink>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
