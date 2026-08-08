// Bump whenever the app shell or the precached catalog projection changes — the projection is
// served cache-first, so installed clients keep the old character data until this name changes.
const CACHE_NAME = 'woulou-visual-harness-v4';
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  '../catalog/generated/character_catalog.browser.js',
  '../storage/generated/chapter_004_residual_core.jpg',
  '../storage/generated/chapter_050_scene.jpg'
];

// Install Event - Precache App Shell, Catalog Projection & Static Scene Images
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Visual Harness SW] Precaching app shell, catalog projection and scene images');
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[Visual Harness SW] Precache warning:', err);
      });
    })
  );
});

// Activate Event - Clean old caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('woulou-visual-harness-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Stale-While-Revalidate for images, Cache-First for shell
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Handle navigation requests (index.html)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          return networkResponse;
        })
        .catch(() => {
          return caches.match('./index.html') || caches.match(request);
        })
    );
    return;
  }

  // Harness run results change on every `npm test`. Cache-first would freeze the Quality Gate on
  // a stale report, and the page's cache-busting query would make every reload a new cache key —
  // so never cache these at all.
  if (url.pathname.includes('/storage/metadata/')) {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  // Handle generated image assets: Stale-While-Revalidate
  if (url.pathname.includes('/storage/generated/') || url.pathname.match(/\.(png|jpg|jpeg|svg|webp)$/i)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Cache First with Network Fallback for static assets
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request).then((networkResponse) => {
        if (request.method === 'GET' && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        }
        return networkResponse;
      });
    })
  );
});
