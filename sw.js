// CineNova Service Worker v4.0 — Network-first strategy with instant update
const CACHE_NAME = 'cinenova-v13';
const STATIC_ASSETS = ['/', '/index.html', '/style.css', '/script.js', '/icon-192.png', '/manifest.json'];

// Install: cache static assets and skip waiting immediately
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS))
    );
    self.skipWaiting(); // Activate new SW instantly
});

// Activate: delete ALL old caches immediately
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim()) // Take control of all open tabs
    );
});

// Fetch: Network-first for HTML/JS/CSS, cache-first for images
self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);

    // Always fetch from network for core site files (ensures updates)
    if (url.pathname.endsWith('.html') || url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('data.json')) {
        e.respondWith(
            fetch(e.request, { cache: 'no-store' })
                .then(res => {
                    if (res.ok) {
                        const clone = res.clone();
                        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
                    }
                    return res;
                })
                .catch(() => caches.match(e.request))
        );
        return;
    }

    // TMDB API: network first, no cache
    if (url.hostname.includes('themoviedb.org') || url.hostname.includes('tmdb.org')) {
        e.respondWith(fetch(e.request).catch(() => new Response('{}', { headers: { 'Content-Type': 'application/json' } })));
        return;
    }

    // Images: cache first
    if (url.hostname.includes('image.tmdb.org') || e.request.destination === 'image') {
        e.respondWith(
            caches.match(e.request).then(cached => {
                if (cached) return cached;
                return fetch(e.request).then(res => {
                    if (res.ok) {
                        const clone = res.clone();
                        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
                    }
                    return res;
                });
            })
        );
        return;
    }

    // Default: network first
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

// Push notifications
self.addEventListener('push', e => {
    const data = e.data ? e.data.json() : { title: 'CineNova', body: 'New content available!' };
    e.waitUntil(
        self.registration.showNotification(data.title || 'CineNova', {
            body: data.body || 'New movies and series are available!',
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            image: data.image || '/og-image.png',
            tag: 'cinenova-update',
            renotify: true,
            data: { url: data.url || '/' },
            actions: [
                { action: 'open', title: 'Watch Now' },
                { action: 'dismiss', title: 'Later' }
            ]
        })
    );
});

self.addEventListener('notificationclick', e => {
    e.notification.close();
    if (e.action === 'dismiss') return;
    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            const url = e.notification.data?.url || '/';
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) return clients.openWindow(url);
        })
    );
});
