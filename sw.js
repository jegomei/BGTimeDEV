// BGTime Service Worker
// Cambia este número de versión para forzar actualización del caché
const CACHE_VERSION = 'bgtime-v1';

const STATIC_ASSETS = [
  '/BGTime/',
  '/BGTime/index.html',
  '/BGTime/manifest.json',
  '/BGTime/favicon.svg',
  '/BGTime/icons/icon-192.png',
  '/BGTime/icons/icon-512.png',
];

// ── Instalación: cachea los archivos estáticos ──────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Activa inmediatamente sin esperar a que cierren las pestañas abiertas
  self.skipWaiting();
});

// ── Activación: elimina cachés antiguas ─────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_VERSION)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: estrategia "Network first, cache fallback" ───────────────────────
// Intenta siempre la red primero (para que Firebase y fuentes externas
// funcionen con datos frescos). Si no hay red, sirve desde caché.
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo interceptamos peticiones del mismo origen + assets locales
  // Dejamos pasar Firebase, Google Fonts y demás sin tocarlas en caché
  const isLocal = url.origin === self.location.origin;
  const isFont = url.hostname.includes('fonts.g');
  const isFirebase = url.hostname.includes('firebase') ||
                     url.hostname.includes('firestore') ||
                     url.hostname.includes('gstatic');

  if (!isLocal || isFont || isFirebase) {
    // Para recursos externos: red directa, sin caché
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response => {
        // Guardar copia en caché si la respuesta es válida
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        // Sin red → intentar desde caché
        return caches.match(request).then(cached => {
          if (cached) return cached;
          // Si no hay caché y es una navegación, devolver index.html
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
