import cron from 'node-cron';
import { daysUntil } from '../lib/dates.js';
import { canSeeEventType } from '../lib/roles.js';

// The app re-registers its subscription on every visit and each delivery refreshes it
const PUSH_STALE_MS = 1000 * 60 * 60 * 24 * 90; // 90 days
export const PAYMENT_EXPIRE_MS = 5 * 60 * 1000;

export function cleanupStaleSubscriptions(repo, now = Date.now()) {
	const removed = repo.webpush.deleteStale(now - PUSH_STALE_MS);
	console.log(`[push] Cleanup: removed ${removed} stale subscriptions.`);
	return removed;
}

// Notify users that signed up for an event (available or maybe) one day before it starts.
export function notifyEvent1Day(repo, push, now = Date.now()) {
	for (const pair of repo.schedule.unnotifiedResponses()) {
		const daysToGo = daysUntil(pair.start, now);

		if (daysToGo === 1 && pair.status !== 0) {
			console.log(`[cron] Notifying user ${pair.uid} for event ${pair.name}.`);
			push.notifyUser(pair.uid, {
				title: 'Falta 1 dia para um evento em que estás inscrito!',
				body: `${pair.name}`
			});
		}

		if (daysToGo <= 1) {
			repo.schedule.markNotified(pair.eid);
		}
	}
}

// Days before the answer deadline on which users without an answer are reminded
export const DEADLINE_REMINDER_DAYS = [7, 2, 0];

// Remind users without an answer a week before, two days before and on the deadline day.
export function notifyEventResponseDeadline(repo, push, now = Date.now()) {
	for (const pair of repo.schedule.missingResponses()) {
		if (!canSeeEventType(pair.role, pair.type)) continue;

		const daysToGo = daysUntil(pair.sub_limit_date, now);
		if (!DEADLINE_REMINDER_DAYS.includes(daysToGo)) continue;

		console.log(`[cron] Notifying user ${pair.full_name} for event ${pair.name} response date limit.`);
		push.notifyUser(pair.uid, {
			title:
				daysToGo > 0
					? `Faltam ${daysToGo} dias para o limite de inscrição!`
					: 'É hoje a data limite para inscrição!',
			body: `${pair.name} — ainda não respondeste.`,
			url: `/?event=${pair.eid}`,
			tag: `deadline-${pair.eid}`
		});
	}
}

export function flagExpiredPayments(repo, now = Date.now()) {
	return repo.payments.expireStale(now - PAYMENT_EXPIRE_MS).changes;
}

export function startScheduler(repo, push) {
	// Run once on start
	cleanupStaleSubscriptions(repo);
	flagExpiredPayments(repo);

	cron.schedule('0 0 * * *', () => cleanupStaleSubscriptions(repo), { timezone: 'UTC' });
	cron.schedule('0 10 * * *', () => notifyEvent1Day(repo, push), { timezone: 'UTC' });
	cron.schedule('0 10 * * *', () => notifyEventResponseDeadline(repo, push), { timezone: 'UTC' });
	cron.schedule('0 * * * *', () => flagExpiredPayments(repo));
}
