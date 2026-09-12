// service-worker.js — caches the static app shell for offline opening.
// Generation itself always needs a live network connection (to Puter.js,
// or directly to Claude/Gemini for bring-your-own-key), so it can't work
// offline — this only protects the shell (HTML/CSS/JS/icons).
//
// Registered with a relative path from index.html, and every asset below
// is relative too, so this works correctly whether the site is served
// from a domain root or a GitHub Pages project subpath.

const CACHE_NAME = "kimpto-shell-v1";
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/main.js",
  "./js/ui.js",
  "./js/dom.js",
  "./js/icons.js",
  "./js/catalog.js",
  "./js/api.js",
  "./js/voice.js",
  "./js/storage.js",
  "./manifest.webmanifest",
  "./data/techniques.json",
  "./data/models.json",
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

  // Never cache calls to Puter.js or any provider's API — those must
  // always hit the network live.
  if (url.origin !== self.location.origin) return;

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
