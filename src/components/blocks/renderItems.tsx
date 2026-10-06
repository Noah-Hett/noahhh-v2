import type { ReactNode } from 'react';
import type { ProjectBlock } from '../../content/projects.ts';
import type { BodyItem } from './pairing.ts';
import PairRow from './PairRow.tsx';
import GalleryBlock from './GalleryBlock.tsx';
import Showcase from './Showcase.tsx';

// Stable keys from content identity (id / for / src / href) with the index
// as a uniqueness suffix — duplicates stay unique, reorder-safe for static
// author-owned content. Falls back to index only when nothing else exists.
function singleKey(block: ProjectBlock, index: number): string {
  switch (block.kind) {
    case 'text':
      return `text:${block.for ?? block.body.slice(0, 24)}:${index}`;
    case 'image':
      return `image:${block.id ?? block.src}:${index}`;
    case 'pdf':
      return `pdf:${block.href}:${index}`;
    case 'model3d':
      return `model3d:${block.src}:${index}`;
    case 'gallery':
      return `gallery:${block.images[0]?.src ?? 'empty'}:${block.images.length}:${index}`;
    case 'showcase':
      return `showcase:${block.image.src}:${index}`;
  }
}

function itemKey(item: BodyItem, index: number): string {
  if (item.kind === 'pair') {
    return `pair:${item.copy.for ?? index}:${item.visual.id ?? item.visual.src}`;
  }
  return singleKey(item.block, index);
}

export function renderItems(items: BodyItem[]): ReactNode {
  return items.map((item, i) =>
    item.kind === 'pair' ? (
      <li key={itemKey(item, i)} className="pair-item">
        <PairRow copy={item.copy} visual={item.visual} flip={item.flip} />
      </li>
    ) : (
      <li key={itemKey(item, i)}>
        {item.block.kind === 'text' && <p>{item.block.body}</p>}
        {item.block.kind === 'image' && (
          <img
            src={item.block.src}
            alt={item.block.alt}
            width={item.block.width}
            height={item.block.height}
            loading="lazy"
            decoding="async"
          />
        )}
        {item.block.kind === 'pdf' && (
          <p>
            <a href={item.block.href} target="_blank" rel="noreferrer">
              View {item.block.label} (PDF, opens in new tab)
            </a>
          </p>
        )}
        {item.block.kind === 'model3d' && (
          <p>
            <a href={item.block.src}>View 3D: {item.block.label}</a> (viewer lands per Round 2)
          </p>
        )}
        {item.block.kind === 'gallery' && (
          <GalleryBlock images={item.block.images} caption={item.block.caption} />
        )}
        {item.block.kind === 'showcase' && <Showcase block={item.block} />}
      </li>
    ),
  );
}
