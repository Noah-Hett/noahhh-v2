import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { projects, challengeOf, type Project } from '../content/projects.ts';

function titleStyle(p: Project): CSSProperties {
  return { fontFamily: `"${p.font.family}", ${p.font.fallback ?? 'system-ui, sans-serif'}` };
}

// Both views read the same manifest — a toggle, not two pages.
// Titles render in each Project's own display face (local font, loaded
// on demand by the Project page); rows themselves stay neutral.
export default function Projects() {
  const [view, setView] = useState<'gallery' | 'list'>('gallery');
  return (
    <main className="page">
      <h1>All projects</h1>
      <p>
        <button onClick={() => setView('gallery')} disabled={view === 'gallery'}>
          Gallery
        </button>{' '}
        <button onClick={() => setView('list')} disabled={view === 'list'}>
          List
        </button>
      </p>
      {view === 'gallery' ? (
        <ul>
          {projects.map((p) => (
            <li key={p.slug}>
              <Link to={`/project/${p.slug}`}>
                {/* Video covers show their poster — same file the card
                    thumbnails use. */}
                {p.cover.kind === 'video' ? (
                  <img
                    src={p.cover.poster}
                    alt={p.cover.alt}
                    width={p.cover.width}
                    height={p.cover.height}
                    loading="lazy"
                  />
                ) : (
                  <img src={p.cover.src} alt={p.cover.alt} width={p.cover.width} height={p.cover.height} loading="lazy" />
                )}
                <span style={titleStyle(p)}>
                  {p.title}
                </span>
                </Link>{' '}
                — {challengeOf(p).meta.date}
            </li>
          ))}
        </ul>
      ) : (
        <ol>
          {projects.map((p) => (
            <li key={p.slug}>
              <Link to={`/project/${p.slug}`}>
                <span style={titleStyle(p)}>
                  {p.title}
                </span>
                </Link>{' '}
                — {challengeOf(p).summary} ({challengeOf(p).meta.date})
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
