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
// Items are spread across columns (by aspect ratio) so the bottoms even out;
// the tile always closes the rightmost column.

export type ViewMoreItem = {
  slug: string;
  title: string;
  src: string;
  width: number;
  height: number;
  /** Thumbnail variants (`"url 480w, …"`); `src` is the fallback. */
  srcSetAvif?: string;
  srcSetWebp?: string;
};

// Cell width: 4 columns over the WORK gutter, 3 under 1024px.
const THUMB_SIZES = '(max-width: 1024px) 33vw, 25vw';

type ViewMoreProps = {
  items: ViewMoreItem[];
  /** Ref of the WORK section: the pill floats while it is on screen. */
  zoneRef: RefObject<HTMLElement | null>;
  /** Fetch every thumb now (low priority) instead of lazily. Home flips
      this once its intro has played, so they never compete with it. */
  eager?: boolean;
};

type Placed = { item: ViewMoreItem; index: number };

// Cached images can finish before onLoad is attached; catch those on mount.
function markIfLoaded(img: HTMLImageElement | null): void {
  if (img?.complete && img.naturalWidth > 0) img.classList.add('ready');
}

// Column heights in column-widths: each cell is its aspect ratio plus a
// rough gap allowance (gap / column width across breakpoints).
const CELL_GAP = 0.08;

function distribute(items: ViewMoreItem[], count: number): { cols: Placed[][]; tileCol: number } {
  // The tile always closes the rightmost column, so it sits in the same
  // place at every breakpoint. Its minimum square (height 1) is booked
  // there up front; in CSS it then stretches to finish flush with the
  // tallest column, so that column never needs to balance exactly.
  const tileCol = count - 1;
  const ratios = items.map((item) => item.height / item.width + CELL_GAP);
  const base = (): number[] => Array.from({ length: count }, (_, c) => (c === tileCol ? 1 + CELL_GAP : 0));

  // Greedy shortest-column fill: the fallback for long lists.
  let best = items.map(() => 0);
  {
    const h = base();
    best = ratios.map((r) => {
      const c = h.indexOf(Math.min(...h));
      h[c] += r;
      return c;
    });
  }
  // Small lists (the curated collage is 8 photos): search every assignment
  // and keep the most even column bottoms. Display order is kept within
  // each column. Photo columns are interchangeable, so only canonical
  // assignments are walked (a new photo column opens only left-to-right),
  // which skips the mirror-image duplicates — this runs during first
  // render, so it stays allocation-free and well under a millisecond.
  if (items.length <= 9) {
    // Photo columns should end level; the tile column only counts when it
    // overshoots (a short one is filled by the stretching tile). Stretch
    // itself is lightly penalised so the tile stays close to square.
    const spread = (h: number[]): number => {
      let top = -Infinity;
      let low = Infinity;
      for (let c = 0; c < tileCol; c++) {
        if (h[c] > top) top = h[c];
        if (h[c] < low) low = h[c];
      }
      const t = h[tileCol];
      return top - low + (t > top ? t - top : (top - t) * 0.25);
    };
    // The tile always shares its column with at least one photo (given
    // enough photos): left alone it stretches into a full-height panel.
    const tileEmpty = (cs: number[]): boolean => items.length >= count && !cs.includes(tileCol);
    const h0 = base();
    best.forEach((c, i) => (h0[c] += ratios[i]));
    let bestSpread = tileEmpty(best) ? Infinity : spread(h0);
    const pick = new Array<number>(items.length).fill(0);
    const h = base();
    const walk = (i: number, opened: number): void => {
      if (i === items.length) {
        if (tileEmpty(pick)) return;
        const s = spread(h);
        if (s < bestSpread - 1e-9) {
          bestSpread = s;
          best = pick.slice();
        }
        return;
      }
      const lastPhoto = Math.min(opened, tileCol - 1);
      for (let c = 0; c <= lastPhoto; c++) {
        pick[i] = c;
        h[c] += ratios[i];
        walk(i + 1, c === opened ? opened + 1 : opened);
        h[c] -= ratios[i];
      }
      pick[i] = tileCol;
      h[tileCol] += ratios[i];
      walk(i + 1, opened);
      h[tileCol] -= ratios[i];
    };
    walk(0, 0);
  }

  const cols: Placed[][] = Array.from({ length: count }, () => []);
  best.forEach((c, index) => cols[c].push({ item: items[index], index }));
  return { cols, tileCol };
}

export function ViewMore({ items, zoneRef, eager = false }: ViewMoreProps) {
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
                  <picture>
                    {item.srcSetAvif && <source type="image/avif" srcSet={item.srcSetAvif} sizes={THUMB_SIZES} />}
                    {item.srcSetWebp && <source type="image/webp" srcSet={item.srcSetWebp} sizes={THUMB_SIZES} />}
                    {/* Lazy until `eager`, then all at low priority (the
                        whole set is ~110–340KB), so the photos are in cache
                        well before the collage scrolls in. Each thumb also
                        only wipes in once loaded (.ready) — never an empty
                        box. */}
                    <img
                      ref={markIfLoaded}
                      className="dock-thumb"
                      src={item.src}
                      alt=""
                      width={item.width}
                      height={item.height}
                      loading={eager ? 'eager' : 'lazy'}
                      fetchPriority="low"
                      decoding="async"
                      draggable={false}
                      onLoad={(e) => e.currentTarget.classList.add('ready')}
                      style={{ transitionDelay: `${(index * 0.08).toFixed(2)}s` }}
                    />
                  </picture>
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
