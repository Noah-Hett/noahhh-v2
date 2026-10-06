import { useLayoutEffect, useRef, useState } from 'react';
import type { ProjectBlock } from '../../content/projects.ts';
import type { VarStyle } from './cssVars.ts';

type ShowcaseBlockType = Extract<ProjectBlock, { kind: 'showcase' }>;

// Graduated outcome composition (strict allowlist): wide visual + narrow
// copy + optional uniform detail strip, one authoring unit. No pairing,
// no measurement — the tall visual stands as Figma draws it.
// Detail strip: justified filmstrip — row height derives from the images
// (H = (row width − gaps) ÷ summed aspects) so the row always fills
// exactly with constant gaps and natural aspects. No cap: portrait-heavy
// sets get tall rows. When the derived height would drop below the floor,
// the strip wraps to left-aligned uniform rows at floor height instead of
// shrinking further. Width measured live (ResizeObserver).
export const STRIP_FLOOR = 120;

function ShowcaseStrip({ items }: { items: ShowcaseBlockType['strip'] }) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [rowWidth, setRowWidth] = useState<number | null>(null);
  const [gap, setGap] = useState<number>(60);

  useLayoutEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const measure = (): void => {
      setRowWidth(el.clientWidth);
      const gapPx = Number.parseFloat(getComputedStyle(el).columnGap);
      if (Number.isFinite(gapPx)) setGap(gapPx);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const list = items ?? [];
  const aspects = list.map((item) => (item.height > 0 ? item.width / item.height : 1));
  const derived =
    rowWidth !== null && list.length > 0
      ? (rowWidth - gap * (list.length - 1)) / aspects.reduce((a, b) => a + b, 0)
      : null;
  const singleRow = derived !== null && derived >= STRIP_FLOOR;

  return (
    <div
      ref={stripRef}
      className="showcase-strip"
      role="list"
      aria-label="Detail views"
      style={singleRow && derived !== null ? ({ '--strip-h': `${derived}px` } as VarStyle) : undefined}
    >
      {list.map((item, i) => (
        <div key={`${item.src}::${i}`} className="showcase-cell" role="listitem">
          <img
            src={item.src}
            alt={item.alt}
            width={item.width}
            height={item.height}
            loading="lazy"
            decoding="async"
          />
        </div>
      ))}
    </div>
  );
}

// Graduated outcome composition (strict allowlist): wide visual + narrow
// copy + optional uniform detail strip, one authoring unit. No pairing —
// the tall visual stands as Figma draws it.
export default function Showcase({ block }: { block: ShowcaseBlockType }) {
  return (
    <div className="showcase">
      <div className="showcase-main">
        <div className="showcase-visual">
          <img
            src={block.image.src}
            alt={block.image.alt}
            width={block.image.width}
            height={block.image.height}
            loading="lazy"
            decoding="async"
          />
        </div>
        <p className="showcase-copy">{block.body}</p>
      </div>
      {block.strip !== undefined && block.strip.length > 0 && (
        <ShowcaseStrip items={block.strip} />
      )}
    </div>
  );
}
