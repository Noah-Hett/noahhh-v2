import { useEffect } from 'react';

// Reference-counted viewport scroll lock. SiteHeader (mobile menu) and
// PageTransition (route cover) previously each saved/restored <html>
// overflow + body padding-right with their own refs, so whoever unlocked
// last won — a menu-close racing a transition-lock could release the
// other's hold. Counting holds makes lock/unlock ordering irrelevant.
// The compensation itself is unchanged: hiding overflow removes a classic
// scrollbar and widens the viewport, so the body is padded by exactly that
// gap (overlay scrollbars measure 0 and no-op) and the gap is published as
// --lock-gap on <html> for viewport-centered fixed elements.
let holds = 0;
let savedOverflow = '';
let savedPadding = '';

export function lockViewportScroll(): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const html = document.documentElement;
  const body = document.body;
  if (holds === 0) {
    savedOverflow = html.style.overflow;
    savedPadding = body.style.paddingRight;
    const gap = window.innerWidth - html.clientWidth;
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    html.style.setProperty('--lock-gap', `${gap}px`);
    html.style.overflow = 'hidden';
  }
  holds += 1;
}

export function unlockViewportScroll(): void {
  if (holds <= 0 || typeof document === 'undefined') return;
  holds -= 1;
  if (holds === 0) {
    document.documentElement.style.overflow = savedOverflow;
    document.body.style.paddingRight = savedPadding;
    document.documentElement.style.removeProperty('--lock-gap');
  }
}

// Boolean-owned hold: locks while `active`, releases on flip/unmount.
// Never releases a hold it doesn't own — mounting with `active=false`
// (or a double-effect remount) is a no-op, so this can't clobber a
// concurrent holder's lock the way the old unconditional restores could.
export function useViewportScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    lockViewportScroll();
    return () => unlockViewportScroll();
  }, [active]);
}
