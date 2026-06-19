/* Pom Pond service worker — offline-first app shell.
   Precaches the local shell so the app launches with no signal; Firestore's own
   offline persistence (js/cloud.js) handles family DATA offline and reconciles on
   reconnect. Firebase SDK + fonts load from their CDNs and are cached at runtime.
   Bump CACHE on any shell change (the no-cache header on sw.js ensures this file
   itself is always revalidated). */
const CACHE = 'pompond-v1';
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

  // App navigations: serve the cached shell first, fall back to network.
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./index.html').then((r) => r || fetch(req)).catch(() => caches.match('./index.html')));
    return;
  }

  // Same-origin assets: cache-first. Cross-origin (CDN SDK, fonts): stale-while-revalidate.
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
