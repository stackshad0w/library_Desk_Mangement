/* Swami Abhyasika service worker — offline app shell caching.
 * Cache-first for same-origin static assets; API calls are never cached. */
const CACHE = 'swami-v6';
const ASSETS = [
  '/',
  '/pages/login.html',
  '/pages/dashboard.html',
  '/manifest.webmanifest',
  '/img/icon.svg',
  '/css/variables.css',
  '/css/global.css',
  '/css/components.css',
  '/css/pages/dashboard.css',
  '/css/pages/login.css',
  '/js/app.js',
  '/js/modules/api.js',
  '/js/modules/auth.js',
  '/js/modules/dashboard.js',
  '/js/modules/students.js',
  '/js/modules/fees.js',
  '/js/modules/reminders.js',
  '/js/modules/settings.js',
  '/js/modules/export.js',
  '/js/modules/command-palette.js',
  '/js/modules/whatsapp.js',
  '/js/modules/seats.js',
  '/js/utils/constants.js',
  '/js/utils/helpers.js',
  '/js/utils/theme.js',
  '/js/utils/toast.js',
  '/js/utils/tooltip.js',
  '/js/utils/validation.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS).catch(() => {})) // tolerate a missing asset
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // leave cross-origin (CDN/wa.me) to the network
  if (url.pathname.startsWith('/api/')) return;     // never cache API responses

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
