import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useIsMobile } from '../../utils/useIsMobile.ts';
import './ViewMore.css';

// ViewMore — skeleton port of experiments/view-more/index.html.
// Panel (meta + thumb grid + see-all tile) renders in place at the foot of
// WORK; the floater pill is portalled to document.body so no clip/transform
// ancestor (notably ShrinkReveal) can trap its fixed positioning.
//
// Cells are Project photos — plain images, not links (a photo that went
// anywhere read as "open this Project"). The see-all tile is the only
// link: it leads to All work.
//
// Masonry is explicit flex columns, NOT CSS multi-column: WebKit (iOS
// Safari) clips and mis-hit-tests clip-path/filter children inside
// column fragments, which cut the see-all tile off and made it untappable.
// Items go to the shortest column (by aspect ratio) so columns balance;
// the tile goes last into whichever column is shortest then.

export type ViewMoreItem = {
  slug: string;
  title: string;
  src: string;
  width: number;
  height: number;
};

type ViewMoreProps = {
  items: ViewMoreItem[];
  /** Ref of the WORK section: the pill floats while it is on screen. */
  zoneRef: RefObject<HTMLElement | null>;
};

type Placed = { item: ViewMoreItem; index: number };

function distribute(items: ViewMoreItem[], count: number): { cols: Placed[][]; tileCol: number } {
  const cols: Placed[][] = Array.from({ length: count }, () => []);
  const heights = new Array<number>(count).fill(0);
  const shortest = () => heights.indexOf(Math.min(...heights));
  items.forEach((item, index) => {
    const c = shortest();
    cols[c].push({ item, index });
    heights[c] += item.height / item.width;
  });
  return { cols, tileCol: shortest() };
}

export function ViewMore({ items, zoneRef }: ViewMoreProps) {
  // Column count mirrors the old CSS breakpoints: 4 above 1024px, 3 below.
  const narrow = useIsMobile(1024);
  const { cols, tileCol } = useMemo(() => distribute(items, narrow ? 3 : 4), [items, narrow]);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [pillVisible, setPillVisible] = useState(false);

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
          {cols.map((col, c) => (
            <div className="dock-col" key={c}>
              {col.map(({ item, index }) => (
                <div key={item.src} className="dock-cell">
                  <img
                    className="dock-thumb"
                    src={item.src}
                    alt=""
                    width={item.width}
                    height={item.height}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    style={{ transitionDelay: `${(index * 0.08).toFixed(2)}s` }}
                  />
                </div>
              ))}
              {c === tileCol && (
                <Link className="dock-tile" to="/projects">
                  <span className="tile-inner">
                    <span className="tile-arrow" aria-hidden="true">
                      →
                    </span>
                    <span className="tile-label">See all</span>
                  </span>
                </Link>
              )}
            </div>
          ))}
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
