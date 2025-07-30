// assets/sw.js

const CACHE_NAME = "cinefilos-v1";
const CACHE_FILES = [
  "./",                        // root (index.html)
  "../index.html",             // one level up from assets
  "./manifest.json",
  "./script.js",
  "./entries.js",
  "./cinefilos.png",
  "./Button.PNG",
  "./Button2.PNG",
  "./sounds/pick.wav",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// Install event - cache files
self.addEventListener("install", event => {
  console.log("[SW] Installing...");
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CACHE_FILES);
    })
  );
});

// Activate event - cleanup old caches
self.addEventListener("activate", event => {
  console.log("[SW] Activating...");
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      // Cache hit
      if (response) {
        return response;
      }
      // Fetch from network and cache
      return fetch(event.request).then(networkResponse => {
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      }).catch(() => {
        // Optional: return fallback content here
      });
    })
  );
});
