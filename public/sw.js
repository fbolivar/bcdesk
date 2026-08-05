const CACHE_NAME = 'hexdesk-v3'
const OFFLINE_URL = '/offline'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll([OFFLINE_URL]).catch(() => {})
    )
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Borra TODAS las cachés viejas (auto-reparación de clientes con versión vieja).
    const keys = await caches.keys()
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    await self.clients.claim()
    // Recarga una sola vez las pestañas abiertas para descartar bundles viejos.
    const clients = await self.clients.matchAll({ type: 'window' })
    for (const c of clients) { try { await c.navigate(c.url) } catch (e) { /* noop */ } }
  })())
})

self.addEventListener('fetch', (event) => {
  // NUNCA servir HTML/JS desde caché: solo se usa la caché como respaldo offline
  // en navegaciones cuando falla la red. Nada de assets cacheados = nada de código viejo.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    )
  }
})

self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json()
  const options = {
    body: data.body || 'Tienes una nueva notificación',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' },
    vibrate: [200, 100, 200],
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'HexDesk', options)
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(clients.openWindow(url))
})
