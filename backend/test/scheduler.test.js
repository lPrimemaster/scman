import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setup, iso } from './helpers.js';
import { notifyEvent1Day, notifyEventResponseDeadline, cleanupStaleFCMTokens } from '../src/services/scheduler.js';
import { createPushService } from '../src/services/push.js';

let t, fed, cpt, push, notified;
beforeEach(async () => {
	t = await setup();
	fed = t.addUser('fed', 'federado');
	cpt = t.addUser('cpt', 'cpt');
	notified = [];
	push = { notifyUser: (uid, msg) => notified.push({ uid, ...msg }) };
});
afterEach(() => t.cleanup());

test('day-before reminder goes to signed-up users once', () => {
	const id = t.addEvent({ type: 0, start: iso(1), end: iso(1) });
	t.repo.responses.upsert(fed.id, id, 1);
	t.repo.responses.upsert(cpt.id, id, 0); // not going: no reminder

	notifyEvent1Day(t.repo, push);
	assert.deepEqual(
		notified.map((n) => n.uid),
		[fed.id]
	);
	assert.equal(notified[0].title, 'Falta 1 dia para um evento em que estás inscrito!');

	notifyEvent1Day(t.repo, push);
	assert.equal(notified.length, 1, 'event marked as notified');
});

test('events further away are not reminded nor marked', () => {
	const id = t.addEvent({ start: iso(5) });
	t.repo.responses.upsert(fed.id, id, 1);
	notifyEvent1Day(t.repo, push);
	assert.equal(notified.length, 0);
	assert.equal(t.repo.schedule.unnotifiedResponses().length, 1);
});

test('deadline reminders during the last week, respecting visibility', () => {
	t.addEvent({ type: 2, sub_limit_date: iso(3), name: 'fed-race' });
	t.addEvent({ type: 0, sub_limit_date: iso(0), name: 'open-today' });
	t.addEvent({ type: 0, sub_limit_date: iso(9), name: 'too-far' });
	t.addEvent({ type: 0, sub_limit_date: iso(-1), name: 'past' });

	notifyEventResponseDeadline(t.repo, push);
	const got = notified.map((n) => `${n.uid}:${n.body}:${n.title}`).sort();
	assert.deepEqual(
		got,
		[
			`${cpt.id}:open-today:É hoje a data limite para inscrição do evento!`,
			`${fed.id}:fed-race:Faltam 3 dia(s) para o limite de inscrição do evento!`,
			`${fed.id}:open-today:É hoje a data limite para inscrição do evento!`
		].sort()
	);
});

test('stale FCM tokens are removed', () => {
	t.repo.fcm.upsert({ userId: fed.id, token: 'x'.repeat(30), platform: 'ios', now: Date.now() - 31 * 86400000 });
	t.repo.fcm.upsert({ userId: fed.id, token: 'y'.repeat(30), platform: 'ios', now: Date.now() });
	assert.equal(cleanupStaleFCMTokens(t.repo), 1);
});

test('push service disables dead tokens', async () => {
	t.repo.fcm.upsert({ userId: fed.id, token: 'dead'.repeat(8), platform: 'ios', now: Date.now() });
	const messaging = {
		sendEachForMulticast: async (m) => ({
			successCount: 0,
			failureCount: m.tokens.length,
			responses: m.tokens.map(() => ({
				success: false,
				error: { code: 'messaging/registration-token-not-registered' }
			}))
		})
	};
	const service = createPushService({ repo: t.repo, messaging });
	const res = await service.sendToUser(fed.id, { title: 'x', body: 'y' });
	assert.equal(res.failed, 1);
	assert.deepEqual(t.repo.fcm.activeForUser(fed.id), []);
});

test('push registration endpoints', async () => {
	const token = 'z'.repeat(40);
	assert.equal((await t.request(fed, 'POST', '/api/push/tokens', { token, platform: 'android' })).status, 200);
	assert.deepEqual(t.repo.fcm.activeForUser(fed.id), [token]);
	assert.equal((await t.request(fed, 'POST', '/api/push/tokens', { token: 'short' })).status, 400);
	assert.equal((await t.request(fed, 'DELETE', '/api/push/tokens', { token })).status, 200);
	assert.deepEqual(t.repo.fcm.activeForUser(fed.id), []);
});
