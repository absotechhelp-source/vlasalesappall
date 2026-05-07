/* ═══════════════════════════════════════════════════════
   VLA Agent App — Service Worker  v1.0
   Vanguard Life Assurance Company Limited
   ═══════════════════════════════════════════════════════ */

const CACHE_NAME    = 'vla-app-v2';
const RUNTIME_CACHE = 'vla-runtime-v2';

/* Core app shell — cached on install */
const APP_SHELL = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

/* External resources to cache when first fetched */
const RUNTIME_ORIGINS = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com'
];

/* ── INSTALL: pre-cache app shell ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

/* ── ACTIVATE: clean up old caches ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== RUNTIME_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── FETCH: network-first for API, cache-first for shell ── */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  /* Never intercept cross-origin API calls (Google Apps Script) */
  if (url.hostname.includes('script.google.com')) return;
  if (url.hostname.includes('wa.me'))              return;

  /* For same-origin requests and allowed external origins */
  if (url.origin === self.location.origin || RUNTIME_ORIGINS.some(o => url.href.startsWith(o))) {
    event.respondWith(cacheFirst(event.request));
  }
});

/* Cache-first strategy: serve from cache, fall back to network, cache new response */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const networkResponse = await fetch(request);
    /* Only cache successful, non-opaque responses */
    if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'opaque') {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    /* Offline fallback: return app shell */
    const fallback = await caches.match('./index.html');
    return fallback || new Response('Offline — VLA App not cached yet.', {
      status: 503, headers: { 'Content-Type': 'text/plain' }
    });
  }
}

/* ── MESSAGE: force cache refresh ── */
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
  if (event.data === 'clearCache') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});
