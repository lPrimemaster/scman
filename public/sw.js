// Service worker: makes the app installable, gives a basic offline page and shows Web Push notifications.
// Plain JS served at /sw.js (scope /). Bump VERSION when the cached shell must be replaced.
const VERSION = 'v1';
const SHELL_CACHE = `shell-${VERSION}`;

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(SHELL_CACHE)
			.then((cache) => cache.add(new Request('/', { cache: 'reload' })))
			.catch(() => {})
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k))))
			.then(() => self.clients.claim())
	);
});

// Network first for page loads, so a deploy is picked up immediately; the cached shell only covers offline.
self.addEventListener('fetch', (event) => {
	if (event.request.mode !== 'navigate') return;
	event.respondWith(
		fetch(event.request)
			.then((response) => {
				if (response.ok) {
					const copy = response.clone();
					caches.open(SHELL_CACHE).then((cache) => cache.put('/', copy));
				}
				return response;
			})
			.catch(() => caches.match('/'))
	);
});

self.addEventListener('push', (event) => {
	let data = {};
	try {
		data = event.data ? event.data.json() : {};
	} catch {
		data = { title: 'SC 1925', body: event.data ? event.data.text() : '' };
	}
	event.waitUntil(
		self.registration.showNotification(data.title || 'SC 1925', {
			body: data.body || '',
			icon: '/icons/icon-192.png',
			badge: '/icons/badge-96.png',
			tag: data.tag,
			data: { url: data.url || '/' }
		})
	);
});

// Focus an open app window and take it to the notification's page, or open a new one
self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
	event.waitUntil(
		self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
			const client = windows.find((w) => new URL(w.url).origin === self.location.origin);
			if (client) {
				await client.focus();
				return client.navigate(url).catch(() => client.postMessage({ type: 'navigate', url }));
			}
			return self.clients.openWindow(url);
		})
	);
});
