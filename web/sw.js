const CACHE = 'selah-shell-v7';
const SHELL = ['./','./index.html','./styles.css','./app.js','./book-overview.js','./guide-literary-mode.js','./interpretation-claims.js','./search-workspace.js','./translation-compare.js','./search-worker.js','./manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache)=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys)=>Promise.all(keys.filter((key)=>key!==CACHE).map((key)=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin)return;

  event.respondWith(
    fetch(event.request)
      .then((response)=>{
        if(response.ok){
          const copy=response.clone();
          caches.open(CACHE).then((cache)=>cache.put(event.request,copy));
        }
        return response;
      })
      .catch(async()=>{
        const cached=await caches.match(event.request);
        if(cached)return cached;
        if(event.request.mode==='navigate')return caches.match('./index.html');
        throw new Error('Offline asset unavailable');
      })
  );
});
