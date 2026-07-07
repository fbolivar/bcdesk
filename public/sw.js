const CACHE_NAME = 'hexdesk-v2'
const OFFLINE_URL = '/offline'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll([OFFLINE_URL, '/']).catch(() => {})
    )
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
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
