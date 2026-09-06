const LEGACY_CACHE_PREFIXES = ['synthetiq-panel', 'wonka-admin'];

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => LEGACY_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)))
      .map((key) => caches.delete(key)));
    await self.clients.claim();
    await self.registration.unregister();
  })());
});
