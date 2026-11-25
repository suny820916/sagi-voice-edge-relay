const CACHE="sagi-free-v16-4";
const ASSETS=["./","./index.html","./reference-style.mjs","./free-engine-router.mjs","./free-provider-adapters.mjs","./manifest.webmanifest","./icon.svg"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS.map(path=>new Request(new URL(path,self.registration.scope),{cache:"reload"}))))));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("sagi-free-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("message",e=>{if(e.data==="UPDATE")self.skipWaiting()});
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET"||new URL(e.request.url).origin!==self.location.origin||!e.request.url.startsWith(self.registration.scope))return;
  // Keep one coherent application shell per active worker; never mix modules across releases.
  const asset=ASSETS.find(path=>new URL(path,self.registration.scope).href===e.request.url);
  if(asset||e.request.mode==="navigate"){
    e.respondWith(caches.open(CACHE).then(async cache=>{
      const cached=await cache.match(asset?new URL(asset,self.registration.scope):new URL("./index.html",self.registration.scope));
      return cached||fetch(e.request);
    }));
  }
});
