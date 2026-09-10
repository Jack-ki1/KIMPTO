// service-worker.js — caches the static app shell so Kimpto still opens
// (to a "you're offline" experience for the UI chrome) without a network
// connection. Generation itself always needs a network round trip (to
// Puter.js or to this app's own /api/ routes), so it can't work offline —
// this only protects the shell.

const CACHE_NAME = "kimpto-shell-v1";
const SHELL_ASSETS = [
  "/",
  "/static/css/styles.css",
  "/static/js/main.js",
  "/static/js/ui.js",
  "/static/js/dom.js",
  "/static/js/icons.js",
  "/static/js/catalog.js",
  "/static/js/api.js",
  "/static/js/voice.js",
  "/static/js/storage.js",
  "/static/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never cache API calls or third-party model calls — those must always
  // hit the network live.
  if (url.pathname.startsWith("/api/") || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
