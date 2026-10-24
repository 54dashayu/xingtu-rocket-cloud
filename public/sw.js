const CACHE = 'launch-calendar-shell-v14';
const scope = new URL(self.registration.scope).pathname.replace(/\/$/, '');
const SHELL = [`${scope}/`, `${scope}/styles.css`, `${scope}/refinements.css`, `${scope}/app.js`, `${scope}/manifest.webmanifest`, `${scope}/icons/icon.svg`];
self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL))));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))));
self.addEventListener('fetch', (event) => { if (event.request.method !== 'GET' || /\/api\//.test(new URL(event.request.url).pathname)) return; event.respondWith(fetch(event.request).then((response) => { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(event.request, copy)); return response; }).catch(() => caches.match(event.request))); });
