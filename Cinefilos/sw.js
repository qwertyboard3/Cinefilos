
const CACHE_NAME = "cinefilos-cache-v1";
const ASSETS_TO_CACHE = [
  "/Cinefilos/Cinefilos/",
  "/Cinefilos/Cinefilos/index.html",
  "/Cinefilos/Cinefilos/assets/cinefilos.png",
  "/Cinefilos/Cinefilos/assets/button.png",
  "/Cinefilos/Cinefilos/assets/button2.png",
  "/Cinefilos/Cinefilos/assets/entries.js",
  "/Cinefilos/Cinefilos/posters/fallback.jpg",
  "/Cinefilos/Cinefilos/sounds/pick.wav",
  "/Cinefilos/Cinefilos/assets/icons/icon-192.png",
  "/Cinefilos/Cinefilos/assets/icons/icon-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});
