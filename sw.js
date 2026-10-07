const CACHE="nara-web-v3-312";
const ASSETS=["./","./index.html","./styles.css?v=3.1.2","./app.js?v=3.1.2","./manifest.webmanifest?v=3.1.2","./icon.svg","./nara-logo.svg"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const req=event.request;
  if(req.mode==="navigate"){event.respondWith(fetch(req,{cache:"no-store"}).catch(()=>caches.match("./index.html")));return;}
  event.respondWith(fetch(req).then(res=>{const copy=res.clone();caches.open(CACHE).then(cache=>cache.put(req,copy));return res}).catch(()=>caches.match(req)));
});