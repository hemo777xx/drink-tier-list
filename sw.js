const CACHE_NAME = 'drink-tier-list-v1';
const ASSETS = ['/', '/index.html', '/styles.css', '/script.js'];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then(res => res || fetch(e.request).then(response => {
            return caches.open(CACHE_NAME).then(cache => {
                if(e.request.method === 'GET') cache.put(e.request, response.clone());
                return response;
            });
        }))
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.map(key => key !== CACHE_NAME ? caches.delete(key) : null)
        ))
    );
});