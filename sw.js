// ============================================================
// ðŸ“¦ SERVICE WORKER â€” MangaMesh PWA
// ============================================================

const CACHE_NAME = 'mangamesh-v27';

// Only list files that ACTUALLY EXIST in your project
const ASSETS = [
  // HTML
  'index.html',
  
  // CSS
  'css/style.css',
  'css/mobile.css',
  
  // JavaScript - ONLY list files that exist
  'js/main.js',
  'js/state.js',
  'js/actions.js',
  'js/canvas.js',
  'js/interactions.js',
  'js/export.js',
  'js/settings.js',
  'js/panel-visibility.js',
  'js/folder-import.js',
  
  // PWA files
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  
  // External Libraries (CDN)
  'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
];

// --- Install: Cache assets ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching assets...');
        return cache.addAll(ASSETS)
          .then(() => {
            console.log('[SW] All assets cached successfully!');
          })
          .catch((error) => {
            console.warn('[SW] Some assets failed to cache:', error);
            // Skip the failed file and continue
            return Promise.resolve();
          });
      })
      .then(() => self.skipWaiting())
  );
});

// --- Activate: Clean old caches ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});
// --- Fetch: Serve from cache, fallback to network ---
// Navigation requests (page loads & subpath URLs like /mangamesh/) fall
// back to the cached index.html so deep links work offline and any
// path-based 404 from a subpath host is absorbed by the app shell.
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // HTML navigation requests: network-first (fresh HTML), fall back to cache.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('index.html', clone));
          return response;
        })
        .catch(() => caches.match('index.html'))
    );
    return;
  }

  // Assets: cache-first, network fallback.
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request)
          .then((response) => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseToCache);
              });
            return response;
          });
      })
  );
});
