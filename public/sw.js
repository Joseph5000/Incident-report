const CACHE_NAME = 'tactical-map-cache-v1';
const MAP_TILE_DOMAINS = [
  'basemaps.cartocdn.com',
  'openstreetmap.org'
];

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Cache map tiles (Stale-While-Revalidate strategy)
  const isTileRequest = MAP_TILE_DOMAINS.some(domain => url.hostname.includes(domain));
  
  if (isTileRequest) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          // Only cache successful responses
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          // Return cached response if network fails
          return cachedResponse;
        });

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }
});
