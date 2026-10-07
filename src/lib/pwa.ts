import { createSignal } from 'solid-js';

/** Chrome's install prompt event (not in the TypeScript DOM types). */
export interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
	interface Window {
		/** Set by the inline script in index.html when the event fires before the app has loaded */
		__installPrompt?: BeforeInstallPromptEvent;
	}
}

const [installEvent, setInstallEvent] = createSignal<BeforeInstallPromptEvent>();
const [installed, setInstalled] = createSignal(false);

/** Registers the service worker (installable app, offline page, push notifications). */
export function registerServiceWorker() {
	captureInstallPrompt();
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

// Keep the browser's install prompt so our own "Instalar" button can open it later (Chromium browsers)
function captureInstallPrompt() {
	if (window.__installPrompt) setInstallEvent(window.__installPrompt);
	window.addEventListener('beforeinstallprompt', (event) => {
		event.preventDefault();
		setInstallEvent(event as BeforeInstallPromptEvent);
	});
	window.addEventListener('appinstalled', () => {
		setInstallEvent(undefined);
		setInstalled(true);
	});
}

/** Opens the native install dialog. Returns whether the user accepted. */
export async function promptInstall() {
	const event = installEvent();
	if (!event) return false;
	await event.prompt();
	const { outcome } = await event.userChoice;
	// A prompt event can only be used once
	setInstallEvent(undefined);
	window.__installPrompt = undefined;
	if (outcome === 'accepted') setInstalled(true);
	return outcome === 'accepted';
}

export function isStandalone() {
	return (
		window.matchMedia('(display-mode: standalone)').matches ||
		(navigator as Navigator & { standalone?: boolean }).standalone === true
	);
}

export function isIOS(ua = navigator.userAgent, platform = navigator.platform, touchPoints = navigator.maxTouchPoints) {
	// iPadOS presents itself as a Mac; touch support gives it away
	return /iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && touchPoints > 1);
}

export const isAndroid = (ua = navigator.userAgent) => /Android/i.test(ua);
export const isFirefox = (ua = navigator.userAgent) => /Firefox|FxiOS/i.test(ua);

/** Phones and tablets: the devices the install card is for. */
export function isMobile() {
	return isIOS() || isAndroid() || window.matchMedia('(pointer: coarse) and (max-width: 1024px)').matches;
}

/**
 * - `installed`: already running as the installed app
 * - `prompt`: the browser can show its own install dialog (Chrome, Edge, Samsung Internet…)
 * - `ios`: iPhone/iPad, installed by hand from the Share menu
 * - `manual`: Android without a prompt (Firefox, or the browser isn't ready yet): from the ⋮ menu
 * - `unsupported`: nothing to offer (e.g. desktop Safari/Firefox)
 */
export type InstallMode = 'installed' | 'prompt' | 'ios' | 'manual' | 'unsupported';

export function resolveInstallMode(env: { standalone: boolean; ios: boolean; android: boolean; hasPrompt: boolean }) {
	if (env.standalone) return 'installed';
	if (env.hasPrompt) return 'prompt';
	if (env.ios) return 'ios';
	if (env.android) return 'manual';
	return 'unsupported';
}

/** Reactive: changes when the browser offers (or consumes) its install prompt. */
export const installMode = (): InstallMode =>
	resolveInstallMode({
		standalone: installed() || isStandalone(),
		ios: isIOS(),
		android: isAndroid(),
		hasPrompt: !!installEvent()
	});

// ---------- Dismissal of the install card ----------

const DISMISSED_KEY = 'pwa.install.dismissedAt';
export const DISMISS_DAYS = 30;

/** Whether a dismissal at `dismissedAt` (ms) still hides the card at `now`. */
export function isDismissalActive(dismissedAt: number | null, now = Date.now()) {
	return dismissedAt !== null && now - dismissedAt < DISMISS_DAYS * 86_400_000;
}

export function readInstallDismissal(): number | null {
	try {
		const value = Number(localStorage.getItem(DISMISSED_KEY));
		return Number.isFinite(value) && value > 0 ? value : null;
	} catch {
		return null;
	}
}

export function dismissInstall(now = Date.now()) {
	try {
		localStorage.setItem(DISMISSED_KEY, String(now));
	} catch {
		// Private mode: hidden for this visit only
	}
}
