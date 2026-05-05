// ============================================================
//  Service Worker — Monitor de Passagens
//  Cache offline + atualização automática
// ============================================================

const CACHE_NAME = 'passagens-v1';
const ASSETS = [
  '/',
  '/index.html',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'
];

// Instala e faz cache dos assets principais
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Remove caches antigos ao ativar
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

// Estratégia: Network First com fallback para cache
self.addEventListener('fetch', function(event) {
  // Ignora requisições para o Worker/API — sempre online
  if (event.request.url.includes('passagens-proxy') ||
      event.request.url.includes('upstash') ||
      event.request.url.includes('resend')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        // Atualiza cache com resposta nova
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });
        return response;
      })
      .catch(function() {
        // Sem internet — serve do cache
        return caches.match(event.request).then(function(cached) {
          return cached || caches.match('/index.html');
        });
      })
  );
});
