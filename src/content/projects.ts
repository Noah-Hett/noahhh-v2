// Single source of truth for all Projects (ADR-0002).
// Home "Selected" = selected === true (exactly 3).
// Bodies are per-slug group lists, rendered inside ProjectLayout.

export type ProjectBlock =
  // Pairing contract: a visual carries a human-text `id`
  // (e.g. 'clock-diagram'), unique across the whole Project entry. A copy
  // unit points at it with `for`. Lookup is same-group only: a paragraph
  // in Process can only reference a visual in Process — each visual is
  // designed for its own portion of the page. Source order (position in
  // `blocks`) is the truth for reading order and small-screen stacking;
  // desktop side-by-side is visual only.
  | { kind: 'text'; body: string; for?: string }
  | { kind: 'image'; id?: string; src: string; alt: string; width: number; height: number }
  | { kind: 'pdf'; href: string; label: string }
  | { kind: 'model3d'; src: string; label: string }
  | { kind: 'gallery'; images: { src: string; alt: string; width: number; height: number }[]; caption?: string }
  // Graduated composition (strict allowlist): the outcome shape — wide
  // visual + narrow copy + optional uniform detail strip, all one
  // authoring unit. Self-contained: no for/id, nothing to validate.
  | {
      kind: 'showcase';
      image: { src: string; alt: string; width: number; height: number };
      body: string;
      strip?: { src: string; alt: string; width: number; height: number }[];
    };

export interface ProjectColors {
  /** Light-mode canvas. Flipped with `dark` under prefers-color-scheme: dark. */
  light: string;
  dark: string;
}

export interface ProjectFont {
  /** Display family for this Project's title (h1 + card/row titles). */
  family: string;
  /** Always local: /fonts/projects/<slug>/Name.woff2 (never a Google URL). */
  src: string;
  fallback?: string;
}

export type ProjectCover =
  | { kind: 'image'; src: string; alt: string; width: number; height: number }
  // Hero video (the ONLY video on a Project page): muted looping autoplay
  // with pause + unmute controls. Poster is local and load-bearing — LCP
  // image here, card thumbnail on Home / All Projects. MP4 lives on R2.
  | {
      kind: 'video';
      src: string;
      poster: string;
      alt: string;
      width: number;
      height: number;
    };

export interface ProjectCollaborator {
  name: string;
  initials?: string;
  /** LinkedIn URL (or other profile). Rendered as a link when present. */
  url?: string;
}

export interface ProjectMeta {
  /** Free string, month + year, e.g. "March 2024". */
  date: string;
  /** What was made. */
  scope: string;
  /** Your responsibility. */
  role: string;
  collaborators: ProjectCollaborator[];
}

export interface ChallengeGroup {
  id: 'challenge';
  heading: string;
  /** The brief: 1–2 sentences introducing the Project. Renders in the
      intro row beside meta — this IS the challenge section's voice. */
  summary: string;
  meta: ProjectMeta;
  blocks: ProjectBlock[];
}

export interface BodyGroup {
  id: 'process' | 'outcome';
  heading: string;
  blocks: ProjectBlock[];
}

export type ProjectGroup = ChallengeGroup | BodyGroup;

export interface Project {
  slug: string;
  title: string;
  tags: string[];
  selected: boolean;
  colors: ProjectColors;
  font: ProjectFont;
  cover: ProjectCover;
  groups: ProjectGroup[];
}

/** The challenge group carries summary + meta. Exactly one per Project
    (enforced by validateProject). */
export function challengeOf(project: Project): ChallengeGroup {
  const found = project.groups.find((g): g is ChallengeGroup => g.id === 'challenge');
  if (!found) throw new Error(`Project "${project.slug}" has no challenge group.`);
  return found;
}

export function defaultGroups(): ProjectGroup[] {
  return [
    {
      id: 'challenge',
      heading: 'Challenge',
      summary: 'Brief goes here.',
      meta: { date: 'January 2026', scope: 'TBD', role: 'TBD', collaborators: [] },
      blocks: [],
    },
    { id: 'process', heading: 'Process', blocks: [] },
    { id: 'outcome', heading: 'Outcome', blocks: [] },
  ];
}

function placeholder(
  slug: string,
  title: string,
  light: string,
  dark: string,
): Project {
  const groups = defaultGroups();
  const challenge = groups.find((g): g is ChallengeGroup => g.id === 'challenge');
  if (challenge) {
    challenge.summary = 'Selected placeholder — real project lands later.';
    challenge.meta = { date: 'January 2026', scope: 'TBD', role: 'TBD', collaborators: [] };
  }
  return {
    slug,
    title,
    tags: [],
    selected: true,
    colors: { light, dark },
    font: { family: 'Geist', src: '/fonts/Geist-Regular.ttf', fallback: 'system-ui, sans-serif' },
    cover: {
      kind: 'image',
      src: '/portrait/portrait-800.webp',
      alt: `${title} cover placeholder`,
      width: 800,
      height: 755,
    },
    groups,
  };
}

// Demo body for project-1: dressed test page mirroring the GIZMOPHONE
// Figma flow (challenge / process pairs / gallery / outcome) with
// placeholder copy + local SVG fixtures. TEMPORARY — real content lands
// via the add-project-content skill. Identity (title/summary/cover/
// selected) stays placeholder-shaped so Home is unaffected.
function demoGroups(): ProjectGroup[] {
  return [
    {
      id: 'challenge',
      heading: 'Challenge',
      summary:
        'The brief asked for an instrument that could be learned in seconds and performed in minutes — a single striking gesture standing in for years of practice. Everything that follows is an attempt to make that first touch feel inevitable.',
      meta: { date: 'January 2026', scope: 'TBD', role: 'TBD', collaborators: [] },
      blocks: [],
    },
    {
      id: 'process',
      heading: 'Process',
      blocks: [
        {
          kind: 'text',
          for: 'clock-diagram',
          body: 'The timing core came first. A clock that breathes rather than ticks: each revolution stretches slightly at the top of the bar, so loops feel played rather than programmed. Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
        },
        {
          kind: 'image',
          id: 'clock-diagram',
          src: '/placeholders/diagram-clock.svg',
          alt: 'Placeholder timing diagram showing two clock hands on concentric dials',
          width: 700,
          height: 700,
        },
        {
          kind: 'text',
          for: 'bench',
          body: 'From the diagram to the bench. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua — enclosures were mocked in card before a single piece of hardwood was cut, and every control was placed by reach, not by symmetry.',
        },
        {
          kind: 'image',
          id: 'bench',
          src: '/placeholders/process-bench.svg',
          alt: 'Placeholder illustration of components arranged on a workbench',
          width: 1200,
          height: 800,
        },
        {
          kind: 'gallery',
          caption:
            'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris. The hand-feel pass took a full week: knob weights, throw distances, the exact resistance of the main dial. Nothing here survived first contact unchanged.',
          images: [
            {
              src: '/placeholders/gallery-a.svg',
              alt: 'Placeholder process photo A showing a framed assembly step',
              width: 800,
              height: 600,
            },
            {
              src: '/placeholders/gallery-b.svg',
              alt: 'Placeholder process photo B showing a circular component detail',
              width: 700,
              height: 900,
            },
            {
              src: '/placeholders/gallery-c.svg',
              alt: 'Placeholder process photo C showing a finished sub-assembly',
              width: 800,
              height: 800,
            },
          ],
        },
      ],
    },
    {
      id: 'outcome',
      heading: 'Outcome',
      blocks: [
        {
          kind: 'showcase',
          image: {
            src: '/placeholders/outcome-wide.svg',
            alt: 'Placeholder wide shot of the finished piece on a table',
            width: 1400,
            height: 900,
          },
          body: 'Duis aute irure dolor in reprehenderit — a small run of finished pieces, each one played in by hand before it left the bench. What shipped was less an object than a first performance.',
          strip: [
            {
              src: '/placeholders/gallery-a.svg',
              alt: 'Placeholder detail A showing a framed assembly step',
              width: 800,
              height: 600,
            },
            {
              src: '/placeholders/diagram-clock.svg',
              alt: 'Placeholder detail of the timing diagram',
              width: 700,
              height: 700,
            },
            {
              src: '/placeholders/gallery-c.svg',
              alt: 'Placeholder detail C showing a finished sub-assembly',
              width: 800,
              height: 800,
            },
          ],
        },
      ],
    },
  ];
}

// Phase 5 reuse proof: project-2 dresses the SAME fixtures in a different
// arrangement — pair opens the process, a 2-image gallery follows, an
// unpaired paragraph and a strip-less showcase close it out. Zero CSS may
// change for this page to render correctly; if it doesn't, the system
// failed, not the content.
function proofGroups(): ProjectGroup[] {
  return [
    {
      id: 'challenge',
      heading: 'Challenge',
      summary:
        'A second brief with the same shelf of parts: prove the arrangement carries the variety, not the assets. Nothing here required a new Block, a new token, or a single line of CSS.',
      meta: { date: 'January 2026', scope: 'TBD', role: 'TBD', collaborators: [] },
      blocks: [],
    },
    {
      id: 'process',
      heading: 'Process',
      blocks: [
        {
          kind: 'text',
          for: 'bench-proof',
          body: 'Opening with the bench this time — same illustration, opposite narrative job. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.',
        },
        {
          kind: 'image',
          id: 'bench-proof',
          src: '/placeholders/process-bench.svg',
          alt: 'Placeholder illustration of components arranged on a workbench',
          width: 1200,
          height: 800,
        },
        {
          kind: 'gallery',
          caption: 'Two details, same fixtures, smaller ensemble.',
          images: [
            {
              src: '/placeholders/gallery-a.svg',
              alt: 'Placeholder process photo A showing a framed assembly step',
              width: 800,
              height: 600,
            },
            {
              src: '/placeholders/gallery-c.svg',
              alt: 'Placeholder process photo C showing a finished sub-assembly',
              width: 800,
              height: 800,
            },
          ],
        },
        {
          kind: 'text',
          body: 'A lone paragraph after the gallery, standing outside every composition — the standalone pattern still has to hold.',
        },
      ],
    },
    {
      id: 'outcome',
      heading: 'Outcome',
      blocks: [
        {
          kind: 'showcase',
          image: {
            src: '/placeholders/process-hands.svg',
            alt: 'Placeholder detail of hands at work on the piece',
            width: 800,
            height: 1000,
          },
          body: 'The strip-less showcase: same Block, optional tail absent. Duis aute irure dolor in reprehenderit.',
        },
      ],
    },
  ];
}

// GIZMOPHONE — first real Project (added via add-project-content skill).
// Cover is a video hero (R2 mp4 + local poster). Body SVGs ride as-is
// on R2; raster bodies are 1600w AVIF (cad: 800w, source narrower).
const gizmophone: Project = {
  slug: 'gizmophone',
  title: 'GIZMOPHONE',
  tags: [],
  selected: true,
  colors: { light: '#AFC8ED', dark: '#2D402F' },
  font: {
    family: 'Syne Mono',
    src: '/fonts/projects/gizmophone/SyneMono-Regular.otf',
    fallback: 'ui-monospace, monospace',
  },
  cover: {
    kind: 'video',
    src: 'https://media.noahhh.com/gizmophone/gizmophone.mp4',
    poster: '/posters/gizmophone/gizmophone-poster-800.avif',
    alt: 'GIZMOPHONE instrument in use',
    width: 1920,
    height: 1080,
  },
  groups: [
    {
      id: 'challenge',
      heading: 'Challenge',
      summary:
        'Creating a more fluid musical experience by challenging traditional musical notation. A device which relies on visual, and spacial awareness, as well as pattern recognition rather than arbitrary leading lines or bars.',
      meta: {
        date: 'December 2025',
        scope: 'interaction design, electronics, mechatronics',
        role: 'TBD',
        collaborators: [
          { name: 'Dermot Mooney', url: 'https://www.linkedin.com/in/dermot-mooney-a1160b323/' },
        ],
      },
      blocks: [],
    },
    {
      id: 'process',
      heading: 'Process',
      blocks: [
        {
          kind: 'text',
          for: 'clock-diagram',
          body: 'A regular ‘clock tick’ creates an intuitive metronome, where the summative removal or replacement of these ‘ticks’ can be used to create complex rhythmic patterns. This replaces abstract, linear musical bars with a rotation around a circle.',
        },
        {
          kind: 'image',
          id: 'clock-diagram',
          src: 'https://media.noahhh.com/gizmophone/Clock.svg',
          alt: 'Circular diagram of a clock face representing musical rhythm',
          width: 349,
          height: 350,
        },
        {
          kind: 'text',
          for: 'speed-dial',
          body: 'We can include speed by creating a manual interaction with the hand of our clock. When we spin the hand, we determine rotations per minute, and therefore the speed of the melody we play. If we need to rests or to change the tempo, we can manually grab the hand to reset it.',
        },
        {
          kind: 'image',
          id: 'speed-dial',
          src: 'https://media.noahhh.com/gizmophone/speed.svg',
          alt: 'Circular diagram representing rotational speed of GIZMOPHONE’s dial.',
          width: 349,
          height: 349,
        },
        {
          kind: 'text',
          for: 'colour-pegs',
          body: 'By replacing our ‘ticks’ with coloured pegs,  we can now visualise pitch and timbre, transforming a rhythmic clock into a melodic instrument. With 4 distinct colours, we are able to represent a Kick, Snare, Hi-hat, and Cymbal, or any other sound set.',
        },
        {
          kind: 'image',
          id: 'colour-pegs',
          src: 'https://media.noahhh.com/gizmophone/Colour.svg',
          alt: 'Circular diagram of GIZMOPHONE’s dial with multiple coloured ‘pegs’ distributed around the circle.',
          width: 349,
          height: 349,
        },
        {
          kind: 'gallery',
          caption:
            'To detect physical pegs as it spins, a colour sensor was mounted to the rotating disk. A clutch was created to enable the free rotation required for backspin and modification of tempo.',
          images: [
            {
              src: 'https://media.noahhh.com/gizmophone/construct-1600.avif',
              alt: 'GIZMOPHONE Clutch plates under construction',
              width: 6240,
              height: 4160,
            },
            {
              src: 'https://media.noahhh.com/gizmophone/test-1600.avif',
              alt: 'GIZMOPHONE prototype under test',
              width: 6240,
              height: 4160,
            },
            {
              src: 'https://media.noahhh.com/gizmophone/cad-800.avif',
              alt: 'cad model of an earlier iteration of the GIZMOPHONE internal assembly',
              width: 1137,
              height: 1896,
            },
          ],
        },
      ],
    },
    {
      id: 'outcome',
      heading: 'Outcome',
      blocks: [
        {
          kind: 'showcase',
          image: {
            src: 'https://media.noahhh.com/gizmophone/in-use-1600.avif',
            alt: 'GIZMOPHONE instrument in use',
            width: 6240,
            height: 4160,
          },
          body: 'A fully functional rotation-based synthesiser that responds to your touch. With a built-in speaker and volume tuning achieved through colour-coded dials, Gizmophone operates as a self-contained rhythmic jamming companion.',
          strip: [
            {
              src: 'https://media.noahhh.com/gizmophone/detail-1600.avif',
              alt: 'Close detail of the GIZMOPHONE Volume tuning knobs',
              width: 6240,
              height: 4160,
            },
            {
              src: 'https://media.noahhh.com/gizmophone/technicaldrawings.svg',
              alt: 'Technical drawings of the GIZMOPHONE',
              width: 837,
              height: 253,
            },
          ],
        },
        {
          kind: 'pdf',
          href: 'https://media.noahhh.com/gizmophone/gizmophonePDF.pdf',
          label: 'Full report',
        },
      ],
    },
  ],
};

export const projects: Project[] = [
  { ...placeholder('project-1', 'Project 1', '#E8E2D9', '#1E2A32'), groups: demoGroups() },
  gizmophone,
  placeholder('project-3', 'Project 3', '#E3DDEE', '#241F33'),
  // Demoted from Selected to hold 3/3 (gizmophone takes its slot).
  { ...placeholder('project-2', 'Project 2', '#DCE5DC', '#232B23'), groups: proofGroups(), selected: false },
];

export function getProject(slug: string | undefined): Project | undefined {
  const project = projects.find((p) => p.slug === slug);
  // Fail fast on bad pairing data: only the broken page throws, the rest
  // of the site keeps working. Static author-owned content — a dangling
  // reference or duplicate id is always a data error, never rendered.
  if (project) validateProject(project);
  return project;
}

export function getSelected(): Project[] {
  return projects.filter((p) => p.selected);
}

// Phase 0 pairing validation. Same-group only: `for` on a copy unit must
// match an image `id` in the same group; ids are human text, unique across
// the whole Project. Throws on duplicates, dangling references, and
// cross-group references — all three are data errors, never rendered.
export function validateProject(project: Project): void {
  const challenges = project.groups.filter((g) => g.id === 'challenge');
  if (challenges.length !== 1) {
    throw new Error(
      `Project "${project.slug}": expected exactly one challenge group, found ${challenges.length}.`,
    );
  }  const owners = new Map<string, string>(); // visual id -> group id
  for (const g of project.groups) {
    for (const b of g.blocks) {
      if (b.kind === 'image' && b.id !== undefined) {
        const owner = owners.get(b.id);
        if (owner !== undefined) {
          throw new Error(
            `Project "${project.slug}": duplicate visual id "${b.id}" (groups "${owner}" and "${g.id}"). ids must be unique across the whole Project.`,
          );
        }
        owners.set(b.id, g.id);
      }
    }
  }
  for (const g of project.groups) {
    for (const b of g.blocks) {
      if (b.kind === 'text' && b.for !== undefined) {
        const owner = owners.get(b.for);
        if (owner === undefined) {
          throw new Error(
            `Project "${project.slug}": copy references missing visual id "${b.for}" (group "${g.id}"). Dangling references are a data error.`,
          );
        }
        if (owner !== g.id) {
          throw new Error(
            `Project "${project.slug}": copy in group "${g.id}" references visual "${b.for}" from group "${owner}". References are same-group only.`,
          );
        }
      }
    }
  }
}

export function collaboratorInitials(c: ProjectCollaborator): string {
  if (c.initials) return c.initials;
  return c.name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
}
