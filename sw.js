/* Service Worker — guarda tudo no painel para rodar 100% offline */
const CACHE = 'space-black-v7';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './game.js',
  './manifest.json',
  './assets/tire-clean.png',
  './assets/tire-dirty.png',
  './assets/product.png',
  './assets/logo.png',
  './assets/bg.png',
  './assets/orbitron.woff2',
  './assets/sounds/brush.wav',
  './assets/sounds/win.wav',
  './assets/sounds/lose.wav',
  './assets/sounds/click.wav',
  './assets/sounds/tick.wav',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first: online sempre pega a versão atual e atualiza o cache;
// offline (painel no evento) cai pro cache.
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request)
      .then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return resp;
      })
      .catch(() => caches.match(e.request))
  );
});
