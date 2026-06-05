const CACHE_NAME = "rrgaming-v1";

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./kasir.html",
  "./owner.html",
  "./app.js",
  "./manifest.json",
  "./rrg.png"
];

// Install
self.addEventListener("install", (event) => {
  console.log("Service Worker terinstall");

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(FILES_TO_CACHE))
  );

  self.skipWaiting();
});

// Activate
self.addEventListener("activate", (event) => {
  console.log("Service Worker aktif");

  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      )
    )
  );

  self.clients.claim();
});

// Fetch
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        return response || fetch(event.request);
      })
  );
});
