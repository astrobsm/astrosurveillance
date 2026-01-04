// ASTROSURVEILLANCE Service Worker
// Version 1.0.0

const CACHE_NAME = 'astrosurveillance-v1';
const DYNAMIC_CACHE = 'astrosurveillance-dynamic-v1';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon.svg',
  '/offline.html',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/css/materialdesignicons.min.css'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Service Worker installed');
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error('[SW] Cache failed:', err);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== DYNAMIC_CACHE)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service Worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip WebSocket connections
  if (url.protocol === 'ws:' || url.protocol === 'wss:') {
    return;
  }
  
  // Skip API calls - always fetch from network
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .catch(() => {
          return new Response(JSON.stringify({
            code: 'OFFLINE',
            message: 'You are offline'
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }
  
  // For static assets - cache first, then network
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached version and update in background
          event.waitUntil(
            fetch(request)
              .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                  caches.open(DYNAMIC_CACHE)
                    .then((cache) => cache.put(request, networkResponse));
                }
              })
              .catch(() => {})
          );
          return cachedResponse;
        }
        
        // Not in cache, fetch from network
        return fetch(request)
          .then((networkResponse) => {
            // Cache successful responses
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(DYNAMIC_CACHE)
                .then((cache) => cache.put(request, responseToCache));
            }
            return networkResponse;
          })
          .catch(() => {
            // Offline fallback for HTML pages
            if (request.headers.get('accept').includes('text/html')) {
              return caches.match('/offline.html');
            }
          });
      })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-events') {
    event.waitUntil(syncEvents());
  }
});

async function syncEvents() {
  // Sync any pending events when back online
  console.log('[SW] Syncing events...');
}

// Push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);
  
  let data = { title: 'ASTROSURVEILLANCE', body: 'New notification' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  const options = {
    body: data.body || data.message,
    icon: '/icons/icon.svg',
    badge: '/favicon.svg',
    vibrate: [200, 100, 200],
    tag: data.tag || 'default',
    requireInteraction: data.type === 'motion' || data.type === 'alarm',
    actions: [
      { action: 'view', title: 'View Dashboard' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    data: data
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'ASTROSURVEILLANCE', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if available
        for (const client of clientList) {
          if (client.url.includes('/') && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});

// Message handler for app communication
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});
