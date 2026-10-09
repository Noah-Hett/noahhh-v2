import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import ProjectLayout from '../components/ProjectLayout.tsx';
import HeroVideo from '../components/blocks/HeroVideo.tsx';
import { assignFlipsAcross, collectItems } from '../components/blocks/pairing.ts';
import { renderItems } from '../components/blocks/renderItems.tsx';
import { useProjectFont, useProjectThemeing } from '../components/blocks/useProjectChrome.ts';
import { challengeOf, coverSrcSet, getProject } from '../content/projects.ts';
import './ProjectPage.css';

export default function ProjectPage() {
  const { slug } = useParams();
  const project = getProject(slug);
  useProjectThemeing(project);
  useProjectFont(project);

  // Pairing (Phase 3): a text carrying `for` adjacent to its image (either
  // order, same group — guaranteed by validateProject) renders as one
  // alternating pair row. Everything else flows standalone. DOM order is
  // never changed; alternation is visual placement only. Flips are assigned
  // in page order — challenge Blocks first, then remaining groups — from the
  // pair's position, so the result is stable across re-renders.
  const body = useMemo(() => {
    if (!project) return null;
    const challenge = challengeOf(project);
    const restGroups = project.groups.filter((g) => g !== challenge);
    const [challengeItems, ...restItems] = assignFlipsAcross([
      collectItems(challenge.blocks),
      ...restGroups.map((g) => collectItems(g.blocks)),
    ]);
    return {
      titleStack: `"${project.font.family}", ${project.font.fallback ?? 'system-ui, sans-serif'}`,
      challenge,
      challengeItems: challengeItems ?? [],
      renderedGroups: restGroups.map((group, i) => ({ group, items: restItems[i] ?? [] })),
    };
  }, [project]);

  if (!project || !body) {
    return (
      <main className="page">
        <h1>Project not found</h1>
        <p>
          <Link to="/projects">Back to all projects</Link>
        </p>
      </main>
    );
  }
  const { titleStack, challenge, challengeItems, renderedGroups } = body;
  // Responsive hero: variant covers serve srcset (browser picks 800/1600/
  // 2400 by viewport); single-file covers render `src` alone, as before.
  const coverSet = coverSrcSet(project.cover);
  return (
    <main className="page page-project">
      <ProjectLayout
        title={project.title}
        titleFontFamily={titleStack}
        challenge={challenge}
        challengeBlocks={
          /* Challenge Blocks (when any) render under the intro row inside
             the challenge section, on block rhythm. */
          challengeItems.length > 0 ? <ul>{renderItems(challengeItems)}</ul> : undefined
        }
        hero={
          /* Cover hero: image file directly, video file via HeroVideo
             (poster = LCP + card thumbnail). Rendered between title and
             challenge row (Phase 1 shell order). */
          project.cover.kind === 'video' ? (
            <HeroVideo cover={project.cover} />
          ) : (
            <figure className="project-hero">
              <img
                src={project.cover.src}
                srcSet={coverSet}
                sizes={coverSet ? '(max-width: 1196px) 100vw, 1196px' : undefined}
                alt={project.cover.alt}
                width={project.cover.width}
                height={project.cover.height}
                fetchPriority="high"
                decoding="async"
              />
            </figure>
          )
        }
      >
        {/* Groups render here. Each kind lazy-loads its heavy loader
            (video/3D/gallery) so large files never block initial paint.
            Empty groups render nothing — media-light and media-heavy
            Projects share this code path. */}
        {renderedGroups.map(
          ({ group: g, items }) =>
            items.length > 0 && (
              <section key={g.id} aria-label={g.heading}>
                {/* Phase 1: headings stay semantic-only (aria-label above).
                    Copy carries the narrative, never a visible H2. */}
                <h2 className="visually-hidden">{g.heading}</h2>
                <ul>{renderItems(items)}</ul>
              </section>
            ),
        )}
      </ProjectLayout>
    </main>
  );
}
