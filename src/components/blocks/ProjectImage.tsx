import type { CSSProperties } from 'react';
import { MEDIA_VARIANTS } from '../../content/mediaVariants.ts';

// Project body image: AVIF with a WebP fallback (iOS 15 and older can't
// decode AVIF) at every width the optimizer produced, so phones pull the
// 800w file instead of 1600w. `sizes` is the rendered width in the block's
// layout. The <picture> is display: contents (ProjectPage.css), so the
// <img> stays the layout box every block's CSS already targets. Images
// without known variants render as a plain <img>.
export default function ProjectImage({
  image,
  sizes,
  style,
}: {
  image: { src: string; alt: string; width: number; height: number };
  sizes: string;
  style?: CSSProperties;
}) {
  const v = MEDIA_VARIANTS.get(image.src);
  const set = (list: [string, number][]) => list.map(([url, w]) => `${url} ${w}w`).join(', ');
  // Fallback for browsers without <picture>/srcset support: the 1600w WebP
  // (decodes everywhere), else the authored src.
  const fallback = v?.webp.find(([, w]) => w === 1600)?.[0] ?? v?.webp.at(-1)?.[0] ?? image.src;
  const img = (
    <img
      src={fallback}
      alt={image.alt}
      width={image.width}
      height={image.height}
      loading="lazy"
      decoding="async"
      style={style}
    />
  );
  if (!v) return img;
  return (
    <picture className="pimg">
      <source type="image/avif" srcSet={set(v.avif)} sizes={sizes} />
      {v.webp.length > 0 && <source type="image/webp" srcSet={set(v.webp)} sizes={sizes} />}
      {img}
    </picture>
  );
}
