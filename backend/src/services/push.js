import webpush from 'web-push';

// The push service answers 404/410 when a subscription is gone (unsubscribed, browser data cleared)
const GONE = [404, 410];

/**
 * Returns a function that delivers one Web Push message, or null when VAPID keys are missing.
 * @param {{ publicKey?: string, privateKey?: string, subject: string }} vapid
 */
export function createWebPushSender(vapid) {
	if (!vapid.publicKey || !vapid.privateKey) {
		console.warn('[push] VAPID keys are not set. Push notifications are disabled (run `yarn vapid-keys`).');
		return null;
	}
	webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
	return (subscription, payload) => webpush.sendNotification(subscription, payload, { TTL: 60 * 60 * 24 });
}

/**
 * Sends notifications to every browser a user enabled.
 * @param {{ repo, sender: ((subscription, payload: string) => Promise<unknown>) | null, now?: () => number, log? }} deps
 */
export function createPushService({ repo, sender, now = Date.now, log = console }) {
	async function sendToUser(userId, { title, body, url, tag }) {
		const subscriptions = repo.webpush.forUser(userId);
		if (!sender || subscriptions.length === 0) return { ok: true, sent: 0, failed: 0 };

		const payload = JSON.stringify({ title, body, url: url ?? '/', tag });
		let sent = 0;
		let failed = 0;

		await Promise.all(
			subscriptions.map(async (s) => {
				try {
					await sender({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
					repo.webpush.touch(s.endpoint, now());
					sent++;
				} catch (err) {
					failed++;
					if (GONE.includes(err?.statusCode)) repo.webpush.remove(s.endpoint);
					else log.error(`[push] Failed to notify user ${userId}:`, err?.statusCode ?? err);
				}
			})
		);
		return { ok: failed === 0, sent, failed };
	}

	// Fire-and-forget helpers: failures are logged, never thrown to the caller.
	function notifyUser(userId, message) {
		sendToUser(userId, message).catch((err) => log.error(`[push] Failed to notify user ${userId}:`, err));
	}

	function notifyRole(role, message) {
		for (const id of repo.users.idsByRole(role)) {
			notifyUser(id, message);
		}
	}

	return { enabled: !!sender, sendToUser, notifyUser, notifyRole };
}
