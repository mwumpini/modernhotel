// Self-destroying service worker.
//
// A previous version cached Next.js static chunks with a cache-first strategy.
// After any rebuild/deploy the chunk hashes change, but the old worker kept
// serving the stale `webpack.js` and chunk files from its cache — files that no
// longer exist on the server — which surfaced as a persistent ChunkLoadError
// that a hard refresh could not clear (the worker sits in front of the network).
//
// This version takes control, deletes every cache it owns, unregisters itself,
// and reloads any open tabs so the app always loads fresh from the network.
// (The app does not register a service worker in development; a proper PWA /
// offline strategy can be reintroduced later with network-first navigations.)

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    } catch (e) {
      // best-effort cache purge
    }
    try {
      await self.registration.unregister();
    } catch (e) {
      // ignore
    }
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((client) => client.navigate(client.url));
  })());
});
