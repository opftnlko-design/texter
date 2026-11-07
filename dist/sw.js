/* Bump this on every deploy that changes the precached shell. `activate` only
   purges caches whose name differs, so a fixed name meant the old shell was
   never discarded. */
const CACHE_NAME = 'texter-v3';
const OFFLINE_URL = '/index.html';

const PRECACHE_URLS = [
  OFFLINE_URL,
  '/manifest.json',
  '/logo.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // addAll fails the whole install if one file is missing, so add individually.
      // `reload` bypasses the HTTP cache — hosting serves manifest.json with a
      // max-age, which would otherwise precache a day-old copy.
      Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => {
            /* ignore missing assets */
          })
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never intercept Firebase / Google auth or API traffic
  if (
    url.origin !== self.location.origin &&
    !url.pathname.startsWith('/api')
  ) {
    return;
  }

  // Navigation requests: network first, fall back to cached app shell (offline)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(OFFLINE_URL, copy));
          return response;
        })
        .catch(() =>
          caches.match(OFFLINE_URL).then((cached) => cached || caches.match(request))
        )
    );
    return;
  }

  /* Content-hashed build output never changes for a given URL, so cache-first
     is both correct and instant. */
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  /* Everything else (manifest.json, logo.png, …) keeps the SAME url across
     deploys. Cache-first here pinned a stale manifest and icon forever — the
     user had to clear site data to see an update. Network first, cache only as
     the offline fallback. */
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Allow the page to trigger an immediate skipWaiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
