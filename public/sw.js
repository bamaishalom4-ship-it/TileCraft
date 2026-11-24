// TileCraft Offline-Capable Service Worker
// `scripts/inject-pwa-head.mjs` replaces CACHE_VERSION and PRECACHE_ASSETS
// with exact build-hashed app shell assets during `npm run build:pwa`.

const CACHE_NAME = '__TILECRAFT_CACHE_NAME__';
const PRECACHE_ASSETS = /*__TILECRAFT_PRECACHE_ASSETS__*/ [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/maskable-512.png',
  '/apple-touch-icon.png',
  '/favicon.png',
];

const NON_CACHEABLE_PATH_PREFIXES = ['/robots.txt', '/sitemap.xml', '/auth/', '/api/'];

function shouldBypassCache(url) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return true;
  if (url.hostname.endsWith('.supabase.co')) return true;
  if (url.hostname.includes('revenuecat') || url.hostname.includes('stripe')) return true;
  if (url.origin !== self.location.origin) return true;
  return NON_CACHEABLE_PATH_PREFIXES.some((prefix) =>
    url.pathname.startsWith(prefix)
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => {
        await Promise.all(
          PRECACHE_ASSETS.map(async (assetUrl) => {
            try {
              const req = new Request(assetUrl, { cache: 'reload' });
              const res = await fetch(req);
              if (res && res.ok) {
                await cache.put(assetUrl, res);
              }
            } catch {
              // Skip individual optional asset failures during dev server mode
            }
          })
        );
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('tilecraft-pwa-') && key !== CACHE_NAME)
            .map((oldKey) => caches.delete(oldKey))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (shouldBypassCache(url)) return;

  // HTML document navigations: Network-first with cached app-shell fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          }
          return response;
        })
        .catch(async () => {
          const cachedIndex =
            (await caches.match('/index.html')) || (await caches.match('/'));
          return (
            cachedIndex ||
            new Response('TileCraft is offline and has not finished caching yet.', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            })
          );
        })
    );
    return;
  }

  // Same-origin static assets (JS bundles, fonts, icons): Cache-first + background revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
