// Service Worker — recebe as notificações push mesmo com o app fechado.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let dados = {};
  try {
    dados = event.data ? event.data.json() : {};
  } catch {
    dados = { body: event.data && event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(dados.title || 'Agenda a Dois', {
      body: dados.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: dados.tag,
      data: { url: dados.url || '/' },
    })
  );
});

// Tocar na notificação abre (ou traz para frente) o app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const j of janelas) {
        if ('focus' in j) return j.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
