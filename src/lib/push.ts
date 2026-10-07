import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { api } from './api';

const FCM_TOKEN_KEY = 'fcm.local.token';

const isNative = () => Capacitor.isNativePlatform();

/** Registers this device for push notifications (native apps only). */
export async function registerPush() {
	if (!isNative()) return;
	try {
		await FirebaseMessaging.requestPermissions();
		const { token } = await FirebaseMessaging.getToken();
		if (!token || localStorage.getItem(FCM_TOKEN_KEY) === token) return;

		await api.push.register(token, Capacitor.getPlatform());
		localStorage.setItem(FCM_TOKEN_KEY, token);
	} catch (err) {
		console.error('Push registration failed', err);
	}
}

export async function unregisterPush() {
	if (!isNative()) return;
	const token = localStorage.getItem(FCM_TOKEN_KEY);
	if (!token) return;
	try {
		await api.push.unregister(token);
	} catch {
		// The session may already be invalid; the server cleans stale tokens up.
	} finally {
		await FirebaseMessaging.deleteToken().catch(() => {});
		localStorage.removeItem(FCM_TOKEN_KEY);
	}
}
