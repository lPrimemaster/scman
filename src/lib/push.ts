import { createSignal } from 'solid-js';
import { api } from './api';
import { isIOS, isStandalone } from './pwa';

/**
 * - `unsupported`: this browser has no Web Push
 * - `needs-install`: iOS only delivers push to the app added to the home screen
 * - `unavailable`: the server has no push keys configured
 * - `denied`: blocked in the browser's site settings
 * - `off` / `on`: whether this device is subscribed
 */
export type PushState = 'unsupported' | 'needs-install' | 'unavailable' | 'denied' | 'off' | 'on';

const [state, setState] = createSignal<PushState>('off');
export const pushState = state;

const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

async function registration() {
	return navigator.serviceWorker.ready;
}

function base64UrlToBytes(value: string) {
	const padded = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
	return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function currentSubscription() {
	return (await registration()).pushManager.getSubscription();
}

/** Works out the state for this device without prompting the user. */
export async function refreshPushState(): Promise<PushState> {
	let next: PushState;
	if (!supported()) next = isIOS() && !isStandalone() ? 'needs-install' : 'unsupported';
	else if (!(await api.push.config().catch(() => ({ enabled: false }))).enabled) next = 'unavailable';
	else if (Notification.permission === 'denied') next = 'denied';
	else next = Notification.permission === 'granted' && (await currentSubscription()) ? 'on' : 'off';
	setState(next);
	return next;
}

/** Asks for permission (must run from a click) and subscribes this device. */
export async function enablePush() {
	const config = await api.push.config();
	if (!config.enabled || !config.publicKey) throw new Error('Push indisponível.');
	if ((await Notification.requestPermission()) !== 'granted') {
		await refreshPushState();
		return false;
	}

	const reg = await registration();
	let sub = await reg.pushManager.getSubscription();
	const key = base64UrlToBytes(config.publicKey);
	// The server keys changed since this device subscribed: start over
	const subKey = sub?.options.applicationServerKey;
	if (sub && subKey && !bytesEqual(new Uint8Array(subKey), key)) {
		await sub.unsubscribe();
		sub = null;
	}
	sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
	await api.push.subscribe(sub.toJSON());
	setState('on');
	return true;
}

export async function disablePush() {
	const sub = await currentSubscription();
	if (sub) {
		await api.push.unsubscribe(sub.endpoint).catch(() => {});
		await sub.unsubscribe();
	}
	await refreshPushState();
}

/** After login: re-attach an existing subscription to the signed-in user and refresh it on the server. */
export async function syncPush() {
	if (!supported() || Notification.permission !== 'granted') return refreshPushState();
	const sub = await currentSubscription().catch(() => null);
	if (sub) await api.push.subscribe(sub.toJSON()).catch(() => {});
	return refreshPushState();
}

/** On logout: stop this device receiving the previous user's notifications. */
export async function unregisterPush() {
	if (!supported()) return;
	const sub = await currentSubscription().catch(() => null);
	if (!sub) return;
	await api.push.unsubscribe(sub.endpoint).catch(() => {});
	await sub.unsubscribe().catch(() => {});
	setState('off');
}

function bytesEqual(a: Uint8Array, b: Uint8Array) {
	return a.length === b.length && a.every((v, i) => v === b[i]);
}
