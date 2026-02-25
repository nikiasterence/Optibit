/* ======================================
   OPTIBIT - Service Worker
   Offline-first PWA caching strategy
   ====================================== */

const CACHE_NAME = 'optibit-v2.3.0';
const OFFLINE_FALLBACK = '/app.html';
const APP_SHELL = [
    '/',
    '/index.html',
    '/app.html',
    '/style.css',
    '/app.css',
    '/animations.css',
    '/main.js',
    '/app.js',
    '/particles.js',
    '/manifest.json',
    '/icon.png',
    '/sajid-hossain.jpg',
    '/cozytustudios-logo.svg',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap',
    'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css'
];

async function putInCache(cache, asset) {
    try {
        const isExternal = asset.startsWith('http');
        const req = isExternal ? new Request(asset, { mode: 'no-cors' }) : new Request(asset, { cache: 'reload' });
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') {
            await cache.put(req, res.clone());
        }
    } catch (err) {
        console.warn('Optibit SW: asset cache skipped ->', asset, err);
    }
}

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await Promise.all(APP_SHELL.map((asset) => putInCache(cache, asset)));
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.protocol.startsWith('chrome-extension')) return;

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);

        // App shell navigation: network first, then offline fallback.
        if (request.mode === 'navigate') {
            try {
                const fresh = await fetch(request);
                cache.put(request, fresh.clone());
                return fresh;
            } catch (err) {
                const cachedPage = await caches.match(request);
                if (cachedPage) return cachedPage;
                return (await caches.match(OFFLINE_FALLBACK)) || (await caches.match('/index.html'));
            }
        }

        // Cache-first for styles/scripts/images/fonts for better offline behavior.
        const isStatic = ['style', 'script', 'image', 'font'].includes(request.destination);
        if (isStatic) {
            const cached = await caches.match(request);
            if (cached) return cached;
            try {
                const fresh = await fetch(request);
                if (fresh.ok || fresh.type === 'opaque') {
                    cache.put(request, fresh.clone());
                }
                return fresh;
            } catch (err) {
                return cached || Response.error();
            }
        }

        // Default: network first with cache fallback.
        try {
            const fresh = await fetch(request);
            if (fresh.ok || fresh.type === 'opaque') {
                cache.put(request, fresh.clone());
            }
            return fresh;
        } catch (err) {
            return (await caches.match(request)) || Response.error();
        }
    })());
});
