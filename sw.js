const CACHE_NAME = 'bairichuang-v3';

const PRECACHE = [
  './',
  './index.html',
  './app.js',
  './css/style.css',
  './manifest.webmanifest',
  './version.json',
  './icons/icon-192.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './js/idb-keyval.mjs',
  './js/date-utils.mjs',
  './js/utils.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(
        PRECACHE.map(url => cache.add(url).catch(() => {}))
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

function offlineFallback() {
  return new Response(JSON.stringify({ error: 'offline', cached: false }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  const pathname = url.pathname;
  const isQuestionFile = pathname.startsWith('/questions/') && pathname.endsWith('.json');
  const isIndex = pathname.endsWith('questions/index.json');
  const isVersionFile = pathname.endsWith('version.json');

  if (isIndex || isVersionFile) {
    e.respondWith(
      fetch(req)
        .then(resp => {
          if (resp && resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, clone)).catch(() => {});
          }
          return resp;
        })
        .catch(() =>
          caches.match(req, { ignoreSearch: true })
            .then(c => c || offlineFallback())
        )
    );
    return;
  }

  if (isQuestionFile) {
    e.respondWith(
      caches.match(req, { ignoreSearch: true }).then(cached => {
        if (cached) return cached;
        return fetch(req).then(resp => {
          if (resp && resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, clone)).catch(() => {});
          }
          return resp;
        }).catch(offlineFallback);
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(cached => {
      if (cached) return cached;
      return fetch(req).then(resp => {
        if (resp && resp.ok && resp.type === 'basic' && url.origin === self.location.origin) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone)).catch(() => {});
        }
        return resp;
      }).catch(() =>
        req.mode === 'navigate'
          ? (caches.match('./index.html').then(c => c || Response.error()))
          : Response.error()
      );
    })
  );
});
