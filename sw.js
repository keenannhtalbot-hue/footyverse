// FootyVerse service worker. Caches only same-origin, successful GET
// responses. Uses a versioned cache name so deploying a new CACHE_VERSION
// cleanly replaces old caches instead of accumulating stale entries.

const CACHE_VERSION = 'footyverse-v0.5.0';

const APP_SHELL = [
  './',
  './index.html',
  './styles/main.css',
  './manifest.webmanifest',
  './src/main.js',
  './src/engines/rng.js',
  './src/engines/playerEngine.js',
  './src/engines/worldEngine.js',
  './src/engines/eventEngine.js',
  './src/engines/relationshipEngine.js',
  './src/engines/trainingEngine.js',
  './src/engines/footballEngine.js',
  './src/engines/saveEngine.js',
  './src/engines/stateSerializer.js',
  './src/data/countries.js',
  './src/data/names.js',
  './src/data/positions.js',
  './src/data/activities.js',
  './src/data/lifeChoices.js',
  './src/data/events.js',
  './src/ui/dialog.js',
  './src/ui/toast.js',
  './src/ui/helpers.js',
  './src/ui/home.js',
  './src/ui/profile.js',
  './src/ui/football.js',
  './src/ui/training.js',
  './src/ui/relationships.js',
  './src/ui/life.js',
  './src/ui/activities.js',
  './src/ui/news.js',
  './src/ui/statistics.js',
  './src/ui/settings.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
