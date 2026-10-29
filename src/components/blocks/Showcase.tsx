import { useLayoutEffect, useRef, useState } from 'react';
import type { ProjectBlock } from '../../content/projects.ts';
import type { VarStyle } from './cssVars.ts';
import ProjectImage from './ProjectImage.tsx';

type ShowcaseBlockType = Extract<ProjectBlock, { kind: 'showcase' }>;

// Graduated outcome composition (strict allowlist): wide visual + narrow
// copy + optional uniform detail strip, one authoring unit. No pairing,
// no measurement — the tall visual stands as Figma draws it.
// Detail strip: justified filmstrip — row height derives from the images
// (H = (row width − gaps) ÷ summed aspects) so the row always fills
// exactly with constant gaps and natural aspects. No cap: portrait-heavy
// sets get tall rows. Always one row — on narrow screens the strip just
// gets shorter. Width measured live (ResizeObserver).

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
  // Floored to the hundredth so sub-pixel rounding never pushes the last
  // cell past the row.
  const derived =
    rowWidth !== null && list.length > 0
      ? Math.floor(((rowWidth - gap * (list.length - 1)) / aspects.reduce((a, b) => a + b, 0)) * 100) / 100
      : null;

  return (
    <div
      ref={stripRef}
      className="showcase-strip"
      role="list"
      aria-label="Detail views"
      style={derived !== null ? ({ '--strip-h': `${derived}px` } as VarStyle) : undefined}
    >
      {list.map((item, i) => (
        <div key={`${item.src}::${i}`} className="showcase-cell" role="listitem">
          <ProjectImage image={item} sizes="(max-width: 1150px) 50vw, 20vw" />
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
          <ProjectImage image={block.image} sizes="(max-width: 1150px) 100vw, 80vw" />
        </div>
        <p className="showcase-copy">{block.body}</p>
      </div>
      {block.strip !== undefined && block.strip.length > 0 && (
        <ShowcaseStrip items={block.strip} />
      )}
    </div>
  );
}
