import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import './ViewMore.css';

// ViewMore — skeleton port of experiments/view-more/index.html.
// Panel (meta + thumb grid + see-all tile) renders in place at the foot of
// WORK; the floater pill is portalled to document.body so no clip/transform
// ancestor (notably ShrinkReveal) can trap its fixed positioning.
//
// Structure/aesthetics only: `items` are placeholder grey boxes until real
// non-selected projects land in the manifest. At that point cells take the
// FeaturedCard media pattern (thumb poster, preload=none, saveData guard).

export type ViewMoreItem = {
  slug: string;
  label: string;
};

type ViewMoreProps = {
  items: ViewMoreItem[];
  /** Ref of the WORK section: the pill floats while it is on screen. */
  zoneRef: RefObject<HTMLElement | null>;
};

// Grey-box rhythm for the masonry — cycles 4/5, 4/3, 1/1, 3/4.
function ratioClass(index: number): string {
  return `ph-r${(index % 4) + 1}`;
}

export function ViewMore({ items, zoneRef }: ViewMoreProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [pillVisible, setPillVisible] = useState(false);
  const count = String(items.length).padStart(2, '0');

  useEffect(() => {
    const panel = panelRef.current;
    const grid = gridRef.current;
    const zone = zoneRef.current;
    if (!panel || !grid || !zone || typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      grid.classList.add('in');
      return;
    }
    let inWork = false;
    let panelHere = false;
    const sync = () => {
      // Never show past the collage: once the panel's top has scrolled
      // above the viewport the user is past it — even while WORK's bottom
      // padding keeps the zone observer intersecting (threshold 0 fires on
      // any single pixel). Below the panel (top > viewport) the pill shows
      // as before; above it, it stays hidden.
      const pastPanel = panel.getBoundingClientRect().top < 0;
      setPillVisible(inWork && !panelHere && !pastPanel);
    };
    const zoneObs = new IntersectionObserver(
      (es) => {
        inWork = es[0].isIntersecting;
        sync();
      },
      { threshold: 0 },
    );
    const panelObs = new IntersectionObserver(
      (es) => {
        panelHere = es[0].isIntersecting;
        sync();
      },
      { threshold: 0.2 },
    );
    const gridObs = new IntersectionObserver(
      (es, o) => {
        if (es[0].isIntersecting) {
          grid.classList.add('in');
          o.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    zoneObs.observe(zone);
    panelObs.observe(panel);
    gridObs.observe(grid);
    return () => {
      zoneObs.disconnect();
      panelObs.disconnect();
      gridObs.disconnect();
    };
  }, [zoneRef]);

  return (
    <>
      <div className="dock-panel" ref={panelRef}>
        <div className="dock-grid" ref={gridRef}>
          {items.map((item, i) => (
            <Link
              key={item.slug}
              className="dock-cell"
              to={`/project/${item.slug}`}
              aria-label={item.label}
            >
              <span className={`ph ${ratioClass(i)}`} aria-hidden="true">
                {item.label}
              </span>
            </Link>
          ))}
          <Link className="dock-tile" to="/projects">
            <span className="tile-inner">
              <span className="row">
                <span>see all</span>
                <span className="arrow" aria-hidden="true">
                  →
                </span>
              </span>
              <small>({count}) more inside</small>
            </span>
          </Link>
        </div>
      </div>
      {typeof document !== 'undefined' &&
        createPortal(
          <Link
            className={`dock-pill${pillVisible ? '' : ' off'}`}
            to="/projects"
            tabIndex={pillVisible ? 0 : -1}
            aria-hidden={!pillVisible}
          >
            <span className="pill-inner">
              <span>see all</span>{' '}
              <span className="arrow" aria-hidden="true">
                →
              </span>
            </span>
          </Link>,
          document.body,
        )}
    </>
  );
}
