const CACHE_NAME = 'iipe-racing-cache-v1';

// Install event: skip waiting to activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event: claim clients so the service worker takes control immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Fetch event: simple pass-through network-first strategy, falling back to cache
// This is required for Chrome to show the "Install App" prompt.
self.addEventListener('fetch', (event) => {
  // For this basic PWA, we just let requests go to the network.
  // The mere presence of this fetch handler satisfies the PWA install requirement.
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
