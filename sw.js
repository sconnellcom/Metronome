const CACHE_NAME = 'ad-free-apps-v3';
const urlsToCache = [
    '/',
    '/index.html',
    '/metronome/',
    '/metronome/index.html',
    '/metronome/style.css?v=2',
    '/metronome/metronome.js?v=2',
    '/timer/',
    '/timer/index.html',
    '/timer/timer.js?v=2',
    '/draw/',
    '/draw/index.html',
    '/level/',
    '/level/index.html',
    '/scanner/',
    '/scanner/index.html',
    '/pad/',
    '/pad/index.html',
    '/pad/style.css?v=2',
    '/pad/pad.js?v=2',
    '/tuner/',
    '/tuner/index.html',
    '/tuner/style.css?v=2',
    '/tuner/tuner.js?v=2',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
            .catch((error) => {
                console.log('Cache addAll failed:', error);
            })
    );
    // Force the waiting service worker to become the active service worker
    self.skipWaiting();
});

// Fetch event - stale-while-revalidate strategy
// Serve from cache immediately, then update cache in background
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(event.request).then((cachedResponse) => {
                // Always fetch from network to update cache in background
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    // Only cache successful GET requests for same-origin resources
                    const shouldCache = networkResponse && 
                        networkResponse.status === 200 && 
                        networkResponse.type === 'basic' && 
                        event.request.method === 'GET';
                    
                    if (shouldCache) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(() => {
                    // Network failed, return null (we'll use cached response or fallback)
                    return null;
                });

                // If we have a cached response, return it immediately
                // The fetchPromise will update the cache in the background
                if (cachedResponse) {
                    // Trigger background fetch but don't wait for it
                    fetchPromise.catch(() => {}); // Suppress unhandled promise rejection
                    return cachedResponse;
                }
                
                // No cached response, wait for network
                return fetchPromise.then((networkResponse) => {
                    if (networkResponse) {
                        return networkResponse;
                    }
                    // Both cache and network failed for navigation, return offline page
                    if (event.request.mode === 'navigate') {
                        return cache.match('/index.html');
                    }
                    return new Response('Content unavailable offline. Please check your connection and try again.', { 
                        status: 503, 
                        statusText: 'Service Unavailable' 
                    });
                });
            });
        })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
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
    // Take control of all pages immediately
    self.clients.claim();
});

// Listen for messages from clients
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
