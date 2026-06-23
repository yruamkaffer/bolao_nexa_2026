const CACHE_NAME = 'bolao-nexa-final-bracket-v1';

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  // Sempre prioriza rede para não travar HTML/API antigos.
  event.respondWith(fetch(request, { cache: 'no-store' }).catch(() => caches.match(request)));
});
