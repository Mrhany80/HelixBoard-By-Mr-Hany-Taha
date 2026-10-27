/* HelixBoard service worker: the app works offline on tablets, and updates arrive by themselves.
   The page is fetched from the network first (so a new version is picked up whenever there is internet) and from the cache when offline.
   A new version waits until the teacher or student taps "Update now". */
const CACHE = 'helixboard-__VERSION__';
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('helixboard-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('message', e => { if (e.data === 'skip-waiting') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;   // accounts, fonts and libraries go straight to the network
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('index.html');
  if (isPage) {
    e.respondWith(caches.open(CACHE).then(async c => {
      try { const res = await fetch(req, { cache: 'no-cache' }); if (res.ok) c.put('./index.html', res.clone()); return res; }
      catch (er) { return (await c.match('./index.html')) || (await c.match('./')) || Response.error(); }
    }));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { if (res.ok) caches.open(CACHE).then(c => c.put(req, res.clone())); return res; })));
});
