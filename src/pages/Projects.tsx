import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { projects, type Project, type ProjectCover } from '../content/projects.ts';
import { useProjectFonts } from '../components/blocks/useProjectChrome.ts';
import { prefersReducedMotion } from '../utils/reducedMotion.ts';
import './Projects.css';

function titleStyle(p: Project): CSSProperties {
  return { fontFamily: `"${p.font.family}", ${p.font.fallback ?? 'system-ui, sans-serif'}` };
}

function saveData(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    (navigator as unknown as { connection?: { saveData?: boolean } }).connection?.saveData === true
  );
}

// Evaluated once per mount (not per cover): save-data and reduced-motion
// visitors never autoplay — poster stills only. Matches FeaturedCard.
function useMotionSafeVideo(): boolean {
  const [ok] = useState(() => !saveData() && !prefersReducedMotion());
  return ok;
}

// Cover media shared by both views. Images render as-is; video covers
// autoplay muted loops inline (the hero asset, poster-backed) only when
// `active` — gallery tiles are always active, list previews only while
// their row's sweep is running, so hidden rows cost a poster fetch, not
// an autoplaying stream. Inactive or motion-unsafe covers render the
// poster image only — no autoplay.
function CoverMedia({
  cover,
  active = true,
  motionOK,
}: {
  cover: ProjectCover;
  active?: boolean;
  motionOK: boolean;
}) {
  if (cover.kind === 'image') {
    return (
      <img
        src={cover.src}
        alt=""
        aria-hidden="true"
        width={cover.width}
        height={cover.height}
        loading="lazy"
        decoding="async"
      />
    );
  }
  if (!motionOK || !active) {
    return (
      <img
        src={cover.poster}
        alt=""
        aria-hidden="true"
        width={cover.width}
        height={cover.height}
        loading="lazy"
        decoding="async"
      />
    );
  }
  return (
    <video
      src={cover.src}
      poster={cover.poster}
      width={cover.width}
      height={cover.height}
      autoPlay
      muted
      loop
      playsInline
      preload="none"
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}

// Gallery: tessellated masonry, native aspect ratios, Project name slides
// up over the image bottom on hover/focus (Project's own display face).
function GalleryView({ motionOK }: { motionOK: boolean }) {
  return (
    <ul className="pw-gallery">
      {projects.map((p) => (
        <li key={p.slug} className="pw-cell">
          <Link
            to={`/project/${p.slug}`}
            className="pw-tile"
            style={{ '--pl': p.colors.light, '--pd': p.colors.dark } as CSSProperties}
          >
            <figure className="pw-figure">
              <CoverMedia cover={p.cover} motionOK={motionOK} />
              <figcaption className="pw-cap">
                <span className="pw-cap-title" style={titleStyle(p)}>
                  {p.title}
                </span>
              </figcaption>
            </figure>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// List: big default-face titles; preview reveals inline into the row's
// right-side space on hover/focus, capped to the text-row height.
// Titles only — no dates or summaries. Each row carries its Project's
// flip pair as vars (same rule as FeaturedCard/FeaturedCard.css: light OS
// uses light as wash, dark OS flips) for the hover colour sweep.
//
// Hover-commit: CSS transitions reverse mid-flight when the pointer
// leaves early, which reads as clunky on fast wipes. So rows are driven
// by an .is-active class instead of :hover — activation is instant,
// release waits until the entrance has had time to finish (plus the CSS
// linger), so every sweep runs whole and wipes cascade row-to-row.
const ENTER_MS = 1050;

function ListView({ motionOK }: { motionOK: boolean }) {
  // A set, not a single slug: a fast wipe leaves earlier rows finishing
  // their sweep while the new row starts its own (cascade, not cut-off).
  const [active, setActive] = useState<ReadonlySet<string>>(new Set());
  const timers = useRef(new Map<string, number>());
  const since = useRef(new Map<string, number>());

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current.clear();
    },
    [],
  );

  const clearTimer = (slug: string): void => {
    const t = timers.current.get(slug);
    if (t !== undefined) {
      window.clearTimeout(t);
      timers.current.delete(slug);
    }
  };

  const activate = (slug: string): void => {
    clearTimer(slug);
    if (!since.current.has(slug)) since.current.set(slug, Date.now());
    setActive((cur) => {
      if (cur.has(slug)) return cur;
      const next = new Set(cur);
      next.add(slug);
      return next;
    });
  };

  const deactivate = (slug: string): void => {
    const started = since.current.get(slug) ?? Date.now();
    const remaining = Math.max(0, ENTER_MS - (Date.now() - started));
    clearTimer(slug);
    timers.current.set(
      slug,
      window.setTimeout(() => {
        timers.current.delete(slug);
        since.current.delete(slug);
        setActive((cur) => {
          if (!cur.has(slug)) return cur;
          const next = new Set(cur);
          next.delete(slug);
          return next;
        });
      }, remaining),
    );
  };

  return (
    <ol className="pw-list">
      {projects.map((p) => (
        <li key={p.slug} className="pw-item">
          <Link
            to={`/project/${p.slug}`}
            className={`pw-row${active.has(p.slug) ? ' is-active' : ''}`}
            style={{ '--pl': p.colors.light, '--pd': p.colors.dark } as CSSProperties}
            onMouseEnter={() => activate(p.slug)}
            onMouseLeave={() => deactivate(p.slug)}
            onFocus={() => activate(p.slug)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) deactivate(p.slug);
            }}
          >
            <span className="pw-name">{p.title}</span>
            <span className="pw-preview" aria-hidden="true">
              <CoverMedia cover={p.cover} active={active.has(p.slug)} motionOK={motionOK} />
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

// Both views read the same manifest — a toggle, not two pages. The
// choice persists in localStorage so coming back (refresh, back-nav,
// header link) lands on the last-used view.
const VIEW_KEY = 'pw-view';

export default function Projects() {
  // Gallery captions render in each Project's display face (same as the
  // Home Selected cards) — the faces load with this page.
  useProjectFonts(projects);
  const motionOK = useMotionSafeVideo();
  const [view, setView] = useState<'gallery' | 'list'>(() =>
    typeof window !== 'undefined' && window.localStorage.getItem(VIEW_KEY) === 'list'
      ? 'list'
      : 'gallery',
  );
  const pick = (next: 'gallery' | 'list'): void => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Private mode etc: selection just doesn't persist.
    }
  };
  return (
    <main className="page page-projects pw">
      <h1 className="pw-sr">All projects</h1>
      <div className="pw-toggle" role="group" aria-label="View">
        <button
          type="button"
          className={view === 'gallery' ? 'is-active' : ''}
          aria-pressed={view === 'gallery'}
          onClick={() => pick('gallery')}
        >
          Gallery
        </button>
        <button
          type="button"
          className={view === 'list' ? 'is-active' : ''}
          aria-pressed={view === 'list'}
          onClick={() => pick('list')}
        >
          List
        </button>
      </div>
      {view === 'gallery' ? <GalleryView motionOK={motionOK} /> : <ListView motionOK={motionOK} />}
    </main>
  );
}
