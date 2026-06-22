/* Pom Pond service worker.
   NETWORK-FIRST for the app shell + same-origin code (index.html, js/*) so a new
   deploy is picked up immediately when online; falls back to cache offline.
   Firestore/Auth/Functions traffic is never touched (the SDK manages it). Bump
   CACHE on any shell change — the no-cache header on sw.js makes the browser
   revalidate this file, and a changed CACHE name purges every old cache on
   activate, so clients can never get stuck on stale code. */
const CACHE = 'pompond-v3';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './js/cloud.js',
  './js/firebase-config.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Never cache Firestore/Functions/Auth traffic — let the SDK manage it.
  if (/firestore\.googleapis|firebaseio|identitytoolkit|googleapis\.com\/.*cloudfunctions|cloudfunctions\.net/.test(url.href)) return;

  const sameOrigin = url.origin === self.location.origin;

  // App shell + same-origin code: NETWORK-FIRST so deploys land immediately;
  // fall back to cache (then the cached index.html for navigations) when offline.
  if (req.mode === 'navigate' || sameOrigin) {
    e.respondWith(
      fetch(req).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {}); }
        return res;
      }).catch(() => caches.match(req).then((r) => r || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
    );
    return;
  }

  // Cross-origin (CDN SDK, fonts — versioned URLs): stale-while-revalidate.
  e.respondWith(
    caches.match(req).then((cached) => {
      const net = fetch(req).then((res) => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
