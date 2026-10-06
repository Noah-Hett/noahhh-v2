import { useEffect, useRef, useState } from 'react';
import { MorphWord, type MorphFont } from './morph/morphWord';
import { useInView } from '../ExperienceDiagram/useInView.ts';
import './SiteFooter.css';

// Shared footer for every route (see App.tsx). Home-only Contact lives
// elsewhere — this stays minimal on purpose: top row (© / back-to-top)
// over a full-bleed morphing NOAHHH that bleeds off the 40vh bottom edge.
//
// Type engine: MorphWord with the tuned config below (font order +
// palette + tightness 3.6 / speed 5). The word is decorative play —
// aria-hidden, mouse/touch only, never a tab stop.

const WORD = 'NOAHHH';

type FontFile = { file: string; label: string; color: string };

// Tuned order + palette — do not reorder without retuning the cycle feel.
// TEMP: all muted to grey while other work is in flight (distracting
// otherwise). Restore: G2 Hyper #ffb45c, Geist #5cc8ff,
// Syne Mono #ff5c7a, Geist Mono #8affc1.
const FILES: FontFile[] = [
  { file: 'G2Hyper-VisibleSlanted.ttf', label: 'G2 Hyper', color: '#a3a3a3' },
  { file: 'Geist-Regular.ttf', label: 'Geist', color: '#a3a3a3' },
  { file: 'Syne Mono Regular.otf', label: 'Syne Mono', color: '#a3a3a3' },
  { file: 'GeistMono-Regular.ttf', label: 'Geist Mono', color: '#a3a3a3' },
];

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export default function SiteFooter() {
  // Reveal fires in two stages: the top row slides as the footer enters,
  // the word mask triggers off the word's top edge with 200px lookahead —
  // the curve's held start plays out just offscreen, the whip lands as
  // the word arrives, so there's never dead black on screen.
  const { ref: footRef, inView } = useInView<HTMLElement>(0.15);
  const { ref: wordViewRef, inView: wordInView } = useInView<HTMLDivElement>(0, '0px 0px 200px 0px');
  const mountRef = useRef<HTMLDivElement | null>(null);
  const wordRef = useRef<MorphWord | null>(null);
  const visibleRef = useRef(true);
  const [fontsReady, setFontsReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // Arm the font fetch when the footer nears the viewport (1000px
  // lookahead) — it's below the fold on every route, so never compete
  // with LCP, but start early enough that the word is ready when the
  // reveal runs. No IntersectionObserver → load immediately.
  useEffect(() => {
    const foot = footRef.current;
    if (!foot || typeof window === 'undefined') return;
    if (!('IntersectionObserver' in window)) {
      setFontsReady(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setFontsReady(true);
          obs.disconnect();
        }
      },
      { threshold: 0, rootMargin: '1000px 0px' },
    );
    obs.observe(foot);
    return () => obs.disconnect();
  }, [footRef]);

  // Create the word once fonts land; destroy on unmount. opentype.js is
  // dynamically imported so it splits out of the initial chunk. One bad
  // font doesn't kill the rest — the morph needs any 2+, not all 4.
  useEffect(() => {
    if (!fontsReady) return;
    const mount = mountRef.current;
    if (!mount || typeof window === 'undefined') return;
    let cancelled = false;
    let word: MorphWord | null = null;
    void (async () => {
      try {
        const base = import.meta.env.BASE_URL;
        // opentype chunk + font binaries fetch concurrently — parsing
        // still waits for both, but nothing sits idle behind anything else.
        const opentypePromise = import('opentype.js');
        const settled = await Promise.allSettled(
          FILES.map(async ({ file, label, color }) => {
            const res = await fetch(`${base}fonts/${encodeURIComponent(file)}`);
            if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
            return { buf: await res.arrayBuffer(), label, color };
          }),
        );
        const opentype = await opentypePromise;
        const fonts: MorphFont[] = [];
        for (const r of settled) {
          if (r.status === 'fulfilled') {
            fonts.push({ font: opentype.parse(r.value.buf), label: r.value.label, color: r.value.color });
          } else {
            console.error('[SiteFooter] font load failed', r.reason);
          }
        }
        if (cancelled) return;
        if (fonts.length < 2) {
          setFailed(true);
          return;
        }
        word = new MorphWord(mount, {
          text: WORD,
          fonts,
          cycle: fonts.map((_, i) => i),
          tightness: 3.6,
          speed: 5,
          pad: 8,
        });
        wordRef.current = word;
        // Don't spin the loop for a static reduced-motion word, or for a
        // footer that's still offscreen (the park observer takes over).
        if (!prefersReducedMotion() && visibleRef.current) word.start();
      } catch (err) {
        console.error('[SiteFooter] font load failed', err);
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      word?.destroy();
      wordRef.current = null;
    };
  }, [fontsReady, footRef]);

  // Park the rAF loop while the footer is offscreen; follow the OS
  // reduced-motion pref live (the engine snapshots it at construction).
  useEffect(() => {
    const foot = footRef.current;
    if (!foot || typeof window === 'undefined') return;
    const mq =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
    const onChange = (e: MediaQueryListEvent): void => {
      const word = wordRef.current;
      if (!word) return;
      word.setReducedMotion(e.matches);
      if (!e.matches && visibleRef.current) word.start();
    };
    mq?.addEventListener('change', onChange);
    if (!('IntersectionObserver' in window)) return () => mq?.removeEventListener('change', onChange);
    const obs = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting;
        const word = wordRef.current;
        if (!word) return;
        if (entry.isIntersecting) word.start();
        else word.stop();
      },
      { threshold: 0 },
    );
    obs.observe(foot);
    return () => {
      obs.disconnect();
      mq?.removeEventListener('change', onChange);
    };
  }, [footRef]);

  const activate = (): void => {
    const word = wordRef.current;
    if (!word) return;
    if (prefersReducedMotion()) word.advance();
    else word.pokeCenter();
  };

  const toTop = (): void => {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    // Focus leaves with the scroll otherwise — land it on the first
    // heading so keyboard/SR users don't lose context. Best-effort.
    window.setTimeout(() => {
      const h = document.querySelector('main h1, main h2, h1');
      if (h instanceof HTMLElement) {
        const prev = h.getAttribute('tabindex');
        h.setAttribute('tabindex', '-1');
        h.focus({ preventScroll: true });
        if (prev === null) h.removeAttribute('tabindex');
        else h.setAttribute('tabindex', prev);
      }
    }, prefersReducedMotion() ? 0 : 600);
  };

  return (
    <footer ref={footRef} className={`site-footer-dark${inView ? ' in' : ''}${wordInView ? ' in-word' : ''}`}>
      <div className="sf-inner">
        <div className="sf-top">
          <span className="rv">
            <span className="rv-inner">© 2026 Noah Hett — London</span>
          </span>
          <button type="button" className="sf-top-link rv rv-d1" onClick={toTop}>
            <span className="rv-inner">Back to top ↑</span>
          </button>
        </div>
      </div>
      <div ref={wordViewRef} className="sf-word" aria-hidden="true" onClick={activate}>
        <div className="sf-reveal">
          {failed ? (
            <span className="sf-fallback">{WORD}</span>
          ) : (
            <div ref={mountRef} className="sf-mount" />
          )}
        </div>
      </div>
    </footer>
  );
}
