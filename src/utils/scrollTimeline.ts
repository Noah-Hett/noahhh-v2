// Scroll-driven animation helpers. Effects played on a ScrollTimeline or
// ViewTimeline are applied by the browser from the current scroll offset,
// so they stay in step with the scroll even when the main thread is late
// (a rAF scrub lands a frame behind and visibly snaps on slow machines).
// Browsers without the API (Firefox) get null and keep their rAF path.

type TimelineCtor = new (o: Record<string, unknown>) => AnimationTimeline;

export function viewTimeline(subject: Element): AnimationTimeline | null {
  const Ctor = (window as unknown as { ViewTimeline?: TimelineCtor }).ViewTimeline;
  return Ctor ? new Ctor({ subject, axis: 'block' }) : null;
}

export function documentScrollTimeline(): AnimationTimeline | null {
  const Ctor = (window as unknown as { ScrollTimeline?: TimelineCtor }).ScrollTimeline;
  return Ctor ? new Ctor({ source: document.documentElement, axis: 'block' }) : null;
}

/** Page scroll range (px) the document timeline spans, 0 → max scrollY. */
export function maxScroll(): number {
  return Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
}

/**
 * Linear property ramp between two scrollY values on the document
 * timeline: `from` at or above `y0`, `to` at or below `y1`. Keyframe
 * offsets must sit in [0, 1], so a ramp that starts before the top or ends
 * past the bottom of the page is clipped there with the value it would
 * have at that point.
 */
export function scrollRamp(
  el: Element,
  timeline: AnimationTimeline,
  prop: string,
  y0: number,
  y1: number,
  value: (p: number) => string,
): Animation {
  const max = maxScroll();
  const at = (y: number): number => Math.max(0, Math.min(1, (y - y0) / (y1 - y0)));
  const o0 = Math.max(0, Math.min(1, y0 / max));
  const o1 = Math.max(0, Math.min(1, y1 / max));
  const frames: Keyframe[] = [{ offset: 0, [prop]: value(at(0)) }];
  if (o0 > 0) frames.push({ offset: o0, [prop]: value(at(y0)) });
  if (o1 > o0 && o1 < 1) frames.push({ offset: o1, [prop]: value(at(y1)) });
  frames.push({ offset: 1, [prop]: value(at(max)) });
  return el.animate(frames, { timeline, fill: 'both', easing: 'linear' } as unknown as KeyframeAnimationOptions);
}
