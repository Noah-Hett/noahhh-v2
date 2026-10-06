import type { ProjectBlock } from '../../content/projects.ts';
import type { VarStyle } from './cssVars.ts';

type GalleryBlockType = Extract<ProjectBlock, { kind: 'gallery' }>;

// Gallery balancing (Phase 4+): partition N images into full-bleed rows so
// no cell ever orphans — 1 full, 2 pair, 3 trio, 4 quartet, 5 as 3+2,
// 8 as 4+4, larger sets as threes with any remainder-1 borrowing a three
// into two pairs (7 as 3+4, 10 as 3+3+2+2). Returns one row-size per image.
// Mobile re-partitions each desktop row into halves, a leftover single
// going full width (deliberate final image).
export function balanceRows(count: number): { spans: number[]; mobile: number[] } {
  const rows: number[] = [];
  if (count <= 4) {
    if (count > 0) rows.push(count);
  } else if (count === 8) {
    rows.push(4, 4);
  } else {
    let rest = count;
    while (rest > 4) {
      rows.push(3);
      rest -= 3;
    }
    // Loop always lands on 2, 3, or 4 — never 1 — so rows stay orphan-free.
    if (rest > 0) {
      rows.push(rest);
    }
  }
  const spans: number[] = [];
  const mobile: number[] = [];
  for (const row of rows) {
    if (row === 1) {
      spans.push(12);
      mobile.push(12);
    } else if (row === 2) {
      spans.push(6, 6);
      mobile.push(6, 6);
    } else if (row === 3) {
      spans.push(4, 4, 4);
      mobile.push(6, 6, 12);
    } else {
      spans.push(3, 3, 3, 3);
      mobile.push(6, 6, 6, 6);
    }
  }
  return { spans, mobile };
}

export default function GalleryBlock({
  images,
  caption,
}: {
  images: GalleryBlockType['images'];
  caption?: string;
}) {
  if (images.length === 0) return null;
  const { spans, mobile } = balanceRows(images.length);
  return (
    <figure className="gallery">
      <div className="gallery-grid">
        {images.map((image, i) => (
          <img
            key={`${image.src}::${i}`}
            src={image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
            loading="lazy"
            decoding="async"
            style={{ '--span': spans[i] ?? 12, '--span-m': mobile[i] ?? 12 } as VarStyle}
          />
        ))}
      </div>
      {caption !== undefined && <figcaption className="gallery-caption">{caption}</figcaption>}
    </figure>
  );
}
