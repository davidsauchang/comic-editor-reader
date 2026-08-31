// ============================================================
// 📦 SERVICE WORKER — MangaMesh PWA
// ============================================================

const CACHE_NAME = 'mangamesh-v14';

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
  'js/mobile-layout.js',
  
  // PWA files
  'manifest.json',
  
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
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request)
          .then((response) => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            return response;
          });
      })
  );
});