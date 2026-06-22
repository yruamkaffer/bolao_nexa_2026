const CACHE_NAME = 'bolao-nexa-v1-20260622';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png'
];

function mustBypassCache(url) {
  return url.pathname.startsWith('/api/') ||
    url.hostname.includes('docs.google.com') ||
    url.hostname.includes('googleusercontent.com') ||
    url.hostname.includes('ge.globo.com') ||
    url.hostname.includes('globoesporte.globo.com');
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (mustBypassCache(url)) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }

  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const copy = response.clone();
        if (response.ok && ['document', 'style', 'script', 'image', 'manifest'].includes(event.request.destination || 'document')) {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
