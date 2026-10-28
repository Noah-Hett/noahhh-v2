import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { prefersReducedMotion } from '../utils/reducedMotion.ts';
import { getSelected, challengeOf, coverSrcSet, coverWebp, coverWebpSrcSet, projects, type Project } from '../content/projects.ts';
import { FeaturedCard } from '../components/FeaturedCard/FeaturedCard.tsx';
import { useProjectFonts } from '../components/blocks/useProjectChrome.ts';
import { ViewMore, type ViewMoreItem } from '../components/ViewMore/ViewMore.tsx';
import { ExperienceDiagram } from '../components/ExperienceDiagram/ExperienceDiagram.tsx';
import { useInView } from '../components/ExperienceDiagram/useInView.ts';
import { DotGrid } from '../components/DotGrid/DotGrid.tsx';
import ShrinkReveal from '../components/ShrinkReveal/ShrinkReveal.tsx';
import ContactSection from '../components/ContactSection/ContactSection.tsx';
import HeroArt from '../components/HeroArt/HeroArt.tsx';
import './Home.css';

// DotGrid ink resolves live from the --artwork token inside the component
// (white on light, clay on dark) — no colour props needed here.

// Fresh-document hero intro: plays once per document lifetime (refresh
// replays; client-side back-nav to / skips and lets the PageTransition mask
// do the work). Module flag — not sessionStorage — so a reload re-arms it.
let homeIntroPlayed = false;

// Longest wait before the intro plays regardless (slow network), and the
// intro's length (Home.css: the portrait's 0.05s delay + 1.7s rise is the
// longest leg) after which below-the-fold loading starts.
const INTRO_GATE_MAX = 1200;
const INTRO_DURATION = 1800;

// Resolves on the next idle period (setTimeout fallback where
// requestIdleCallback is missing, e.g. older Safari).
function idle(): Promise<void> {
  return new Promise((resolve) => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(() => resolve(), { timeout: 400 });
    else setTimeout(resolve, 50);
  });
}

function shouldSkipIntro(hash: string): boolean {
  if (typeof window === 'undefined') return true;
  if (prefersReducedMotion()) return true;
  // Hash landing (e.g. a shared /#contact link): the hero is off-screen
  // once ScrollManager jumps, so don't hold content for an unseen cascade.
  if (hash) return true;
  // Deep-link / restored scroll: hero is off-screen, don't hold content.
  if (window.scrollY > 80) return true;
  return false;
}

// Hero lead sentence: split into per-word overflow masks in the render
// below (each word rises on its own delay, natural wrapping still forms
// the visual lines). Word list derived here so future copy edits only
// touch this string — delays cascade from WORD_BASE + index * WORD_STEP
// and LONDON trails the last word by LONDON_GAP. Reads as a line wave at
// any viewport width with no manual break points to maintain.
const HERO_LEAD = 'Noah Hett is a design engineer, obsessed with visual comms and tangible interfaces that make complex systems legible';
const HERO_LEAD_WORDS = HERO_LEAD.split(' ');
const WORD_BASE = 1.1;
const WORD_STEP = 0.03;
const LONDON_GAP = 0.08;
const LONDON_DELAY = WORD_BASE + (HERO_LEAD_WORDS.length - 1) * WORD_STEP + LONDON_GAP;

// Skills strip under the summary side copy — demo list from
// experiments/experience-diagram until spec lands.
const SUMMARY_SKILLS: string[] = [
  'Fusion 360',
  'SolidWorks',
  'Figma',
  'React',
  'TypeScript',
  'Python',
  'Arduino',
  'Blender',
  '3D Printing',
  'Laser Cutting',
];

// CV + portfolio PDFs under the Experience copy. Kept deliberately small:
// the main path through the site is the Project pages, not these files.
// Hosted on R2 like the Project PDFs (ADR-0003), opening in a new tab.
const EXPERIENCE_DOCS: { label: string; href: string }[] = [
  { label: 'CV', href: 'https://media.noahhh.com/docs/noah-hett-cv.pdf' },
  { label: 'Portfolio', href: 'https://media.noahhh.com/docs/noah-hett-portfolio.pdf' },
];

// View-more collage under WORK: a hand-picked set of finished-work photos
// (no process graphics, renders, CAD or mockups), in display order —
// alternate Projects so neighbouring cells differ. Entries are image srcs
// already used on a Project page; dims and slug are looked up from the
// manifest so they can never drift. Unknown srcs are skipped.
const COLLAGE_PICKS: string[] = [
  'https://media.noahhh.com/ic-hack-26/in-environment-1600.avif',
  'https://media.noahhh.com/gizmophone/in-use-1600.avif',
  'https://media.noahhh.com/busk-radio/hero-1600.avif',
  'https://media.noahhh.com/ic-hack-26/cupcakes-1600.avif',
  'https://media.noahhh.com/gizmophone/detail-1600.avif',
  'https://media.noahhh.com/busk-radio/front-bw-1600.avif',
  'https://media.noahhh.com/ic-hack-26/tshirts-give-out-1600.avif',
  'https://media.noahhh.com/ic-hack-26/group-photo-1600.avif',
];

function projectImages(p: Project): ViewMoreItem[] {
  const out: ViewMoreItem[] = [];
  const add = (img: { src: string; width: number; height: number }) => {
    out.push({ slug: p.slug, title: p.title, src: img.src, width: img.width, height: img.height });
  };
  for (const g of p.groups) {
    for (const b of g.blocks) {
      if (b.kind === 'image') add(b);
      else if (b.kind === 'gallery') b.images.forEach(add);
      else if (b.kind === 'showcase') {
        add(b.image);
        b.strip?.forEach(add);
      }
    }
  }
  return out;
}

// Collage cells are ~25vw (33vw under 1024px), so they use local
// 480/720/960w thumbnails in public/collage/ instead of the 1600w Project
// files: named <slug>-<name>-<w>.(avif|webp) after the R2 src.
const COLLAGE_WIDTHS = [480, 720, 960];

function collageThumbs(src: string): Pick<ViewMoreItem, 'srcSetAvif' | 'srcSetWebp'> {
  const m = src.match(/media\.noahhh\.com\/([^/]+)\/(.+)-1600\.avif$/);
  if (!m) return {};
  const base = `/collage/${m[1]}-${m[2]}`;
  const set = (ext: string) => COLLAGE_WIDTHS.map((w) => `${base}-${w}.${ext} ${w}w`).join(', ');
  return { srcSetAvif: set('avif'), srcSetWebp: set('webp') };
}

function collageItems(list: Project[], picks: string[]): ViewMoreItem[] {
  const bySrc = new Map(list.flatMap(projectImages).map((item) => [item.src, item]));
  return picks.flatMap((src) => {
    const item = bySrc.get(src);
    return item ? [{ ...item, ...collageThumbs(src) }] : [];
  });
}

const COLLAGE = collageItems(projects, COLLAGE_PICKS);

// Card copy is the first sentence of the challenge summary — the full
// brief lives on the Project page. Splits on terminal punctuation followed
// by a space, a capital, or the end, so a missing space still breaks.
function firstSentence(text: string): string {
  const match = text.match(/^.*?[.!?](?=\s|[A-Z]|$)/);
  return (match ? match[0] : text).trim();
}

function projectTitleStyle(p: { font: { family: string; fallback?: string } }): CSSProperties {
  return { fontFamily: `"${p.font.family}", ${p.font.fallback ?? 'system-ui, sans-serif'}` };
}

// Layout mirrors Figma frames 28:12 / 40:3 (organisation + geometry only):
// hero (copy / art / photo) → transition band → WORK + 3 Selected bands.
// Copy words come from Figma; type styling stays unstyled until style handoff.
export default function Home() {
  const selected = getSelected();
  const workRef = useRef<HTMLElement | null>(null);
  const { hash } = useLocation();
  // Intro starts pending (hidden states in Home.css) unless this document
  // already played it or there's a reason to skip (reduced motion, hash
  // landing, scrolled).
  const [introIn, setIntroIn] = useState(() => {
    if (homeIntroPlayed || shouldSkipIntro(hash)) {
      homeIntroPlayed = true;
      return true;
    }
    return false;
  });
  // The line-art intro (see Home.css) slides the svg up inside its clipping
  // .hero-art box. Parallax owns the CSS `translate` property on that box +
  // the copy root — independent of `transform`, so scroll moves each
  // assembly whole and can never disturb the intro.
  const artRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const { ref: summaryCopyRef, inView: summaryCopyIn } = useInView<HTMLDivElement>(0.4);

  const photoRef = useRef<HTMLImageElement>(null);
  // Below-the-fold loading (project title faces, collage thumbs) waits for
  // the intro to finish so it never competes with it. Immediate when the
  // intro is skipped.
  const [settled, setSettled] = useState(introIn);
  // Selected cards render titles in each Project's display face. The files
  // are fetched into the HTTP cache once the intro has played (no effect on
  // the page), and the faces are applied only when WORK comes within a
  // screen. Applying them earlier swaps text across the page, and that
  // repaint made Chrome log the already-visible portrait as a ~2.6s LCP;
  // by the time the cards are near, the visitor has scrolled and LCP is
  // final. Watches the card list (not the WORK section, whose top is
  // within a screen of the fold on desktop) with a half-screen lead.
  const cardsRef = useRef<HTMLDivElement>(null);
  const [workNear, setWorkNear] = useState(false);
  useEffect(() => {
    if (!settled) return;
    selected.forEach((p) => {
      if (p.font.src) fetch(p.font.src, { priority: 'low' } as RequestInit).catch(() => undefined);
    });
    // `selected` is derived from the static manifest; settle runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled]);
  useEffect(() => {
    const work = cardsRef.current;
    if (!work || workNear) return;
    if (!('IntersectionObserver' in window)) {
      setWorkNear(true);
      return;
    }
    const obs = new IntersectionObserver(([e]) => e.isIntersecting && setWorkNear(true), {
      rootMargin: '50% 0px',
    });
    obs.observe(work);
    return () => obs.disconnect();
  }, [workNear]);
  useProjectFonts(workNear ? selected : undefined);

  // Intro gate: on a cold first visit the browser is still compiling the
  // bundle and fetching the body face + portrait when the page mounts, and
  // an intro started then drops frames. Hold the hidden state (canvas +
  // dot grid already showing) until the face and portrait are ready and
  // the main thread has a quiet moment — capped at INTRO_GATE_MAX so a
  // slow network never stalls the page. Warm visits resolve at once.
  //
  // Then the flip: pending renders the hidden states; the double rAF
  // guarantees the browser paints them once before .intro-in lands, so the
  // CSS transitions run instead of batch-skipping straight to final. Flag
  // is set inside the callback (not the initializer) so StrictMode's mount
  // → cleanup → remount in dev doesn't consume the one play before it
  // paints.
  useEffect(() => {
    if (introIn) return;
    let cancelled = false;
    let raf1 = 0;
    let raf2 = 0;
    const photo = photoRef.current;
    const ready = Promise.all([
      document.fonts.load('1em "Instrument Sans"').catch(() => undefined),
      photo && !photo.complete
        ? new Promise((r) => {
            photo.addEventListener('load', r, { once: true });
            photo.addEventListener('error', r, { once: true });
          })
        : undefined,
    ]).then(idle);
    const cap = new Promise((r) => setTimeout(r, INTRO_GATE_MAX));
    Promise.race([ready, cap]).then(() => {
      if (cancelled) return;
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          homeIntroPlayed = true;
          setIntroIn(true);
        });
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [introIn]);

  useEffect(() => {
    if (!introIn || settled) return;
    const t = setTimeout(() => setSettled(true), INTRO_DURATION);
    return () => clearTimeout(t);
  }, [introIn, settled]);

  // Hero parallax: art + copy exit together, slightly faster than the page.
  // One shared value written to both. Uses the CSS `translate` property
  // (not `transform`) so the intro system on the art img in Home.css is
  // left untouched. Direct style mutation (no re-render), compositor-only.
  // Parked once the hero leaves the viewport: without the gate this work
  // contends with the card/scrub animations for the whole page lifetime.
  // Smoothed with a lerp loop rather than writing scrollY straight through:
  // on iOS momentum scrolling delivers scroll events at low frequency with
  // large scrollY jumps, so a direct mapping visibly steps while a fling
  // decelerates. The loop interpolates every frame toward the latest
  // target, turning those jumps into a glide, and settles exactly.
  useEffect(() => {
    const art = artRef.current;
    const copy = copyRef.current;
    if ((!art && !copy) || typeof window === 'undefined') return;
    if (prefersReducedMotion()) return;
    const hero = (art ?? copy)?.closest('section');
    let raf = 0;
    let visible = true;
    let target = 0;
    let current = 0;
    const tick = () => {
      raf = 0;
      if (!visible) return;
      current += (target - current) * 0.2;
      if (Math.abs(target - current) < 0.1) current = target;
      const t = `0 ${current.toFixed(1)}px`;
      if (art) art.style.translate = t;
      if (copy) copy.style.translate = t;
      if (current !== target) raf = requestAnimationFrame(tick);
    };
    const onScroll = () => {
      if (!visible) return;
      target = window.scrollY * -0.2;
      if (raf === 0) raf = requestAnimationFrame(tick);
    };
    let visObs: IntersectionObserver | null = null;
    if ('IntersectionObserver' in window && hero) {
      visObs = new IntersectionObserver(
        ([entry]) => {
          visible = entry.isIntersecting;
          if (visible) onScroll();
        },
        { threshold: 0 },
      );
      visObs.observe(hero);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      visObs?.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <main className={introIn ? 'home intro-in' : 'home intro-pending'}>
      <title>Noah Hett</title>
      <section className="hero" aria-label="About">
        <DotGrid gap={48} />
        <div className="hero-art" ref={artRef}>
          <HeroArt className="hero-art-svg" />
        </div>
        <div className="hero-grid">
          <div className="hero-copy" ref={copyRef}>
            <p className="rv hero-lead" aria-label={HERO_LEAD}>
              <span className="hero-lead-words" aria-hidden="true">
                {HERO_LEAD_WORDS.map((w, i) => (
                  <Fragment key={`${w}-${i}`}>
                    <span className="wmask">
                      <span
                        className="wmask-inner"
                        style={{ transitionDelay: `${(WORD_BASE + i * WORD_STEP).toFixed(2)}s` }}
                      >
                        {w}
                      </span>
                    </span>
                    {i < HERO_LEAD_WORDS.length - 1 ? ' ' : null}
                  </Fragment>
                ))}
              </span>
            </p>
            <p className="rv rv-london">
              <span className="rv-inner" style={{ transitionDelay: `${LONDON_DELAY.toFixed(2)}s` }}>
                LONDON
              </span>
            </p>
          </div>
          <div className="hero-photo-wrap">
            <picture>
              <source
                type="image/avif"
                srcSet="/portrait/portrait-800.avif 800w, /portrait/portrait-1600.avif 1600w"
                sizes="(max-width: 600px) 284px, (max-width: 1024px) 466px, 564px"
              />
              <source
                type="image/webp"
                srcSet="/portrait/portrait-800.webp 800w, /portrait/portrait-1600.webp 1600w"
                sizes="(max-width: 600px) 284px, (max-width: 1024px) 466px, 564px"
              />
              <img
                ref={photoRef}
                className="hero-photo"
                src="/portrait/portrait-1600.webp"
                alt="Overhead portrait of Noah Hett working at a table"
                width={564}
                height={532}
                fetchPriority="high"
                decoding="async"
              />
            </picture>
          </div>
        </div>
      </section>

      <div className="transition-band" aria-hidden="true" data-header-wash="lower-half" />

      <ShrinkReveal>
          <section className="work" aria-label="Selected projects" ref={workRef} data-header-wash>
            <h2>WORK</h2>
            <div className="work-list" ref={cardsRef}>
              {selected.map((p) => (
                <FeaturedCard
                  key={p.slug}
                  media={
                    p.cover.kind === 'video'
                      ? {
                          type: 'video',
                          src: p.cover.card?.src ?? p.cover.src,
                          srcMobile: p.cover.card?.srcMobile,
                          thumb: p.cover.card?.poster ?? p.cover.poster,
                          thumbMobile: p.cover.card?.posterMobile,
                          alt: p.cover.alt,
                        }
                      : {
                          type: 'img',
                          src: p.cover.src,
                          alt: p.cover.alt,
                          srcSet: coverSrcSet(p.cover),
                          srcWebp: coverWebp(p.cover.src),
                          srcSetWebp: coverWebpSrcSet(p.cover),
                          // Card media fills ~54% of the track (full-bleed
                          // single column under 720px) with a cover crop.
                          sizes: '(max-width: 720px) 100vw, 54vw',
                        }
                  }
                  colors={p.colors}
                  titleStyle={projectTitleStyle(p)}
                  title={p.title}
                  description={firstSentence(challengeOf(p).summary)}
                >
                  <Link className="fc-open" to={`/project/${p.slug}`}>
                    View project
                    <span className="sr-only">: {p.title}</span>
                    <span className="fc-open-arrow" aria-hidden="true">→</span>
                  </Link>
                </FeaturedCard>
              ))}
            </div>
            <ViewMore items={COLLAGE} zoneRef={workRef} eager={settled} />
          </section>
        </ShrinkReveal>

        <section className="home-section" aria-label="Professional summary">
          <DotGrid gap={48} />
          <div className="exp-grid">
            <div className="exp-diagram-col">
              <ExperienceDiagram />
            </div>
            <div ref={summaryCopyRef} className={`exp-copy${summaryCopyIn ? ' in' : ''}`}>
              <p className="exp-kicker rv">
                <span className="rv-inner">Experience</span>
              </p>
              <h2 className="rv rv-d1">
                <span className="rv-inner">Professional summary placeholder</span>
              </h2>
              <p className="rv rv-d2">
                <span className="rv-inner">
                  Work history / CV graphic goes here — held empty until spec lands.
                </span>
              </p>
              <div className="rv rv-d3">
                <div className="rv-inner">
                  <div className="xd-skills" aria-label="Skills">
                    <div className="xd-skills-track">
                      {SUMMARY_SKILLS.map((s) => (
                        <span key={s}>{s}</span>
                      ))}
                      {SUMMARY_SKILLS.map((s) => (
                        <span key={`loop-${s}`} aria-hidden="true">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="rv rv-d4">
                <div className="rv-inner">
                  <ul className="exp-docs">
                    {EXPERIENCE_DOCS.map((d) => (
                      <li key={d.label}>
                        <a href={d.href} target="_blank" rel="noreferrer">
                          {d.label}
                          <span className="sr-only"> (PDF, opens in new tab)</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Contact shares the viewport with the footer by design (compact
            section + 40/30vh footer) — so it renders directly, not inside a
            full-height .home-section, and skips the DotGrid backdrop. */}
        <ContactSection />
    </main>
  );
}
