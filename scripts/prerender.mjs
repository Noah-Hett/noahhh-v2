// Post-build prerender: writes static HTML for every route into dist/ plus
// sitemap.xml. Runs after `vite build` (see package.json "build").
//
// Why: the app is client-rendered, so the raw HTML was an empty
// <div id="root"> with one site-wide title. Google has to queue a JS render
// to see anything, and most AI crawlers never run JS at all.
//
// How: Vite's SSR loader renders src/entry-prerender.tsx with React's
// server renderer (no headless browser, so it runs on the Cloudflare Pages
// build image). Each route's markup goes into a copy of dist/index.html
// with its own title, description, canonical and og:/twitter: tags.
//
// Client side, main.tsx still uses createRoot (not hydrate) and replaces the
// snapshot on boot, so the intro/transition behaviour is unchanged. The
// snapshot is hidden until then (data-prerendered + the inline style below)
// so visitors never see a static frame flash before the app mounts —
// crawlers read the HTML text regardless of CSS.
//
// Output paths: /projects -> dist/projects.html, /project/x ->
// dist/project/x.html. Cloudflare Pages serves those at the extensionless
// URL, and static files win over the /* SPA fallback in _redirects.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const SITE = 'https://noahhh.com';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const escapeAttr = (s) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Replace one tag's attribute value, failing loudly if index.html drifted. */
function setMeta(html, selector, value) {
  const re = new RegExp(`(<meta ${selector} content=")[^"]*(")`);
  if (!re.test(html)) throw new Error(`prerender: index.html is missing <meta ${selector}>`);
  return html.replace(re, `$1${escapeAttr(value)}$2`);
}

function page(template, route, body) {
  const url = SITE + route.path;
  let html = template;
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeText(route.title)}</title>`);
  html = setMeta(html, 'name="description"', route.description);
  html = setMeta(html, 'property="og:title"', route.title);
  html = setMeta(html, 'property="og:description"', route.description);
  html = setMeta(html, 'property="og:url"', url);
  html = setMeta(html, 'name="twitter:title"', route.title);
  html = setMeta(html, 'name="twitter:description"', route.description);
  html = html.replace(
    '</head>',
    `  <link rel="canonical" href="${url}" />\n` +
      `    <style>#root[data-prerendered]{visibility:hidden}</style>\n  </head>`,
  );
  // React 19 hoists each page's <title>/<meta>/<link> into the stream;
  // the head above already carries them, so drop the inline copies.
  // The snapshot is hidden and replaced on boot, so its videos must not
  // start downloading: drop autoplay and skip metadata fetches.
  const markup = body
    .replace(/<title>[^<]*<\/title>/g, '')
    .replace(/<video([^>]*)>/g, (_, attrs) =>
      `<video${attrs.replace(/\sautoPlay=""/i, '').replace(/\spreload="[^"]*"/i, '')} preload="none">`,
    );
  const rootTag = '<div id="root"></div>';
  if (!html.includes(rootTag)) throw new Error('prerender: index.html is missing <div id="root"></div>');
  return html.replace(rootTag, `<div id="root" data-prerendered>${markup}</div>`);
}

function outFile(path) {
  if (path === '/') return join(dist, 'index.html');
  return join(dist, `${path.slice(1)}.html`);
}

const vite = await createServer({
  root,
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
});

try {
  const { routes, render } = await vite.ssrLoadModule('/src/entry-prerender.tsx');
  const template = await readFile(join(dist, 'index.html'), 'utf8');
  const all = routes();

  for (const route of all) {
    const body = await render(route.path);
    if (!body.includes('<main')) throw new Error(`prerender: ${route.path} rendered no <main>`);
    const file = outFile(route.path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, page(template, route, body));
    console.log(`prerender  ${route.path}  ->  ${file.slice(root.length + 1)}`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const sitemap =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    all.map((r) => `  <url><loc>${SITE}${r.path}</loc><lastmod>${today}</lastmod></url>`).join('\n') +
    '\n</urlset>\n';
  await writeFile(join(dist, 'sitemap.xml'), sitemap);
  console.log(`prerender  sitemap.xml  (${all.length} urls)`);
} finally {
  await vite.close();
}
