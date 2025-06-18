const CACHE_NAME = 'rfc-explorer-v2';
const PRECACHE_URLS = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/ace/1.9.6/ace.js'
];

// Listen for the service worker installation event
self.addEventListener('install', event => {
  // Pre-cache essential application assets for offline use
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      // Activate this service worker immediately, bypassing waiting phase
      .then(() => self.skipWaiting())
  );
});

// Listen for the service worker activation event
self.addEventListener('activate', event => {
  // Clean up any old caches that do not match the current version
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
    // Take control of all clients as soon as activation completes
    .then(() => self.clients.claim())
  );
});

// Intercept all fetch requests
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Apply a stale-while-revalidate strategy for RFC content fetched via CORS proxy
  if (
    url.origin === 'https://datatracker.ietf.org' ||
    url.origin === 'https://corsproxy.io'
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(event.request).then(cached => {
          // Fetch a fresh copy in the background
          const networkFetch = fetch(event.request).then(response => {
            if (response.ok) {
              // Update the cache with the latest response
              cache.put(event.request, response.clone());
            }
            return response;
          });
          // Serve cached version if available, otherwise wait for network
          return cached || networkFetch;
        })
      )
    );
    return; // Exit early to skip generic cache-first logic
  }

  // For all other requests, use cache-first strategy
  event.respondWith(
    caches.match(event.request).then(response =>
      response || fetch(event.request)
    )
  );
});
