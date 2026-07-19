// Registered manually (see src/app/utils/notifications.ts) at a scope
// separate from the Workbox PWA service worker, so it doesn't conflict with
// vite-plugin-pwa's generated sw.js at the default '/' scope. This SW's only
// job is showing a notification for a push that arrives while no tab has the
// app focused. Foreground messages (tab open) are caught in-page instead
// (onMessage in notifications.ts) and shown via this same registration's
// showNotification (see showLocalNotification), so a push looks the same
// whether or not the app happens to be open.
importScripts('https://www.gstatic.com/firebasejs/12.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.13.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCaC-6Jrjgm3cpgi7outr5t-IKPuZ4ipa0',
  authDomain: 'dapurnyonya-9b752.firebaseapp.com',
  projectId: 'dapurnyonya-9b752',
  storageBucket: 'dapurnyonya-9b752.firebasestorage.app',
  messagingSenderId: '236811840368',
  appId: '1:236811840368:web:f1acde48db24122ac93db5',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  const link = payload.fcmOptions?.link || payload.data?.link || '/';
  self.registration.showNotification(title || 'DapurNyonya', {
    body: body || '',
    icon: '/pwa/icon-192.png',
    data: { link },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || '/';
  event.waitUntil(clients.openWindow(link));
});
