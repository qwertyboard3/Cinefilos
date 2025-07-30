const CACHE_NAME = "cinefilos-v4";
const API_CACHE = "cinefilos-omdb-api-v1";
const API_TTL = 86400000; // 1 day in ms

const STATIC_FILES = [
  "./",
  "./index.html",
  "./assets/manifest.json",
  "./assets/script.js",
  "./assets/entries.js",
  "./assets/cinefilos.png",
  "./assets/Button.PNG",
  "./assets/Button2.PNG",
  "./assets/sounds/pick.wav",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png"
];

// ---- INSTALL ----
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_FILES))
  );
  console.log("[SW] Installed");
});

// ---- ACTIVATE ----
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME && k !== API_CACHE).map(k => caches.delete(k)))
    )
  );
  console.log("[SW] Activated");
});

// ---- FETCH ----
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // ✅ Cache OMDb API responses
  if (url.hostname === "www.omdbapi.com") {
    event.respondWith(cacheAPIRequest(event.request));
    return;
  }

  // ✅ Cache static files
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).catch(() => {
        // Optional: return a fallback image if offline
      });
    })
  );
});

// ---- API Caching Function ----
async function cacheAPIRequest(request) {
  const cache = await caches.open(API_CACHE);

  // Check if cached and still fresh
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    const cachedDate = new Date(cachedResponse.headers.get("sw-cache-date"));
    if (Date.now() - cachedDate.getTime() < API_TTL) {
      return cachedResponse;
    }
  }

  // Fetch fresh data and store with timestamp
  const networkResponse = await fetch(request);
  const clonedResponse = networkResponse.clone();

  const headers = new Headers(clonedResponse.headers);
  headers.append("sw-cache-date", new Date().toISOString());

  const modifiedResponse = new Response(clonedResponse.body, {
    status: clonedResponse.status,
    statusText: clonedResponse.statusText,
    headers
  });

  cache.put(request, modifiedResponse.clone());
  return modifiedResponse;
}
