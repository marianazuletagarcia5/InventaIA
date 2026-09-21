// service-worker.js — InventIA
// Cachea el "cascarón" de la app (HTML/JS/íconos) para que abra al instante
// y muestre algo incluso sin conexión. Las peticiones a /api/... siempre
// van a la red, porque la información del inventario debe estar actualizada.

const CACHE = "inventia-v1";
const ARCHIVOS_APP = [
  "/",
  "/mobile.js",
  "/manifest.json",
  "/escudo.jpeg",
  "/iconos/icono-192.png",
  "/iconos/icono-512.png",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ARCHIVOS_APP)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(nombres.filter((n) => n !== CACHE).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (evento) => {
  const url = new URL(evento.request.url);

  // Datos del inventario: siempre a la red (nunca desde caché).
  if (url.pathname.startsWith("/api/")) {
    evento.respondWith(fetch(evento.request).catch(() =>
      new Response(JSON.stringify({ errores: ["Sin conexión con el servidor."] }), {
        status: 503, headers: { "Content-Type": "application/json" },
      })
    ));
    return;
  }

  // Resto de archivos: caché primero, con actualización en segundo plano.
  evento.respondWith(
    caches.match(evento.request).then((respuestaCache) => {
      const redFetch = fetch(evento.request).then((respuestaRed) => {
        caches.open(CACHE).then((cache) => cache.put(evento.request, respuestaRed.clone()));
        return respuestaRed;
      }).catch(() => respuestaCache);
      return respuestaCache || redFetch;
    })
  );
});
