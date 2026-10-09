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
  /** Always local: /fonts/projects/<slug>/<Family>.<woff2|woff|otf|ttf> (never a Google URL). */
  src: string;
  fallback?: string;
}

export interface CoverVariant {
  /** One responsive variant of an image cover (local poster file). */
  src: string;
  /** Intrinsic width in px. Entries must strictly ascend; the first MUST
      equal the cover `src` (the everywhere-safe fallback). */
  width: number;
}

export type ProjectCover =
  | {
      kind: 'image';
      src: string;
      alt: string;
      width: number;
      height: number;
      /** Responsive variants for large surfaces (hero, featured cards).
          Thumbnails and gallery tiles keep using `src`. Explicit, never
          derived — every entry must exist as a committed poster file. */
      srcSet?: CoverVariant[];
    }
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

// BUSK RADIO — added via add-project-content skill.
// Cover is a video hero (R2 mp4 + local poster @00:13). Body PNGs are
// 1600w AVIF (back-bw: 800w, source narrower); body SVGs ride as-is on R2.
const buskRadio: Project = {
  slug: 'busk-radio',
  title: 'BUSK RADIO',
  tags: [],
  selected: true,
  colors: { light: '#FFE9ED', dark: '#CF3168' },
  font: {
    family: 'Londrina Solid',
    src: '/fonts/projects/busk-radio/LondrinaSolid-Black.ttf',
    fallback: 'system-ui, sans-serif',
  },
  cover: {
    kind: 'video',
    src: 'https://media.noahhh.com/busk-radio/buskradio.mp4',
    poster: '/posters/busk-radio/buskradio-poster-800.avif',
    alt: 'Busk Radio advert and demonstration',
    width: 1920,
    height: 1080,
  },
  groups: [
    {
      id: 'challenge',
      heading: 'Challenge',
      summary:
        'Fostering community connections amongst Buskers, Street Performers and their audiences.Creating a playful way to support buskers while minimising friction and enhancing audience experience.',
      meta: {
        date: 'June 2025',
        scope: 'Human Centred Design',
        role: 'User Research, UI/UX',
        collaborators: [
          { name: 'Joseph Birch', url: 'https://www.linkedin.com/in/joseph-birch-546683278/' },
          { name: 'Timothy Spawforth', url: 'https://www.linkedin.com/in/timothy-spawforth-80a992332/' },
          { name: 'Maxim Wolff', url: 'https://www.linkedin.com/in/maxim-wolff/' },
          { name: 'Will Purcell', url: 'https://www.linkedin.com/in/wepurcell/' },
        ],
      },
      blocks: [
        {
          kind: 'text',
          for: 'barriers',
          body: 'The problem: people don’t stop. We found that 52% of people said that they wouldn’t even interact with a busker due to these 3 key factors.',
        },
        {
          kind: 'image',
          id: 'barriers',
          src: 'https://media.noahhh.com/busk-radio/Group-241.svg',
          alt: 'Diagram listing 3 barriers to interaction: Social Barriers, Cash Decline and Time Constraints',
          width: 594,
          height: 530,
        },
        {
          kind: 'gallery',
          images: [
            {
              src: 'https://media.noahhh.com/busk-radio/quote1.svg',
              alt: '“I love listening to buskers but i never get the chance to stop when I’m commuting”',
              width: 422,
              height: 262,
            },
            {
              src: 'https://media.noahhh.com/busk-radio/quote2.svg',
              alt: '“I think members of the public are often scared to come and chat because they are worried about interrupting me.”',
              width: 427,
              height: 262,
            },
            {
              src: 'https://media.noahhh.com/busk-radio/quote3.svg',
              alt: '“I rarely carry cash and the card machines most buskers use don’t let me choose how much I want to donate.”',
              width: 419,
              height: 262,
            },
          ],
        },
      ],
    },
    {
      id: 'process',
      heading: 'Process',
      blocks: [
        {
          kind: 'text',
          for: 'research',
          body: 'Over four months, we worked closely with buskers, street performers, and audience members through interviews, surveys, and co-design workshops. This gave us a deep understanding of the problems our users face.',
        },
        {
          kind: 'image',
          id: 'research',
          src: 'https://media.noahhh.com/busk-radio/research-1600.avif',
          alt: 'Image collage showing on-the-street research and co-design workshops for Busk Radio',
          width: 2388,
          height: 1818,
        },
        {
          kind: 'gallery',
          caption:
            'By mapping the journeys of our key stakeholders, we identified donation as the central pain point. We set out to develop a system that breaks down social barriers, responds to the decline of cash, and reduces the time pressure on audience-busker interactions.',
          images: [
            {
              src: 'https://media.noahhh.com/busk-radio/journeymap.svg',
              alt: 'Busker and Audience Member journey map',
              width: 1385,
              height: 526,
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
          kind: 'gallery',
          caption:
            'Our solution: Busk Radio. A live music audio streaming device, that allows an audience member to tune in to a busker on the go. Busk Radio brings street performance to you, wherever you are going. A simple tap-in to connect, then On Air, Anywhere.',
          images: [
            {
              src: 'https://media.noahhh.com/busk-radio/app-hero-1600.avif',
              alt: 'Mockup of Busk Radio app, collaged with images of UI elements used in wallet screens',
              width: 2896,
              height: 2716,
            },
            {
              src: 'https://media.noahhh.com/busk-radio/devicehero-1600.avif',
              alt: 'Exploded Render of Busk Radio Tap Point, showing the internal electronics',
              width: 3024,
              height: 2516,
            },
          ],
        },
        {
          kind: 'text',
          for: 'payment',
          body: 'Busk Radio features a ‘gamified’ payment interface allowing users to have more control over their desired payment amount. Skeuomorphic elements feature heavily, creating a more personal and tangible experience, especially for a payment process.',
        },
        {
          kind: 'image',
          id: 'payment',
          src: 'https://media.noahhh.com/busk-radio/group-240-1600.avif',
          alt: 'Busk Radio App screens, demonstrating unique payment interface',
          width: 2046,
          height: 1972,
        },
        {
          kind: 'showcase',
          image: {
            src: 'https://media.noahhh.com/busk-radio/hero-1600.avif',
            alt: 'Busk Radio App and Tap Point interaction',
            width: 4084,
            height: 2296,
          },
          body: 'Busk Radio enables social connection over distance, allowing users to send donations, like or message a busker directly and even see contributions to a buskers goals.',
          strip: [
            {
              src: 'https://media.noahhh.com/busk-radio/frontgraphic.svg',
              alt: 'Vector graphic used on the busk radio tap point which indicates where to interact. It says "tap to listen"',
              width: 319,
              height: 320,
            },
            {
              src: 'https://media.noahhh.com/busk-radio/front-bw-1600.avif',
              alt: 'Busk Radio Tap Point final device prototype - front angle',
              width: 2400,
              height: 1628,
            },
            {
              src: 'https://media.noahhh.com/busk-radio/back-bw-800.avif',
              alt: 'Busk Radio Tap Point final device prototype - rear angle',
              width: 1396,
              height: 1628,
            },
          ],
        },
        {
          kind: 'pdf',
          href: 'https://media.noahhh.com/busk-radio/buskradio.pdf',
          label: 'Full report',
        },
      ],
    },
  ],
};

// IC HACK 26 — added via add-project-content skill.
// Cover is an image hero (local poster). Body PNGs/JPGs are 1600w AVIF;
// body SVGs ride as-is on R2 (spaces normalised to hyphens).
const icHack26: Project = {
  slug: 'ic-hack-26',
  title: 'IC Hack 26',
  tags: [],
  selected: true,
  colors: { light: '#FAD2D7', dark: '#7A1166' },
  font: {
    family: 'Junicode',
    src: '/fonts/projects/ic-hack-26/Junicode-Bold.ttf',
    fallback: 'Georgia, serif',
  },
  cover: {
    kind: 'image',
    src: '/posters/ic-hack-26/cover-800.avif',
    alt: 'IC Hack 2026 Introduction Keynote',
    width: 5443,
    height: 3629,
    srcSet: [
      { src: '/posters/ic-hack-26/cover-800.avif', width: 800 },
      { src: '/posters/ic-hack-26/cover-1600.avif', width: 1600 },
      { src: '/posters/ic-hack-26/cover-2400.avif', width: 2400 },
    ],
  },
  groups: [
    {
      id: 'challenge',
      heading: 'Challenge',
      summary:
        'Building a cohesive identity for the UK’s largest student-run hackathon. Developing a thematic brand system designed to flex across 900+ attendees, two days, and the practical demands of a 48hr non-stop live event.',
      meta: {
        date: 'January 2026',
        scope: 'Branding, Merchandise Design',
        role: 'Graphic Design, Brand Kit Selection',
        collaborators: [],
      },
      blocks: [
        {
          kind: 'showcase',
          image: {
            src: 'https://media.noahhh.com/ic-hack-26/problem.svg',
            alt: 'Diagram stating the design problem for IC Hack 26',
            width: 1067,
            height: 406,
          },
          body: 'IC Hack’s challenge was scale: a large, digital-first event where the branding had to hold together from early planning through to the live weekend. We chose Fantasy and Fairytale as our theme to bring fun and creativity to an otherwise technical event.',
        },
      ],
    },
    {
      id: 'process',
      heading: 'Process',
      blocks: [
        {
          kind: 'text',
          for: 'fonts',
          body: 'We paired two typefaces, Junicode and Ysabeau. A texture was applied to the wordmark, giving the brand a more distinctive, older character. Ysabeau, as a common book typeface, evokes the look of printed fantasy while staying readable across formats.',
        },
        {
          kind: 'image',
          id: 'fonts',
          src: 'https://media.noahhh.com/ic-hack-26/fonts-v2.svg',
          alt: 'Selected fonts for IC Hack 26',
          width: 509,
          height: 384,
        },
        {
          kind: 'gallery',
          caption:
            'We selected four main colours: three representing the individual hackspaces, and a fourth marking the parts of the event outside them. Expanding these into a fuller palette gave us the range to theme each area more distinctively.',
          images: [
            {
              src: 'https://media.noahhh.com/ic-hack-26/colours-1.svg',
              alt: 'IC Hack 26 colour palette: red and purple',
              width: 610,
              height: 260,
            },
            {
              src: 'https://media.noahhh.com/ic-hack-26/colours-2.svg',
              alt: 'IC Hack 26 colour palette: blue and green',
              width: 610,
              height: 259,
            },
          ],
        },
        {
          kind: 'text',
          for: 'logo',
          body: 'We kept the existing IC Hack logo and adapted it for each hackspace, colouring it to match its environment and decorating it with that space’s biome: enchanted forest, mountains, and underwater.',
        },
        {
          kind: 'image',
          id: 'logo',
          src: 'https://media.noahhh.com/ic-hack-26/logo-1600.avif',
          alt: 'IC Hack 26 logo colouration and environmental theming',
          width: 2257,
          height: 729,
        },
        {
          kind: 'showcase',
          image: {
            src: 'https://media.noahhh.com/ic-hack-26/tshirtgraphics-1600.avif',
            alt: 'Front and back graphics for IC Hack 26 T-shirts, with colour variations for each ‘role’',
            width: 3129,
            height: 2079,
          },
          body: 'T-shirt designs were built from the graphics developed for the logo and the website. We moved to two base shirt colours and shifted the colour into a large graphic, which simplified our design process and made it easy to tell attendees apart from the people running the event.',
          strip: [
            {
              src: 'https://media.noahhh.com/ic-hack-26/tshirts-photo-1-1600.avif',
              alt: 'IC Hack 26 T-shirt photo 1',
              width: 1716,
              height: 1144,
            },
            {
              src: 'https://media.noahhh.com/ic-hack-26/tshirts-photo-2-1600.avif',
              alt: 'IC Hack 26 T-shirt photo 2',
              width: 1716,
              height: 1144,
            },
            {
              src: 'https://media.noahhh.com/ic-hack-26/tshirts-photo-3-1600.avif',
              alt: 'IC Hack 26 T-shirt photo 3',
              width: 1716,
              height: 1144,
            },
          ],
        },
        {
          kind: 'text',
          for: 'lanyards',
          body: 'Lanyards carried the same graphics through the rest of the branding. Each role received its own colour and landscape, plus an arched role label that echoes the t-shirts.',
        },
        {
          kind: 'image',
          id: 'lanyards',
          src: 'https://media.noahhh.com/ic-hack-26/lanyards-1600.avif',
          alt: 'IC Hack 26 Lanyard design',
          width: 2352,
          height: 1632,
        },
      ],
    },
    {
      id: 'outcome',
      heading: 'Outcome',
      blocks: [
        {
          kind: 'gallery',
          caption:
            'Seeing the branding in action was a highlight. It felt cohesive and worked functionally, giving hackers and organisers the information they needed throughout the weekend.',
          images: [
            {
              src: 'https://media.noahhh.com/ic-hack-26/in-environment-1600.avif',
              alt: 'IC Hack 26 branding in environment',
              width: 5363,
              height: 3576,
            },
            {
              src: 'https://media.noahhh.com/ic-hack-26/cupcakes-1600.avif',
              alt: 'IC Hack 26 cupcakes with branding',
              width: 3707,
              height: 5561,
            },
            {
              src: 'https://media.noahhh.com/ic-hack-26/tshirts-give-out-1600.avif',
              alt: 'IC Hack 26 T-shirts being given out',
              width: 3711,
              height: 5567,
            },
          ],
        },
        {
          kind: 'showcase',
          image: {
            src: 'https://media.noahhh.com/ic-hack-26/group-photo-1600.avif',
            alt: 'IC Hack 26 group photo',
            width: 5373,
            height: 3582,
          },
          body: 'A perfect way to cap off a great project. Thank you to everyone who made ICH26 possible.',
        },
      ],
    },
  ],
};

export const projects: Project[] = [
  icHack26,
  // Demoted from Selected to hold 3/3 (ic-hack-26 takes its slot).
  { ...placeholder('project-1', 'Project 1', '#E8E2D9', '#1E2A32'), groups: demoGroups(), selected: false },
  gizmophone,
  buskRadio,
  // Demoted from Selected to hold 3/3 (busk-radio takes its slot).
  { ...placeholder('project-3', 'Project 3', '#E3DDEE', '#241F33'), selected: false },
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
  }
  // Responsive cover variants are explicit, never derived: widths must
  // strictly ascend, srcs must be unique, and the first entry MUST be the
  // cover `src` itself (the fallback every surface can use).
  if (project.cover.kind === 'image' && project.cover.srcSet !== undefined) {
    const variants = project.cover.srcSet;
    if (variants.length === 0) {
      throw new Error(`Project "${project.slug}": cover srcSet must not be empty (omit it instead).`);
    }
    if (variants[0].src !== project.cover.src) {
      throw new Error(
        'Project "' + project.slug + '": cover srcSet[0] must equal the cover src ("' + project.cover.src + '").',
      );
    }
    const seenSrcs = new Set<string>();
    let prevWidth = -Infinity;
    for (const v of variants) {
      if (!v.src) {
        throw new Error(`Project "${project.slug}": cover srcSet has an entry with an empty src.`);
      }
      if (!Number.isInteger(v.width) || v.width <= 0) {
        throw new Error(
          `Project "${project.slug}": cover srcSet width must be a positive integer, got ${v.width}.`,
        );
      }
      if (v.width <= prevWidth) {
        throw new Error(
          'Project "' + project.slug + '": cover srcSet widths must strictly ascend, got ' + prevWidth + ' then ' + v.width + '.',
        );
      }
      if (seenSrcs.has(v.src)) {
        throw new Error(`Project "${project.slug}": cover srcSet has a duplicate src "${v.src}".`);
      }
      seenSrcs.add(v.src);
      prevWidth = v.width;
    }
  }
  const owners = new Map<string, string>(); // visual id -> group id
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

/** `"src 800w, src 1600w"` for an image cover's explicit variants, or
    `undefined` when the cover has none (single-file covers render `src`
    alone — thumbnails, gallery tiles, placeholders). */
export function coverSrcSet(cover: ProjectCover): string | undefined {
  if (cover.kind !== 'image' || !cover.srcSet?.length) return undefined;
  return cover.srcSet.map((v) => `${v.src} ${v.width}w`).join(', ');
}
