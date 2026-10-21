/* ============================================================
   Texter — FCM Web Push service worker
   Registered at scope /fcm/ so it can run ALONGSIDE the PWA cache
   worker (public/sw.js at root scope). Sends push notifications for:
     - new chat messages
     - incoming audio / video calls
   The SDK version here does NOT need to match the app SDK version.
   ============================================================ */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBcX3YFgio1HJ0p1xFlqVhqlobk8SqaxZ4',
  authDomain: 'resounding-pottery-ljlsj.firebaseapp.com',
  projectId: 'resounding-pottery-ljlsj',
  storageBucket: 'resounding-pottery-ljlsj.firebasestorage.app',
  messagingSenderId: '104845491272',
  appId: '1:104845491272:web:81121a4a633d881b59ac7d',
});

const messaging = firebase.messaging();

/* ---------- Click handling: focus or open the app on the right chat ---------- */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  let inner = 'chats'; // default hash route
  if (data.type === 'message' && data.convId) {
    inner = `chat/${data.convId}`;
  }
  const url = `${self.location.origin}/#/`;
  const target = `${url}${inner}`;

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin)) {
          await client.focus();
          client.postMessage({
            type: 'TEXTER_NAVIGATE',
            route: data.type === 'message' && data.convId ? `#/chat/${data.convId}` : '#/chats',
          });
          return;
        }
      }
      await self.clients.openWindow(target);
    })()
  );
});
