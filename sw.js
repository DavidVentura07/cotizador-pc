/* Service Worker — Cotizador PC
   Estrategia: cache-first del app shell para uso offline.
   IMPORTANTE: sube CACHE_VERSION cada vez que cambies algún archivo,
   para que los dispositivos descarguen la versión nueva. */
const CACHE_VERSION = "cotizador-pc-v1";
const ASSETS = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "manifest.json",
  "vendor/xlsx.full.min.js",
  "fonts/inter-latin-400-normal.woff2",
  "fonts/inter-latin-500-normal.woff2",
  "fonts/inter-latin-600-normal.woff2",
  "fonts/inter-latin-700-normal.woff2",
  "fonts/jetbrains-mono-latin-400-normal.woff2",
  "fonts/jetbrains-mono-latin-500-normal.woff2",
  "fonts/jetbrains-mono-latin-700-normal.woff2",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
  "icons/favicon-64.png"
];

self.addEventListener("install", e=>{
  e.waitUntil(
    caches.open(CACHE_VERSION).then(c=> c.addAll(ASSETS)).then(()=> self.skipWaiting())
  );
});

self.addEventListener("activate", e=>{
  e.waitUntil(
    caches.keys().then(keys=> Promise.all(
      keys.filter(k=> k!==CACHE_VERSION).map(k=> caches.delete(k))
    )).then(()=> self.clients.claim())
  );
});

self.addEventListener("fetch", e=>{
  const req = e.request;
  if(req.method!=="GET") return;
  const url = new URL(req.url);
  if(url.origin!==location.origin) return; // no interceptar terceros

  e.respondWith(
    caches.match(req).then(hit=>{
      if(hit) return hit;
      return fetch(req).then(res=>{
        // guardar copia en caché para futuras visitas
        const copy = res.clone();
        caches.open(CACHE_VERSION).then(c=> c.put(req, copy)).catch(()=>{});
        return res;
      }).catch(()=>{
        // fallback a index.html para navegación offline
        if(req.mode==="navigate") return caches.match("index.html");
      });
    })
  );
});
