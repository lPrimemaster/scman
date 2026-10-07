/** Registers the service worker (installable app, offline page, push notifications). */
export function registerServiceWorker() {
	if (!('serviceWorker' in navigator)) return;
	const register = () =>
		navigator.serviceWorker.register('/sw.js').catch((err) => console.error('Service worker failed', err));
	// The entry module may run after `load` (it awaits dev tooling), so don't rely on the event alone
	if (document.readyState === 'complete') register();
	else window.addEventListener('load', register, { once: true });
	// A notification click on a window the worker can't navigate asks the page to do it
	navigator.serviceWorker.addEventListener('message', (event) => {
		if (event.data?.type === 'navigate' && typeof event.data.url === 'string') {
			window.location.assign(event.data.url);
		}
	});
}

export function isStandalone() {
	return (
		window.matchMedia('(display-mode: standalone)').matches ||
		(navigator as Navigator & { standalone?: boolean }).standalone === true
	);
}

export function isIOS() {
	return (
		/iPad|iPhone|iPod/.test(navigator.userAgent) ||
		(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
	);
}
