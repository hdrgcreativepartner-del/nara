// Network-first app shell; model caches belong to WebLLM and must be preserved.
const CACHE='nara-shell-6.5.3';
const ROOT=new URL('./',self.location.href).href;
const FILES=['./','./index.html','./styles.css?v=6.5.3','./app.js?v=6.5.3','./local-ai.js?v=6.5.3','./local-ai-worker.mjs?v=6.5.3','./median-bridge.js?v=6.5.3','./manifest.webmanifest?v=6.5.3','./icon.svg','./assets/nara-header.webp','./assets/nara-splash.webp'];
const RUNTIME='https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/lib/index.js';
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES.map(p=>new URL(p,ROOT).href))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('nara-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url),isApp=url.origin===self.location.origin&&url.href.startsWith(ROOT);
  const isCpuRuntime=url.origin==='https://cdn.jsdelivr.net'&&url.pathname.startsWith('/npm/@huggingface/transformers@3.8.1/dist/');
  if(!isApp&&url.href!==RUNTIME&&!isCpuRuntime)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try{const response=await fetch(event.request);if(response.ok)await cache.put(event.request,response.clone());return response}
    catch{const cached=await cache.match(event.request)||(event.request.mode==='navigate'?await cache.match(new URL('./index.html',ROOT).href):null);return cached||Response.error()}
  })());
});
