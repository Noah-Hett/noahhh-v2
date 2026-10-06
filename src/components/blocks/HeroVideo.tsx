import { useEffect, useRef, useState } from 'react';
import type { ProjectCover } from '../../content/projects.ts';
import { prefersReducedMotion } from '../../utils/reducedMotion.ts';

type VideoCover = Extract<ProjectCover, { kind: 'video' }>;

// Hero video (the ONLY video on a Project page): muted looping autoplay
// with pause + unmute toggles. Reduced motion starts paused on the poster.
// Poster reserves layout (dims) and doubles as the card thumbnail.
export default function HeroVideo({ cover }: { cover: VideoCover }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState<boolean>(() => prefersReducedMotion());
  const [muted, setMuted] = useState<boolean>(true);

  // React sets `muted` as an attribute; browsers gate autoplay on the
  // property — sync it so state and element can never disagree.
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  const togglePaused = (): void => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => undefined);
    } else {
      v.pause();
    }
  };
  const toggleMuted = (): void => {
    setMuted((m) => !m);
  };

  return (
    <figure className="project-hero">
      <video
        ref={videoRef}
        src={cover.src}
        poster={cover.poster}
        width={cover.width}
        height={cover.height}
        autoPlay={!paused}
        muted={muted}
        loop
        playsInline
        preload="auto"
        aria-label={cover.alt}
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
      >
        Sorry, your browser does not support video.
      </video>
      <figcaption className="project-hero-controls">
        <button
          type="button"
          className="project-end-link"
          onClick={togglePaused}
          aria-pressed={!paused}
          aria-label={paused ? 'Play video' : 'Pause video'}
        >
          {paused ? 'Play' : 'Pause'}
        </button>
        <button
          type="button"
          className="project-end-link"
          onClick={toggleMuted}
          aria-pressed={!muted}
          aria-label={muted ? 'Unmute video' : 'Mute video'}
        >
          {muted ? 'Unmute' : 'Mute'}
        </button>
      </figcaption>
    </figure>
  );
}
