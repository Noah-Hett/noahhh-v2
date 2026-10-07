import { useEffect } from 'react';

// Page-level Project theming: colours land on <html> as --proj-light/
// --proj-dark (+ data-project slug) so header, body, footer and the
// overscroll canvas all follow the Project. Skipped entirely when there
// is no project (404). Cleaned up on unmount / slug change so colours
// never leak across routes. The transition cover tints itself with the
// incoming canvas (see PageTransition coverForPathname) — it matches by
// the time the swap happens, so the reveal blends instead of cutting.
export function useProjectThemeing(
  project: { slug: string; colors: { light: string; dark: string } } | undefined,
): void {
  const slug = project?.slug;
  const light = project?.colors.light;
  const dark = project?.colors.dark;
  useEffect(() => {
    if (!slug || !light || !dark) return;
    const root = document.documentElement;
    root.setAttribute('data-project', slug);
    root.style.setProperty('--proj-light', light);
    root.style.setProperty('--proj-dark', dark);
    const metas = document.querySelectorAll('meta[name="theme-color"]');
    const prev: string[] = [];
    metas.forEach((m) => {
      prev.push(m.getAttribute('content') ?? '');
      const media = m.getAttribute('media') ?? '';
      m.setAttribute('content', media.includes('dark') ? dark : light);
    });
    return () => {
      root.removeAttribute('data-project');
      root.style.removeProperty('--proj-light');
      root.style.removeProperty('--proj-dark');
      metas.forEach((m, i) => m.setAttribute('content', prev[i] ?? ''));
    };
  }, [slug, light, dark]);
}

// Per-Project display face: one local woff2/woff/otf/ttf, injected only
// while this page is mounted (font-display: swap; body text stays on
// system-ui). Skipped when there is no project (404) or no font src.
export function useProjectFont(
  project: { font: { family: string; src: string } } | undefined,
): void {
  const family = project?.font.family;
  const src = project?.font.src;
  useEffect(() => {
    if (!family || !src) return;
    const id = 'project-font-face';
    const prev = document.getElementById(id);
    const prevCss = prev?.textContent ?? null;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = fontFaceRule(family, src);
    prev?.remove();
    document.head.appendChild(style);
    return () => {
      style.remove();
      if (prevCss !== null && prev) document.head.appendChild(prev);
    };
  }, [family, src]);
}

// Listing pages (Home Selected cards, All Projects rows) render titles in
// each Project's display face but never mount ProjectPage — the families
// they reference would otherwise fall back everywhere. One <style> with a
// rule per family (deduped, first wins), removed on unmount.
export function useProjectFonts(
  list: { font: { family: string; src: string } }[] | undefined,
): void {
  // Stable key: getSelected()/projects build a fresh array each render,
  // so depend on the serialized identity, not the array itself.
  const key = list?.map((p) => `${p.font.family}|||${p.font.src}`).join(';;') ?? '';
  useEffect(() => {
    if (!list || list.length === 0) return;
    const seen = new Set<string>();
    const rules: string[] = [];
    for (const p of list) {
      if (!p.font.family || !p.font.src || seen.has(p.font.family)) continue;
      seen.add(p.font.family);
      rules.push(fontFaceRule(p.font.family, p.font.src));
    }
    if (rules.length === 0) return;
    const id = 'project-font-faces';
    const prev = document.getElementById(id);
    const prevCss = prev?.textContent ?? null;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = rules.join('');
    prev?.remove();
    document.head.appendChild(style);
    return () => {
      style.remove();
      if (prevCss !== null && prev) document.head.appendChild(prev);
    };
    // `key` is the serialized identity of `list` — intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

function fontFaceRule(family: string, src: string): string {
  const path = src.split(/[?#]/)[0].toLowerCase();
  // Safari validates format() strictly: .otf must be "opentype",
  // .ttf must be "truetype". Chrome/Firefox load either way, which is
  // why the mismatch only showed up on Safari / iOS.
  const format =
    path.endsWith('.woff2')
      ? 'woff2'
      : path.endsWith('.woff')
        ? 'woff'
        : path.endsWith('.otf')
          ? 'opentype'
          : 'truetype';
  return `@font-face{font-family:"${family}";src:url("${src}") format("${format}");font-display:swap;font-weight:400;font-style:normal;}`;
}
