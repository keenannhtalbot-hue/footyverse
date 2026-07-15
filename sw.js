// FootyVerse service worker. Caches only same-origin, successful GET
// responses. Uses a versioned cache name so deploying a new CACHE_VERSION
// cleanly replaces old caches instead of accumulating stale entries.

const CACHE_VERSION = 'footyverse-v0.5.0-v6';

// APP_SHELL covers every runtime JavaScript module under src/{engines,ui,data}
// plus the boot-time static assets referenced from index.html and the manifest.
// The tests/swCache.test.mjs regression guard walks src/ on disk and asserts
// this list stays in lock-step — keep entries alphabetised within each group
// and do not hand-curate subsets, or the guard will turn red.
const APP_SHELL = [
  './',
  './index.html',
  './styles/main.css',
  './manifest.webmanifest',
  './src/main.js',
  './src/data/activities.js',
  './src/data/countries.js',
  './src/data/eventChains.js',
  './src/data/events.js',
  './src/data/lifeChoices.js',
  './src/data/names.js',
  './src/data/positions.js',
  './src/engines/careerOrchestrator.js',
  './src/engines/careerStateAdapter.js',
  './src/engines/chainCompletionAnnouncer.js',
  './src/engines/contractEngine.js',
  './src/engines/eventEngine.js',
  './src/engines/footballEngine.js',
  './src/engines/guidedSeason.js',
  './src/engines/guidedSeasonIntegration.js',
  './src/engines/loanEngine.js',
  './src/engines/matchEngine.js',
  './src/engines/playerEngine.js',
  './src/engines/quarterRecap.js',
  './src/engines/relationshipEngine.js',
  './src/engines/rng.js',
  './src/engines/saveEngine.js',
  './src/engines/scheduleEngine.js',
  './src/engines/scopedRng.js',
  './src/engines/selectionEngine.js',
  './src/engines/standingsEngine.js',
  './src/engines/stateMigrations.js',
  './src/engines/stateSerializer.js',
  './src/engines/stateValidator.js',
  './src/engines/trainingEngine.js',
  './src/engines/transferEngine.js',
  './src/engines/worldEngine.js',
  './src/ui/activities.js',
  './src/ui/contracts.js',
  './src/ui/dialog.js',
  './src/ui/football.js',
  './src/ui/guidedHint.js',
  './src/ui/helpers.js',
  './src/ui/home.js',
  './src/ui/life.js',
  './src/ui/news.js',
  './src/ui/profile.js',
  './src/ui/relationships.js',
  './src/ui/seniorEpilogue.js',
  './src/ui/settings.js',
  './src/ui/statistics.js',
  './src/ui/toast.js',
  './src/ui/training.js',
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
