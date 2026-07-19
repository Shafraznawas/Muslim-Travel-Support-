const CACHE_NAME = 'qibla-sky-shell-v3';
const SHELL_URLS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Only handle the app shell itself. Nearby-search calls (Overpass, Google
  // Maps, etc.) are cross-origin and should pass straight through untouched —
  // they're expected to fail offline and the app already handles that.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      // Cache-first: an in-flight app can't afford to wait out a network
      // timeout on a flaky captive-portal/weak-signal connection before
      // falling back — serve the known-good cached shell instantly, every
      // time, and refresh it quietly in the background when online.
      const network = fetch(req).then((res) => {
        if (res && res.ok) {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        }
        return res;
      }).catch(() => null);

      if (cached) {
        network.catch(() => {}); // update the cache silently, ignore failures
        return cached;
      }
      return network.then((res) => res || caches.match('./index.html', { ignoreSearch: true }));
    })
  );
});
