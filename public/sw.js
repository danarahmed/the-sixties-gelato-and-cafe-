/*
 * Service worker for The Sixty's Gelato & Café PWA.
 *
 * Strategy:
 *   - Precache the app shell so the UI opens offline.
 *   - Navigations: network-first, fall back to the cached shell when offline
 *     (so the SPA still loads and can serve queued offline sales).
 *   - Static assets: stale-while-revalidate.
 *
 * Offline SALES are queued in IndexedDB by the app with UUID idempotency keys
 * and replayed on reconnect; the server's UNIQUE(idempotency_key) constraint
 * guarantees exactly-once application. This worker handles asset/shell caching;
 * the transaction queue lives in the app layer.
 */
const CACHE = "sixties-shell-v1";
const SHELL = ["/dashboard", "/pos", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // never cache mutations

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // let cross-origin pass through

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("/dashboard"))),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
