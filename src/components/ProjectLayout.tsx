import { useNavigate } from 'react-router-dom';
import type { CSSProperties, ReactNode } from 'react';
import ContactSection from './ContactSection/ContactSection.tsx';
import type { ChallengeGroup } from '../content/projects.ts';
import { collaboratorInitials } from '../content/projects.ts';
import { prefersReducedMotion } from '../utils/reducedMotion.ts';
import './ProjectLayout.css';

// Shared shell around every Project page (see CONTEXT.md: ProjectLayout).
// Title, meta row, back-nav, and end prompt stay consistent;
// children (grouped Blocks) differ. Page-level theming (colours + font)
// is owned by ProjectPage via html[data-project] + @font-face — this
// shell just consumes the tokens and applies the family to the title.
export default function ProjectLayout({
  title,
  titleFontFamily,
  hero,
  challenge,
  challengeBlocks,
  children,
}: {
  title: string;
  titleFontFamily?: string;
  hero?: ReactNode;
  challenge: ChallengeGroup;
  challengeBlocks?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const { summary, meta } = challenge;

  // History back; direct landings (no history) fall back to All work.
  const goBack = (): void => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/projects');
    }
  };

  const toTop = (): void => {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    // Focus leaves with the scroll otherwise — land it on the first
    // heading so keyboard/SR users don't lose context. Best-effort.
    window.setTimeout(() => {
      const h = document.querySelector('main h1, main h2, h1');
      if (h instanceof HTMLElement) {
        const prev = h.getAttribute('tabindex');
        h.setAttribute('tabindex', '-1');
        h.focus({ preventScroll: true });
        if (prev === null) h.removeAttribute('tabindex');
        else h.setAttribute('tabindex', prev);
      }
    }, prefersReducedMotion() ? 0 : 600);
  };

  return (
    <article className="project-layout">
      <nav aria-label="Back">
        <button type="button" className="project-end-link" onClick={goBack}>
          ← Back
        </button>
      </nav>
      <h1 className="project-title" style={titleFontFamily ? ({ fontFamily: titleFontFamily } as CSSProperties) : undefined}>
        {title}
      </h1>
      {hero}
      <div className="project-body">
        {/* Challenge owns the intro row structurally: summary + meta live
            in the challenge group, rendered here with identical visuals.
            Challenge Blocks (when any) follow on block rhythm. */}
        <section className="project-challenge" aria-label={challenge.heading}>
          <h2 className="visually-hidden">{challenge.heading}</h2>
          <div className="project-intro">
            <p className="project-summary">{summary}</p>
            <dl className="project-meta" aria-label="Project details">
        <div>
          <dt>Date</dt>
          <dd>{meta.date}</dd>
        </div>
        <div>
          <dt>Scope</dt>
          <dd>{meta.scope}</dd>
        </div>
        <div>
          <dt>Role</dt>
          <dd>{meta.role}</dd>
        </div>
        {meta.collaborators.length > 0 && (
          <div>
            <dt>Collaborators</dt>
            <dd>
              <ul className="project-collabs">
                {meta.collaborators.map((c) => (
                  <li key={c.name} title={c.name}>
                    {c.url ? (
                      <a href={c.url} target="_blank" rel="noreferrer">
                        {collaboratorInitials(c)}
                        <span className="visually-hidden">{c.name} (opens in new tab) ↗</span>
                      </a>
                    ) : (
                      <span aria-label={c.name}>{collaboratorInitials(c)}</span>
                    )}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
      </dl>
          </div>
          {challengeBlocks !== undefined && (
            <div className="project-challenge-blocks">{challengeBlocks}</div>
          )}
        </section>
        {children}
      </div>
      <nav className="project-end-nav" aria-label="Page">
        <button type="button" className="project-end-link" onClick={goBack}>
          ← Back
        </button>
        <button type="button" className="project-end-link" onClick={toTop}>
          Back to top ↑
        </button>
      </nav>
      {/* End prompt: shared contact section closes every Project page. */}
      <ContactSection />
    </article>
  );
}
