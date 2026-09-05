/* eslint-disable no-restricted-globals */
// FOID service worker (audit C5 / G4). The previous file precached whole
// HTML pages and served HTML stale-while-revalidate, which would have
// handed users pages pointing at chunk hashes from an old deploy. It was
// also never registered. This one:
//   - never caches HTML or API responses (network only)
//   - caches hashed /_next/static and immutable /media, /sfx, /fonts
//     cache-first (they carry a hash or are never overwritten in place)
//   - caches small same-origin images stale-while-revalidate
//   - drops old caches on activate
const VERSION = 'foid-sw-v3';
const STATIC_CACHE = `${VERSION}-static`;
const IMAGE_CACHE = `${VERSION}-images`;
const IMAGE_LIMIT = 120;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((n) => n !== STATIC_CACHE && n !== IMAGE_CACHE)
            .map((n) => caches.delete(n)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isImmutable(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/media/') ||
    url.pathname.startsWith('/sfx/') ||
    url.pathname.startsWith('/fonts/')
  );
}

function isImage(url) {
  return /\.(png|webp|jpg|jpeg|gif|svg|ico)$/i.test(url.pathname) || url.pathname.startsWith('/icons/');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Navigations, RSC payloads and API calls always hit the network.
  if (request.mode === 'navigate' || url.pathname.startsWith('/api/') || url.searchParams.has('_rsc')) return;

  if (isImmutable(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }
  if (isImage(url)) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
  }
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && (response.type === 'basic' || response.type === 'default')) {
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        await cache.put(request, response.clone());
        trim(cache, IMAGE_LIMIT);
      }
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

async function trim(cache, limit) {
  const keys = await cache.keys();
  if (keys.length <= limit) return;
  await Promise.all(keys.slice(0, keys.length - limit).map((k) => cache.delete(k)));
}

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
