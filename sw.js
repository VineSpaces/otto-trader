/* Otto Trader service worker.
   Network-first for anything that changes, cache-first only for static assets.
   A cache-first HTML strategy would pin users to an old build forever, which is
   exactly the failure we already hit once by hand. */
const VERSION = 'otto-v5.9.1';
const SHELL = [
  './', './index.html', './manifest.webmanifest',   // config.js is deliberately NOT precached
  './icon-192.png', './icon-512.png',
  './icon-maskable-512.png', './apple-touch-icon.png',
  // v4.0: the desk's stills (chosen by the verdict rule) and the logo mark
  './img/hero-neutral.webp', './img/hero-defensive.webp', './img/hero-riskon.webp', './img/hero-night.webp',
  './img/spot-bonds.webp', './img/spot-nasdaq.webp', './img/spot-dow.webp', './img/spot-closed.webp', './img/logo-mark.webp'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())   // a missing optional asset must not block install
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Never touch the market data or Claude APIs — they must always hit the network,
  // and a cached quote is worse than no quote.
  if (url.origin !== self.location.origin) return;

  // config.js decides WHICH BACKEND the whole app talks to. A stale copy points
  // it at the wrong Supabase project — which is exactly the failure we hit, and
  // it is invisible because everything still "works", just against the wrong
  // database. Never cached, never stored, no fallback copy. If it cannot be
  // fetched the app should fail loudly rather than quietly use an old address.
  if (url.pathname.endsWith('config.js')) {
    e.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }

  const isDoc  = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  // The corpus files must never go stale in an installed PWA: publishing a new
  // call is the whole update mechanism, and a cache-first copy would freeze the
  // brain at whatever Josh installed on day one.
  const isData = url.pathname.endsWith('week-latest.json')
              || url.pathname.endsWith('config.js');

  if (isDoc || isData) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    }))
  );
});

// v3.6: phone notifications. The server sends {title, body, url, tag, kind}.
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'Otto', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Otto', {
    body: d.body || '', tag: d.tag || undefined, icon: './icon-192.png', badge: './icon-192.png',
    data: { url: d.url || './#desk' },
    // v3.9: Otto Signals + watcher pings stay on screen until tapped, and buzz.
    requireInteraction: d.kind === 'no_stop' || d.kind === 'signal' || d.kind === 'watcher',
    renotify: !!d.tag, silent: false,
    vibrate: d.kind === 'signal' || d.kind === 'watcher' || d.kind === 'no_stop' ? [300, 120, 300, 120, 600] : [200, 100, 200],
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './#desk', self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if (c.url.startsWith(self.registration.scope) && 'focus' in c) { try { c.postMessage({ otto_go: url }); } catch (e) {} if (c.url !== url) c.navigate(url).catch(() => {}); return c.focus(); } }
    return clients.openWindow(url);
  }));
});

self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });
