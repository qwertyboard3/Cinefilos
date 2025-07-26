// assets/sw.js

const CACHE_NAME = 'cinefilos-static-v1';
const STATIC_ASSETS = [
  'assets/cinefilos.png',
  'assets/button.png',
  'assets/button2.png',
  'assets/sounds/pick.wav',
  'assets/manifest.json',
  // Add anything else you want to cache (only static assets)
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Activate immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('activate', event => {
  // Clear out old caches
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }))
    )
  );
  self.clients.claim(); // Take control immediately
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Don't cache HTML or index.html — always fetch from network
  if (req.mode === 'navigate' || req.url.endsWith('index.html')) {
    event.respondWith(fetch(req));
    return;
  }

  // Try cache first for static assets
  if (STATIC_ASSETS.some(asset => req.url.includes(asset))) {
    event.respondWith(
      caches.match(req).then(res => res || fetch(req))
    );
    return;
  }

  // Default: network first, fallback to cache if offline
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});
