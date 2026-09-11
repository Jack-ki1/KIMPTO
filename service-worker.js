// service-worker.js — caches the static app shell so Kimpto still opens
// (to a "you're offline" experience for the UI chrome) without a network
// connection. Generation itself always needs a live network round trip
// (to Puter.js or directly to whichever provider you picked in Settings),
// so it can't work offline — this only protects the shell.
//
// All paths here are relative to this file's own location, which matters
// for GitHub Pages project sites served from a subpath
// (https://username.github.io/repo-name/) rather than a domain root.

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

  // Never cache calls to Puter.js or any provider API — those must always
  // hit the network live, and none of them share this origin.
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
