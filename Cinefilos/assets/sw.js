// assets/sw.js

const CACHE_NAME = "cinefilos-v1";
const CACHE_FILES = [
  "/",                         // root (index.html)
  "/index.html",               // explicitly cache index.html
  "/assets/manifest.json",
  "/assets/script.js",
  "/assets/entries.js",
  "/assets/cinefilos.png",
  "/assets/Button.PNG",
  "/assets/Button2.PNG",
  "/assets/sounds/pick.wav",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png"
];

// Install event
self.addEventListener("install", event => {
  console.log("[SW] Installing…");
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CACHE_FILES))
  );
});

// Activate event
self.addEventListener("activate", event => {
  console.log("[SW] Activating…");
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
});

// Fetch event
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response =>
      response || fetch(event.request).then(fetchRes => {
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, fetchRes.clone());
          return fetchRes;
        });
      })
    )
  );
});
