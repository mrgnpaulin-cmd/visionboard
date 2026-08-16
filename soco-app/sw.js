/* Service worker SO/CO — cache applicatif hors ligne.
   Stratégie : cache-first sur les ressources statiques, avec mise à jour en arrière-plan.
   Changer CACHE_VERSION à chaque déploiement force le rafraîchissement. */

const CACHE_VERSION = 'soco-v1';
const ASSETS = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './manifest.webmanifest',
  './assets/logo.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './fonts/anton-latin-400-normal.woff2',
  './fonts/inter-latin-400-normal.woff2',
  './fonts/inter-latin-500-normal.woff2',
  './fonts/inter-latin-600-normal.woff2',
  './fonts/inter-latin-700-normal.woff2',
  './fonts/inter-latin-800-normal.woff2',
  './fonts/inter-latin-900-normal.woff2'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()) // un asset manquant ne doit pas bloquer l'installation
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
