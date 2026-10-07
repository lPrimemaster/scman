import fs from 'node:fs';

const MULTICAST_LIMIT = 500;
const DEAD_TOKEN_CODES = ['registration-token-not-registered', 'invalid-argument', 'unregistered'];

// Returns a firebase messaging client, or null when no service account is available.
export async function createFirebaseMessaging(serviceAccountPath) {
	if (!fs.existsSync(serviceAccountPath)) {
		console.warn(`[FCM] ${serviceAccountPath} not found. Push notifications are disabled.`);
		return null;
	}
	const { default: admin } = await import('firebase-admin');
	admin.initializeApp({
		credential: admin.credential.cert(JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8')))
	});
	return admin.messaging();
}

// messaging: object with `sendEachForMulticast` (firebase-admin messaging) or null to disable sending.
export function createPushService({ repo, messaging, log = console }) {
	async function sendToUser(userId, { title, body, data }) {
		const tokens = repo.fcm.activeForUser(userId);
		if (!messaging || tokens.length === 0) {
			return { ok: true, sent: 0, failed: 0 };
		}

		let sent = 0;
		let failed = 0;

		for (let i = 0; i < tokens.length; i += MULTICAST_LIMIT) {
			const chunk = tokens.slice(i, i + MULTICAST_LIMIT);
			const resp = await messaging.sendEachForMulticast({
				tokens: chunk,
				notification: { title, body },
				data: data ?? {}
			});

			sent += resp.successCount;
			failed += resp.failureCount;

			// Disable expired tokens
			resp.responses.forEach((r, idx) => {
				const code = r.error?.code || '';
				if (!r.success && DEAD_TOKEN_CODES.some((c) => code.includes(c))) {
					repo.fcm.disable(chunk[idx]);
				}
			});
		}

		return { ok: failed === 0, sent, failed };
	}

	// Fire-and-forget helpers: failures are logged, never thrown to the caller.
	function notifyUser(userId, message) {
		sendToUser(userId, message).catch((err) => log.error(`[FCM] Failed to notify user ${userId}:`, err));
	}

	function notifyRole(role, message) {
		for (const id of repo.users.idsByRole(role)) {
			notifyUser(id, message);
		}
	}

	return { sendToUser, notifyUser, notifyRole };
}
