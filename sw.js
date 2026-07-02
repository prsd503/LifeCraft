const CACHE_NAME = 'lifecraft-cache-v1';
const RUNTIME_CACHE = 'lifecraft-runtime-v1';

// Core assets that must be cached for offline support
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// External CDN assets
const CDN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js',
  'https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Cinzel:wght@700&family=Fredoka+One&family=Montserrat:wght@700&display=swap'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Cache core app files
        return cache.addAll(CORE_ASSETS)
          .then(() => {
            // Cache CDN assets separately (don't fail if CDN is unavailable)
            return Promise.allSettled(
              CDN_ASSETS.map(url => cache.add(url))
            );
          });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - intelligent caching strategy
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome extensions and other non-http protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Strategy 1: Network first for HTML, then cache
  if (url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(RUNTIME_CACHE)
              .then(cache => cache.put(request, responseToCache));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request)
            .then(cached => cached || caches.match('./index.html'));
        })
    );
    return;
  }

  // Strategy 2: Cache first for CSS, JS, images, fonts
  if (request.destination === 'style' || 
      request.destination === 'script' || 
      request.destination === 'image' || 
      request.destination === 'font' ||
      url.pathname.endsWith('.json')) {
    event.respondWith(
      caches.match(request)
        .then(cached => {
          if (cached) {
            return cached;
          }
          return fetch(request)
            .then(response => {
              if (response && response.status === 200) {
                const responseToCache = response.clone();
                caches.open(RUNTIME_CACHE)
                  .then(cache => cache.put(request, responseToCache));
              }
              return response;
            })
            .catch(() => {
              // Return offline asset if available
              if (request.destination === 'image') {
                return new Response(
                  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><text x="50" y="50" text-anchor="middle">Offline</text></svg>',
                  { headers: { 'Content-Type': 'image/svg+xml' } }
                );
              }
              return null;
            });
        })
    );
    return;
  }

  // Strategy 3: Network first for API calls and dynamic content
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(RUNTIME_CACHE)
            .then(cache => cache.put(request, responseToCache));
        }
        return response;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});

// Message handler for cache management
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      });
  }
});
