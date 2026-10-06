import type { ProjectBlock } from '../../content/projects.ts';

export type TextBlock = Extract<ProjectBlock, { kind: 'text' }>;
export type ImageBlock = Extract<ProjectBlock, { kind: 'image' }>;

export type BodyItem =
  | { kind: 'single'; block: ProjectBlock }
  | { kind: 'pair'; copy: TextBlock; visual: ImageBlock; flip: boolean };

// Pure pairing: adjacent text/image carrying matching for/id become one
// pair item (flip assigned later in page order — see assignFlipsAcross).
// Everything else flows standalone. No side effects so the result is
// stable across re-renders.
export function collectItems(blocks: ProjectBlock[]): BodyItem[] {
  const items: BodyItem[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const n = blocks[i + 1];
    if (b.kind === 'text' && b.for !== undefined && n?.kind === 'image' && n.id === b.for) {
      items.push({ kind: 'pair', copy: b, visual: n, flip: false });
      i++;
    } else if (b.kind === 'image' && b.id !== undefined && n?.kind === 'text' && n.for === b.id) {
      items.push({ kind: 'pair', copy: n, visual: b, flip: false });
      i++;
    } else {
      items.push({ kind: 'single', block: b });
    }
  }
  return items;
}

// Alternation from pair position in page order (challenge Blocks first,
// then remaining groups). Takes the per-group lists in render order and
// returns new lists with flips set — pair 0 copy-right, pair 1 mirrored,
// and so on. Pure: same input always yields the same flips.
export function assignFlipsAcross(lists: BodyItem[][]): BodyItem[][] {
  let seen = 0;
  return lists.map((items) =>
    items.map((item) => (item.kind === 'pair' ? { ...item, flip: seen++ % 2 === 1 } : item)),
  );
}
