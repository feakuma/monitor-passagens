// ============================================================
//  Service Worker — Monitor de Passagens
//  Cache offline + Push Notifications
// ============================================================

const CACHE_NAME = 'passagens-v2';
const ASSETS = [
  '/',
  '/index.html',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE_NAME; })
            .map(function(key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  if (event.request.url.includes('passagens-proxy') ||
      event.request.url.includes('upstash') ||
      event.request.url.includes('resend')) {
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, clone); });
        return response;
      })
      .catch(function() {
        return caches.match(event.request).then(function(cached) {
          return cached || caches.match('/index.html');
        });
      })
  );
});

// PUSH NOTIFICATION
self.addEventListener('push', function(event) {
  var data = {};
  try { data = event.data.json(); } catch(e) { data = { title: 'Monitor de Passagens', message: event.data ? event.data.text() : '' }; }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Monitor de Passagens', {
      body:    data.message || '',
      icon:    '/icon-192.png',
      badge:   '/icon-192.png',
      data:    { url: data.url || 'https://passagens.fetadeu.com.br' },
      vibrate: [200, 100, 200],
      tag:     'passagens-alert',
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var url = event.notification.data && event.notification.data.url ? event.notification.data.url : 'https://passagens.fetadeu.com.br';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var c of clientList) {
        if (c.url === url && 'focus' in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
