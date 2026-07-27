const CACHE_NAME = 'mothership-reader-v26';
const ASSETS = [
    './',
    './index.html',
    './reader/base.css',
    './reader/sidebar.css',
    './reader/reader.css',
    './reader/panel.css',
    './reader/annotations.css',
    './vendor/marked.min.js',
    './reader/app.js',
    './reader/error-boundary.js',
    './reader/file-list.json',
    './reader/modules/annotations.js',
    './reader/modules/annotation_render.js',
    './reader/modules/config.js',
    './reader/modules/events.js',
    './reader/modules/gestures.js',
    './reader/modules/github.js',
    './reader/modules/main.js',
    './reader/modules/navigator.js',
    './reader/modules/reader.js',
    './reader/modules/search.js',
    './reader/modules/sidebar.js',
    './reader/modules/sort.js',
    './reader/modules/state.js',
    './reader/modules/theme.js',
    './reader/modules/tts.js',
    './assets/favicon.png',
    './assets/icon-192.png',
    './assets/icon-512.png'
];

self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);
    const isMarkdownOrGithub = url.pathname.endsWith('.md') || url.hostname.includes('github');

    if (e.request.mode === 'navigate') {
        e.respondWith(
            caches.open(CACHE_NAME).then(async (cache) => {
                try {
                    const networkResponse = await fetch(e.request);
                    cache.put(e.request, networkResponse.clone());
                    return networkResponse;
                } catch {
                    return (await cache.match(e.request)) || cache.match('./index.html');
                }
            })
        );
        return;
    }

    // Reader content uses stale-while-revalidate so
    // mobile/PWA users get an offline response while the cache refreshes.
    if (isMarkdownOrGithub) {
        e.respondWith(
            caches.open(CACHE_NAME).then(async (cache) => {
                const cachedResponse = await cache.match(e.request);
                const fetchPromise = fetch(e.request)
                    .then((networkResponse) => {
                        cache.put(e.request, networkResponse.clone());
                        return networkResponse;
                    })
                    .catch(() => cachedResponse);
                return cachedResponse || fetchPromise;
            })
        );
        return;
    }

    // App shell assets are cache-first with a network fallback.
    e.respondWith(
        caches.match(e.request).then((response) => {
            return response || fetch(e.request);
        })
    );
});
