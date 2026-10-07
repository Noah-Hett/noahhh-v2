import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { prefersReducedMotion } from '../utils/reducedMotion.ts';
import { getSelected, challengeOf } from '../content/projects.ts';
import { FeaturedCard } from '../components/FeaturedCard/FeaturedCard.tsx';
import { useProjectFonts } from '../components/blocks/useProjectChrome.ts';
import { ExperienceDiagram } from '../components/ExperienceDiagram/ExperienceDiagram.tsx';
import { useInView } from '../components/ExperienceDiagram/useInView.ts';
import { DotGrid } from '../components/DotGrid/DotGrid.tsx';
import { ViewMore, type ViewMoreItem } from '../components/ViewMore/ViewMore.tsx';
import ShrinkReveal from '../components/ShrinkReveal/ShrinkReveal.tsx';
import ContactSection from '../components/ContactSection/ContactSection.tsx';
import HeroArt from '../components/HeroArt/HeroArt.tsx';
import './Home.css';

// DotGrid ink resolves live from the --artwork token inside the component
// (white on light, clay on dark) — no colour props needed here.

// TEMP placeholders for the ViewMore dock until real non-selected projects
// land in the manifest. Slugs 404 (NotFound) until their pages exist.
const MORE_PLACEHOLDERS: ViewMoreItem[] = [  { slug: 'project-4', label: 'P4' },
  { slug: 'project-5', label: 'P5' },
  { slug: 'project-6', label: 'P6' },
  { slug: 'project-7', label: 'P7' },
  { slug: 'project-8', label: 'P8' },
  { slug: 'project-9', label: 'P9' },
  { slug: 'project-10', label: 'P10' },
  { slug: 'project-11', label: 'P11' },
];

// Fresh-document hero intro: plays once per document lifetime (refresh
// replays; client-side back-nav to / skips and lets the PageTransition mask
// do the work). Module flag — not sessionStorage — so a reload re-arms it.
let homeIntroPlayed = false;

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

function projectTitleStyle(p: { font: { family: string; fallback?: string } }): CSSProperties {
  return { fontFamily: `"${p.font.family}", ${p.font.fallback ?? 'system-ui, sans-serif'}` };
}

// Layout mirrors Figma frames 28:12 / 40:3 (organisation + geometry only):
// hero (copy / art / photo) → transition band → WORK + 3 Selected bands.
// Copy words come from Figma; type styling stays unstyled until style handoff.
export default function Home() {
  const selected = getSelected();
  // Selected cards render titles in each Project's display face — the
  // faces load with this page (ProjectPage only loads its own).
  useProjectFonts(selected);
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
  // The line-art intro (see Home.css) runs on a single --u variable driving
  // both travel and reveal edge. Parallax owns the CSS `translate` property
  // on the art + copy roots — independent of `transform`, so scroll moves
  // each assembly whole and can never disturb the locked reveal edge.
  const artRef = useRef<SVGSVGElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const workRef = useRef<HTMLElement | null>(null);
  const { ref: summaryCopyRef, inView: summaryCopyIn } = useInView<HTMLDivElement>(0.4);

  // Intro flip: pending renders the hidden states; the double rAF guarantees
  // the browser paints them once before .intro-in lands, so the CSS
  // transitions run instead of batch-skipping straight to final. Flag is set
  // inside the callback (not the initializer) so StrictMode's mount →
  // cleanup → remount in dev doesn't consume the one play before it paints.
  useEffect(() => {
    if (introIn) return;
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        homeIntroPlayed = true;
        setIntroIn(true);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [introIn]);

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
      <section className="hero" aria-label="About">
        <DotGrid gap={48} />
        <HeroArt className="hero-art" svgRef={artRef} />
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

      <div className="transition-band" aria-hidden="true" />

      <ShrinkReveal>
          <section className="work" aria-label="Selected projects" ref={workRef}>
            <h2>WORK</h2>
            <div className="work-list">
              {selected.map((p) => (
                <FeaturedCard
                  key={p.slug}
                  media={
                    p.cover.kind === 'video'
                      ? { type: 'video', src: p.cover.src, thumb: p.cover.poster, alt: p.cover.alt }
                      : { type: 'img', src: p.cover.src, alt: p.cover.alt }
                  }
                  colors={p.colors}
                  titleStyle={projectTitleStyle(p)}
                  title={p.title}
                  subtitle={challengeOf(p).meta.date}
                  description={challengeOf(p).summary}
                >
                  <Link to={`/project/${p.slug}`}>Open {p.title}</Link>
                </FeaturedCard>
              ))}
            </div>
            <ViewMore items={MORE_PLACEHOLDERS} zoneRef={workRef} />
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
