import { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Post-processes Expo's static web export (`dist/`) into a Lighthouse-ready PWA:
 * 1. Ensures all files from `public/` (`manifest.json`, `sw.js`, PNG icons) exist in `dist/`.
 * 2. Injects static PWA `<head>` meta & manifest links into `dist/index.html`.
 */
const root = process.cwd();
const publicDir = join(root, 'public');
const distDir = join(root, 'dist');
const indexHtmlPath = join(distDir, 'index.html');

if (!existsSync(indexHtmlPath)) {
  console.error('dist/index.html not found. Run `expo export --platform web` first.');
  process.exit(1);
}

// Copy public assets into dist/
if (existsSync(publicDir)) {
  for (const file of readdirSync(publicDir)) {
    copyFileSync(join(publicDir, file), join(distDir, file));
  }
}

let html = readFileSync(indexHtmlPath, 'utf8');

// Ensure clean title
if (/<title>.*<\/title>/i.test(html)) {
  html = html.replace(/<title>.*<\/title>/i, '<title>TileCraft — Sliding Tile Puzzle</title>');
}

const tags = [];
if (!html.includes('rel="manifest"')) {
  tags.push('  <link rel="manifest" href="/manifest.json" />');
}
if (!html.includes('name="theme-color"')) {
  tags.push('  <meta name="theme-color" content="#0F131D" />');
}
if (!html.includes('name="mobile-web-app-capable"')) {
  tags.push('  <meta name="mobile-web-app-capable" content="yes" />');
  tags.push('  <meta name="apple-mobile-web-app-capable" content="yes" />');
  tags.push('  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />');
  tags.push('  <meta name="apple-mobile-web-app-title" content="TileCraft" />');
  tags.push('  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />');
}

if (tags.length > 0) {
  html = html.replace('</head>', `${tags.join('\n')}\n</head>`);
}

writeFileSync(indexHtmlPath, html, 'utf8');
console.log('PWA manifest, meta tags, icons, and sw.js injected cleanly into dist/');
