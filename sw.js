/* Dumpster Divers service worker: makes the game installable and playable offline.
   - The page itself (index.html) is NETWORK-FIRST, so whenever you are online you always get the newest build; the saved copy is only the fallback.
   - Everything else (art, sounds, icons) is served from the saved copy right away and refreshed in the background.
   - Audio requests that ask for a byte range (iPhones do this for the rocket loop) are left alone: a saved full file can break them. */
const CACHE = 'dd-static-v1';
const CORE = [
  './', './index.html', './manifest.webmanifest',
  './assets/title-portrait.jpg', './assets/icons/icon-192.png', './assets/icons/icon-512.png', './assets/icons/apple-touch-icon.png',
  ...[1, 2, 3, 4].flatMap(n => [`./sounds/bolt${n}.mp3`, `./sounds/splat${n}.mp3`, `./sounds/csplat${n}.mp3`]),
  './sounds/thrust.mp3',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || req.headers.has('range')) return;
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
  if (isPage) {                                      // newest build when online, saved copy when not
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); return res; })
      .catch(() => caches.match('./index.html').then(r => r || caches.match('./'))));
    return;
  }
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(res => { if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; }).catch(() => hit);
    return hit || net;
  }));
});
