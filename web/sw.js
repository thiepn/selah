const CACHE = 'selah-shell-v1';
const SHELL = ['./','./index.html','./styles.css','./app.js','./manifest.webmanifest'];
self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys)=>Promise.all(keys.filter((k)=>k!==CACHE).map((k)=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.includes('/data/bsb/')) {
    event.respondWith(caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok) cache.put(event.request, response.clone());
      return response;
    }));
    return;
  }
  event.respondWith(caches.match(event.request).then((cached)=>cached || fetch(event.request).then((response)=>{
    if (response.ok) caches.open(CACHE).then((cache)=>cache.put(event.request,response.clone()));
    return response;
  })));
});
