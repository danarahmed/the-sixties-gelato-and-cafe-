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

/*
 * Warnings on your phone (0072): the app sends each of the café's new
 * warnings, already in this phone's language; the phone shows it, and a tap
 * opens the page to act on it (only the app's own pages).
 */
self.addEventListener("push", (event) => {
  let w = {};
  try {
    w = event.data ? event.data.json() : {};
  } catch {
    w = { title: event.data ? event.data.text() : "" };
  }
  const title = typeof w.title === "string" && w.title ? w.title : "The Sixty's Gelato & Café";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof w.body === "string" ? w.body : "",
      tag: typeof w.tag === "string" ? w.tag : undefined,
      dir: w.dir === "rtl" ? "rtl" : "ltr",
      lang: typeof w.lang === "string" ? w.lang : undefined,
      icon: "/icon.svg",
      badge: "/icon.svg",
      requireInteraction: w.urgent === true,
      data: { url: typeof w.url === "string" ? w.url : "/dashboard" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data && event.notification.data.url;
  const url = new URL(
    typeof path === "string" && path.startsWith("/") && !path.startsWith("//") ? path : "/dashboard",
    self.location.origin,
  ).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (new URL(w.url).origin === self.location.origin && "focus" in w) {
          return w.navigate(url).then((c) => (c || w).focus());
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
