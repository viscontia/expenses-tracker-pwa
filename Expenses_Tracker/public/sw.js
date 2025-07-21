const CACHE_NAME = 'expense-tracker-v1';
const urlsToCache = [
  '/',
  '/dashboard',
  '/categories',
  '/expenses/new',
  '/settings',
  '/login',
  '/register'
  // Rimuovo i file di sviluppo dalla cache
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('Cache installation failed:', error);
      })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  // Skip caching for development files, API requests and POST requests
  if (event.request.url.includes('/trpc/') || 
      event.request.method !== 'GET' ||
      event.request.url.includes('/_vite/') ||
      event.request.url.includes('/@vite/') ||
      event.request.url.includes('/@fs/') ||
      event.request.url.includes('/src/') ||
      event.request.url.includes('.tsx') ||
      event.request.url.includes('.ts') ||
      event.request.url.includes('.jsx') ||
      (event.request.url.includes('.js') && event.request.url.includes('localhost'))) {
    return; // Non intercettare questi requests
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        const fetchRequest = event.request.clone();
        return fetch(fetchRequest).then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          if (event.request.method === 'GET' && 
              !event.request.url.includes('/src/') &&
              !event.request.url.includes('.tsx') &&
              !event.request.url.includes('.ts')) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
          }
          return response;
        }).catch(() => {
          // Return offline page custom
          if (event.request.destination === 'document') {
            return caches.match('/offlineExpenseTracker.html');
          }
        });
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Handle background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Handle any queued actions when back online
      console.log('Background sync triggered')
    );
  }
});

// Handle push notifications (if needed in the future)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: 1
      }
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});
