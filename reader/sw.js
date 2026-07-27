const CACHE_NAME = 'reader-cache-v3';

self.addEventListener('install', () => {
  // Activate the new SW immediately instead of waiting for old tabs to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Purge caches from previous versions so stale assets can't survive an update.
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Network-first: always prefer fresh content when online (so code updates
  // take effect), falling back to the runtime cache only when offline.
  event.respondWith((async () => {
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok && new URL(req.url).origin === self.location.origin) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (err) {
      const cached = await caches.match(req);
      if (cached) return cached;
      throw err;
    }
  })());
});
