/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope

const CACHE_NAME = 'cortex-shell-v1'

const SHELL_URLS = [
  '/',
  '/events',
  '/manifest.json',
]

// Install: pre-cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  )
  self.skipWaiting()
})

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// Fetch: network-first for API and auth, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Never cache API calls or auth routes
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname === '/login'
  ) {
    return
  }

  // Cache-first for static assets (JS, CSS, images, fonts)
  if (
    event.request.destination === 'script' ||
    event.request.destination === 'style' ||
    event.request.destination === 'image' ||
    event.request.destination === 'font'
  ) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) => cached || fetch(event.request).then((res) => {
          // Cache the fetched response for next time
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return res
        })
      )
    )
    return
  }

  // Network-first for navigation (HTML pages)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(
        () => caches.match(event.request).then((r) => r || caches.match('/')) as Promise<Response>
      )
    )
    return
  }
})

// Web Push: meeting-prep briefs and overdue-action alerts.
self.addEventListener('push', (event: PushEvent) => {
  let payload: { title?: string; body?: string; url?: string; tag?: string } = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { body: event.data?.text() }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Cortex', {
      body: payload.body || '',
      tag: payload.tag,
      data: { url: payload.url || '/dashboard' },
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
    })
  )
})

// Focus or open the app at the notification's target URL on tap.
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const target = (event.notification.data?.url as string) || '/dashboard'
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          ;(client as WindowClient).navigate(target)
          return (client as WindowClient).focus()
        }
      }
      return self.clients.openWindow(target)
    })
  )
})

// Background sync for offline captures
self.addEventListener('sync', (event: SyncEvent) => {
  if (event.tag === 'sync-captures') {
    event.waitUntil(syncPendingCaptures())
  }
})

async function syncPendingCaptures() {
  // Notify the client to flush its queue
  const clients = await self.clients.matchAll({ type: 'window' })
  for (const client of clients) {
    client.postMessage({ type: 'flush-queue' })
  }
}

// Type augmentation for SyncEvent (not yet in lib.webworker)
interface SyncEvent extends ExtendableEvent {
  tag: string
}

declare global {
  interface ServiceWorkerGlobalScopeEventMap {
    sync: SyncEvent
  }
}
