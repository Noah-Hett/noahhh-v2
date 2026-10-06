import { useLayoutEffect, useRef, useState } from 'react';
import type { ImageBlock, TextBlock } from './pairing.ts';
import type { VarStyle } from './cssVars.ts';

// Pair height cap: the visual may stand at most --pair-cap x its copy's
// rendered height, shrinking narrower to preserve aspect (never cropped). The copy
// height is measured live (ResizeObserver tracks resizes + webfont swaps)
// into --pair-copy-h on the row; CSS does the rest. Desktop rows only —
// stacked mobile keeps natural full-width visuals (see ProjectPage.css).
export default function PairRow({
  copy,
  visual,
  flip,
}: {
  copy: TextBlock;
  visual: ImageBlock;
  flip: boolean;
}) {
  const copyRef = useRef<HTMLParagraphElement>(null);
  const [copyHeight, setCopyHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = copyRef.current;
    if (!el) return;
    setCopyHeight(el.offsetHeight);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setCopyHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [copy.body]);

  const ratio = visual.height > 0 ? visual.width / visual.height : 1;
  return (
    <div
      className={flip ? 'pair pair-flip' : 'pair'}
      data-measured={copyHeight !== null ? 'true' : undefined}
      style={
        {
          '--pair-ratio': `${ratio}`,
          ...(copyHeight !== null ? { '--pair-copy-h': `${copyHeight}px` } : {}),
        } as VarStyle
      }
    >
      <p ref={copyRef} className="pair-copy">
        {copy.body}
      </p>
      <div className="pair-visual">
        <img
          src={visual.src}
          alt={visual.alt}
          width={visual.width}
          height={visual.height}
          loading="lazy"
          decoding="async"
        />
      </div>
    </div>
  );
}
