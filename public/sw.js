const CACHE_NAME = 'inventaire-pro-cache-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Skip WebSocket connections
  if (url.pathname.startsWith('/api/ws') || event.request.headers.get('Upgrade') === 'websocket') {
    return;
  }

  // 2. API requests
  if (url.pathname.startsWith('/api/')) {
    // Non-GET API calls (POST, PUT, DELETE) must pass through directly to server or be handled by offline queue
    if (event.request.method !== 'GET') {
      return;
    }
    // GET API endpoints: network-first with 2500ms timeout
    event.respondWith(
      (async () => {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 2500);
          const networkResponse = await fetch(event.request, { signal: controller.signal });
          clearTimeout(timer);
          if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          return new Response(JSON.stringify({ success: false, offline: true }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
      })()
    );
    return;
  }

  // 3. Navigation requests (HTML document)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 2500);
          const response = await fetch(event.request, { signal: controller.signal });
          clearTimeout(timer);
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(event.request, response.clone());
          }
          return response;
        } catch {
          const cached = await caches.match('/index.html') || await caches.match('/');
          if (cached) return cached;
          throw new Error('Offline and not cached');
        }
      })()
    );
    return;
  }

  // 4. Static assets (JS, CSS, images, fonts)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to keep cache fresh
        fetch(event.request).then(async (networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(event.request, networkResponse);
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request).then(async (networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      });
    })
  );
});
