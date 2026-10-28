import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import './ViewMore.css';

// ViewMore — skeleton port of experiments/view-more/index.html.
// Panel (meta + thumb grid + see-all tile) renders in place at the foot of
// WORK; the floater pill is portalled to document.body so no clip/transform
// ancestor (notably ShrinkReveal) can trap its fixed positioning.
//
// Cells are Project images (each links to its Project); the masonry
// rhythm comes from the images' own aspect ratios, reserved via
// width/height so lazy loads never shift the column flow.

export type ViewMoreItem = {
  slug: string;
  title: string;
  src: string;
  width: number;
  height: number;
};

type ViewMoreProps = {
  items: ViewMoreItem[];
  /** Project count shown on the see-all tile. */
  total: number;
  /** Ref of the WORK section: the pill floats while it is on screen. */
  zoneRef: RefObject<HTMLElement | null>;
};

export function ViewMore({ items, total, zoneRef }: ViewMoreProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [pillVisible, setPillVisible] = useState(false);
  const count = String(total).padStart(2, '0');

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
          {items.map((item) => (
            <Link
              key={item.src}
              className="dock-cell"
              to={`/project/${item.slug}`}
              aria-label={item.title}
            >
              <img
                className="dock-thumb"
                src={item.src}
                alt=""
                width={item.width}
                height={item.height}
                loading="lazy"
                decoding="async"
                draggable={false}
              />
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
              <small>({count}) projects</small>
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
