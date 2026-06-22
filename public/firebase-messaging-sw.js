/* Pom Pond — FCM background message handler.
   Receives data-only push messages and shows the notification, then opens the
   app on click. Self-contained (a service worker can't import the app's config
   module), so the PUBLIC Firebase config is inlined here (web config isn't a
   secret — security lives in rules + functions). Keep in sync with
   public/js/firebase-config.js. */
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBQehiZrzCvikQ7ry8Bs0vTczaaCYRRVv0',
  authDomain: 'pom-pond.firebaseapp.com',
  projectId: 'pom-pond',
  storageBucket: 'pom-pond.firebasestorage.app',
  messagingSenderId: '802506405237',
  appId: '1:802506405237:web:e976c8b7f213fec1c18f3c'
});

const messaging = firebase.messaging();

// We send DATA-only messages from the server so this handler controls display.
messaging.onBackgroundMessage(function (payload) {
  const d = payload.data || {};
  self.registration.showNotification(d.title || 'Pom Pond 🐸', {
    body: d.body || 'Time to do today’s chores and feed your pond!',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: d.tag || 'pompond',
    data: { link: d.link || '/index.html' }
  });
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  const link = (e.notification.data && e.notification.data.link) || '/index.html';
  e.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { if ('focus' in c) { try { c.navigate(link); } catch (_) {} return c.focus(); } }
    if (clients.openWindow) return clients.openWindow(link);
  })());
});
