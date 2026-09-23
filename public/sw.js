/*
 * Service worker for The Sixty's Gelato & Café.
 *
 * What it does, and no more:
 *   - Caches the app's STATIC files (scripts, styles, icons) so the app opens
 *     quickly, and a small offline notice.
 *   - Pages are always fetched from the network. They carry the business's
 *     books and are private to the person signed in, so no page is ever kept
 *     in the cache — a shared till must not show yesterday's figures to the
 *     next person, signed in or not.
 *   - When there is no connection, a page request gets the offline notice.
 *
 * Nothing is queued while offline: a sale cannot be recorded until the
 * connection returns, and the app says so (audit H-04). Each sale carries an
 * idempotency key minted by the till, so retrying after a dropped connection
 * never records it twice.
 */
const CACHE = "sixties-static-v2";
const PRECACHE = ["/offline.html", "/manifest.webmanifest", "/icon.svg", "/icon-maskable.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

// Drop every older cache — including v1, which held whole pages.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isStatic(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    PRECACHE.includes(url.pathname) ||
    /\.(?:css|js|svg|png|woff2?)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // never touch a write
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
    return;
  }

  if (isStatic(url)) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
  // Everything else (data, server actions) goes straight to the network.
});
