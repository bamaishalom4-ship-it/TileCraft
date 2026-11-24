import {
  copyFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';

/**
 * Post-processes Expo's static web export (`dist/`) into a production-grade PWA:
 * 1. Copies all files from `public/` (`manifest.json`, `sw.js`, `robots.txt`,
 *    `sitemap.xml`, `og-preview.png`, PNG icons) into `dist/`.
 * 2. Injects exact build-hashed JS/font assets and a versioned cache key into `dist/sw.js`
 *    so Classic play works offline after a single online visit without stale builds.
 * 3. Injects static SEO, canonical, Open Graph, Twitter Card, and PWA `<head>` tags
 *    directly into `dist/index.html` (present before JS runs).
 */

const CANONICAL_ORIGIN = 'https://tilecraft-five.vercel.app';
const PAGE_TITLE = 'TileCraft — Sliding Tile Puzzle & Custom Photo Puzzles';
const PAGE_DESCRIPTION =
  'Play classic 3×3, 4×4, and 5×5 sliding tile puzzles or turn any photo into a custom sliding puzzle. Plays offline in your browser or as an installable app.';

const root = process.cwd();
const publicDir = join(root, 'public');
const distDir = join(root, 'dist');
const indexHtmlPath = join(distDir, 'index.html');
const distSwPath = join(distDir, 'sw.js');

if (!existsSync(indexHtmlPath)) {
  console.error('dist/index.html not found. Run `expo export --platform web` first.');
  process.exit(1);
}

// 1. Copy public assets into dist/
if (existsSync(publicDir)) {
  for (const file of readdirSync(publicDir)) {
    copyFileSync(join(publicDir, file), join(distDir, file));
  }
}

// 2. Collect build-hashed JS bundle & required Ionicons font for deterministic SW precaching
function walkFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walkFiles(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

const precacheUrls = new Set([
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/maskable-512.png',
  '/apple-touch-icon.png',
  '/favicon.png',
]);

for (const file of walkFiles(join(distDir, '_expo'))) {
  if (file.endsWith('.js') || file.endsWith('.css')) {
    const webPath = '/' + relative(distDir, file).replace(/\\/g, '/');
    precacheUrls.add(webPath);
  }
}

for (const file of walkFiles(join(distDir, 'assets'))) {
  // Only precache Ionicons (the icon set used by TileCraft) so offline precache stays fast & lean
  if (file.includes('Ionicons') && file.endsWith('.ttf')) {
    const webPath = '/' + relative(distDir, file).replace(/\\/g, '/');
    precacheUrls.add(webPath);
  }
}

const precacheList = Array.from(precacheUrls).sort();
const versionHash = createHash('sha256')
  .update(precacheList.join('|'))
  .digest('hex')
  .slice(0, 10);
const cacheName = `tilecraft-pwa-${versionHash}`;

if (existsSync(distSwPath)) {
  let swSource = readFileSync(distSwPath, 'utf8');
  swSource = swSource.replace('__TILECRAFT_CACHE_NAME__', cacheName);
  swSource = swSource.replace(
    /\/\*__TILECRAFT_PRECACHE_ASSETS__\*\/\s*\[[\s\S]*?\];/,
    `${JSON.stringify(precacheList, null, 2)};`
  );
  writeFileSync(distSwPath, swSource, 'utf8');
}

// 3. Inject complete static SEO, Open Graph, Twitter Card & PWA metadata into dist/index.html
let html = readFileSync(indexHtmlPath, 'utf8');

// Normalize existing title & description emitted by Expo so there are no duplicates
html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${PAGE_TITLE}</title>`);
html = html.replace(/<meta\s+name="description"[^>]*>\s*/gi, '');
html = html.replace(/<meta\s+name="theme-color"[^>]*>\s*/gi, '');

const staticHeadBlock = `
  <meta name="description" content="${PAGE_DESCRIPTION}" />
  <meta name="author" content="MadeByKubo" />
  <meta name="theme-color" content="#0F131D" />
  <link rel="canonical" href="${CANONICAL_ORIGIN}/" />
  <link rel="manifest" href="/manifest.json" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="TileCraft" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="TileCraft" />
  <meta property="og:url" content="${CANONICAL_ORIGIN}/" />
  <meta property="og:title" content="${PAGE_TITLE}" />
  <meta property="og:description" content="${PAGE_DESCRIPTION}" />
  <meta property="og:image" content="${CANONICAL_ORIGIN}/og-preview.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="TileCraft tactile sliding tile puzzle board with numbered tiles and custom photo puzzle preview" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${PAGE_TITLE}" />
  <meta name="twitter:description" content="${PAGE_DESCRIPTION}" />
  <meta name="twitter:image" content="${CANONICAL_ORIGIN}/og-preview.png" />`;

if (!html.includes('property="og:image"')) {
  html = html.replace('</head>', `${staticHeadBlock}\n</head>`);
}

writeFileSync(indexHtmlPath, html, 'utf8');
console.log(
  `Injected SEO/OG metadata, robots.txt, sitemap.xml, and SW precache (${cacheName}, ${precacheList.length} assets) into dist/`
);
