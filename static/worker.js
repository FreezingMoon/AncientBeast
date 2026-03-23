self.addEventListener('install', function (e) {
	e.waitUntil(
		caches.open('ancientbeast').then(function (cache) {
			return cache.addAll(['/', '/index.html', '/index.html?homescreen=1', '/?homescreen=1']);
		}),
	);
});

self.addEventListener('fetch', function (event) {
	console.log(event.request.url);
	event.respondWith(
		caches.match(event.request).then(function (response) {
			return response || fetch(event.request);
		}),
	);
});

// TODO: incrementally cache all responses for previously uncached requests, so in the future they are all returned from the cache
