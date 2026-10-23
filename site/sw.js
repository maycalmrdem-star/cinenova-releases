// ChatHup Service Worker — offline app shell, push notifications.
// This file is a template: vite.config.ts injects the build version and the
// list of emitted assets, then writes it to dist/sw.js.
const VERSION = 'mvlhcl7x';
const CACHE_NAME = `chathup-shell-${VERSION}`;
const RUNTIME_CACHE = 'chathup-runtime-v1';
const PRECACHE = [
  "/",
  "/app.html",
  "/assets/ibm-plex-sans-arabic-latin-ext-400-normal-BpLfq-63.woff2",
  "/assets/ibm-plex-sans-arabic-arabic-400-normal-CyU-ddYS.woff2",
  "/assets/ibm-plex-sans-arabic-latin-400-normal-Bo5KPYvw.woff2",
  "/assets/ibm-plex-sans-arabic-latin-ext-500-normal-Ck_W4G78.woff2",
  "/assets/ibm-plex-sans-arabic-latin-500-normal-Cd6jVIg7.woff2",
  "/assets/ibm-plex-sans-arabic-arabic-500-normal-C4MQITzh.woff2",
  "/assets/inter-cyrillic-ext-wght-normal-BOeWTOD4.woff2",
  "/assets/inter-cyrillic-wght-normal-DqGufNeO.woff2",
  "/assets/inter-greek-ext-wght-normal-DlzME5K_.woff2",
  "/assets/inter-greek-wght-normal-CkhJZR-_.woff2",
  "/assets/inter-latin-wght-normal-Dx4kXJAl.woff2",
  "/assets/inter-vietnamese-wght-normal-CBcvBZtf.woff2",
  "/assets/inter-latin-ext-wght-normal-DO1Apj_S.woff2",
  "/assets/ibm-plex-sans-arabic-arabic-600-normal-0pRdybE_.woff2",
  "/assets/ibm-plex-sans-arabic-latin-ext-600-normal-DjDAeNQD.woff2",
  "/assets/ibm-plex-sans-arabic-latin-600-normal-KrqB56Mw.woff2",
  "/assets/ibm-plex-sans-arabic-latin-700-normal-BzSf6GNr.woff2",
  "/assets/ibm-plex-sans-arabic-latin-ext-700-normal-BSbyEp0V.woff2",
  "/assets/ibm-plex-sans-arabic-arabic-700-normal-DrtBj6UE.woff2",
  "/assets/download-CpuHpR_T.css",
  "/assets/main-DAbghsNG.css",
  "/assets/vendor-supabase-BQG8AYB1.js",
  "/assets/vendor-icons-C3jA89uA.js",
  "/assets/vendor-react-iE_EZxVv.js",
  "/assets/download-D_sIliLR.js",
  "/assets/main-BzC7cDLA.js",
  "/assets/modulepreload-polyfill-B5Qt9EMX.js",
  "/assets/Home-iiY8Lfhy.js",
  "/assets/Messaging-BXsBGXg6.js",
  "/assets/Profile-BZzzdSAn.js",
  "/assets/CreatePostModal-_bSykW3s.js",
  "/assets/Reels-DoalydEB.js",
  "/assets/CommentSheet-GCwzK8s6.js",
  "/assets/Settings-nXUTvwg5.js",
  "/assets/EditProfileModal-CxQQ-2WM.js",
  "/assets/Search-mlgmxrlW.js",
  "/assets/CameraMode-CPznFKjB.js",
  "/assets/music-CxsY4fuq.js",
  "/assets/PrimeBadge-BarMC9kP.js",
  "/assets/AdminLayout-BfMCv9UC.js",
  "/assets/Groups-DHfWzHhX.js",
  "/assets/Marketplace-CA6Pu0vN.js",
  "/assets/Notifications-CWOQCvza.js",
  "/assets/NearbyView-_SW5TQA4.js",
  "/assets/LandingPage-B3daHf4z.js",
  "/assets/CallScreen-lJFbxfiu.js",
  "/assets/IncomingCallModal-ChbXP74-.js",
  "/assets/StoryStudio-E1GVv3au.js",
  "/assets/StoryViewer-DNeuKs4P.js",
  "/assets/StoryStage-BmoC1Wea.js",
  "/default-avatar.svg",
  "/favicon.ico",
  "/icon-192.png",
  "/icon-512.png",
  "/image-unavailable.svg",
  "/logo.png",
  "/manifest.json"
];

// Install — precache the whole app shell so the app (and the Bluetooth mesh
// chat) opens with no network at all.
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE))
            .then(() => self.skipWaiting())
    );
});

// Activate — drop shells from older builds.
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k.startsWith('chathup-shell-') && k !== CACHE_NAME).map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

const isSameOrigin = (url) => url.origin === self.location.origin;

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);

    // Never cache API traffic (Supabase etc.) — it is private and dynamic.
    if (!isSameOrigin(url)) return;

    // Navigations: network first, fall back to the cached page, then the app shell.
    // Separate pages (like /download/) are cached under their own URL so they never
    // replace the app shell.
    if (request.mode === 'navigate') {
        const isAppShell = url.pathname === '/app' || url.pathname.startsWith('/app/');
        if (!isAppShell) return; // the landing page is a plain website
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(isAppShell ? '/app.html' : request, copy));
                    }
                    return response;
                })
                .catch(() => caches.match(isAppShell ? '/app.html' : request).then(r => r || caches.match('/app.html')))
        );
        return;
    }

    // Hashed build assets are immutable: cache first.
    if (url.pathname.startsWith('/assets/')) {
        event.respondWith(
            caches.match(request).then(cached => cached || fetch(request).then(response => {
                if (response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
                }
                return response;
            }))
        );
        return;
    }

    // Everything else same-origin: stale-while-revalidate.
    event.respondWith(
        caches.match(request).then(cached => {
            const network = fetch(request)
                .then(response => {
                    if (response.ok) {
                        const copy = response.clone();
                        caches.open(RUNTIME_CACHE).then(cache => cache.put(request, copy));
                    }
                    return response;
                })
                .catch(() => cached);
            return cached || network;
        })
    );
});

// Push notification event
self.addEventListener('push', (event) => {
    let data = {
        title: 'ChatHup',
        body: 'لديك رسالة جديدة',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'chathup-message',
        data: { url: '/app' }
    };

    if (event.data) {
        try {
            const payload = event.data.json();
            data = {
                title: payload.title || data.title,
                body: payload.body || data.body,
                icon: payload.icon || data.icon,
                badge: data.badge,
                tag: payload.tag || data.tag,
                data: payload.data || data.data,
                image: payload.image || undefined
            };
        } catch (e) {
            data.body = event.data.text() || data.body;
        }
    }

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: data.icon,
            badge: data.badge,
            tag: data.tag,
            data: data.data,
            image: data.image,
            vibrate: [200, 100, 200],
            actions: [
                { action: 'open', title: 'فتح المحادثة' },
                { action: 'close', title: 'إغلاق' }
            ],
            renotify: true
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    if (event.action === 'close') return;
    const urlToOpen = event.notification.data?.url || '/app';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            return self.clients.openWindow(urlToOpen);
        })
    );
});
