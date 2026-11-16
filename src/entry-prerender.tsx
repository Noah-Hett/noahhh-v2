// Build-time prerender entry (scripts/prerender.mjs). Renders each route to
// static HTML so crawlers that don't run JS (most AI scrapers) still see the
// content, and Google gets real per-page titles/descriptions up front.
// Node only — never imported by the client bundle.
import { prerender } from 'react-dom/static';
import { StaticRouter } from 'react-router-dom';
import { Shell } from './App.tsx';
import { challengeOf, projects } from './content/projects.ts';

export const SITE_DESCRIPTION =
  'Noah Hett is a design engineer, with a love for user-centred design projects, and a slight obsession with visual communication.';

export interface PrerenderRoute {
  path: string;
  title: string;
  description: string;
}

export function routes(): PrerenderRoute[] {
  return [
    { path: '/', title: 'Noah Hett', description: SITE_DESCRIPTION },
    { path: '/projects', title: 'All work — Noah Hett', description: SITE_DESCRIPTION },
    ...projects.map((p) => ({
      path: `/project/${p.slug}`,
      title: `${p.title} — Noah Hett`,
      description: challengeOf(p).summary,
    })),
  ];
}

export async function render(url: string): Promise<string> {
  const { prelude } = await prerender(
    <StaticRouter location={url}>
      <Shell />
    </StaticRouter>,
  );
  return new Response(prelude).text();
}
