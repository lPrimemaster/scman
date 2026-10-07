import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setup, iso } from './helpers.js';
import { notifyEvent1Day, notifyEventResponseDeadline, cleanupStaleSubscriptions } from '../src/services/scheduler.js';
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

test('deadline reminders 7 days, 2 days and on the day, respecting visibility', () => {
	const inWeek = t.addEvent({ type: 2, sub_limit_date: iso(7), name: 'fed-week' });
	t.addEvent({ type: 0, sub_limit_date: iso(2), name: 'open-2' });
	t.addEvent({ type: 0, sub_limit_date: iso(0), name: 'open-today' });
	t.addEvent({ type: 0, sub_limit_date: iso(3), name: 'not-a-reminder-day' });
	t.addEvent({ type: 0, sub_limit_date: iso(-1), name: 'past' });

	notifyEventResponseDeadline(t.repo, push);
	const got = notified.map((n) => `${n.uid}:${n.body.split(' ')[0]}:${n.title}`).sort();
	assert.deepEqual(
		got,
		[
			`${cpt.id}:open-2:Faltam 2 dias para o limite de inscrição!`,
			`${cpt.id}:open-today:É hoje a data limite para inscrição!`,
			`${fed.id}:fed-week:Faltam 7 dias para o limite de inscrição!`,
			`${fed.id}:open-2:Faltam 2 dias para o limite de inscrição!`,
			`${fed.id}:open-today:É hoje a data limite para inscrição!`
		].sort()
	);
	assert.equal(notified.find((n) => n.body.startsWith('fed-week')).url, `/?event=${inWeek}`);
});

test('deadline reminders skip disabled and never-activated accounts', () => {
	t.addEvent({ type: 0, sub_limit_date: iso(2) });
	t.repo.users.setDisabled(cpt.id, true);
	t.addUser('pending', 'cpt', { active: false });
	notifyEventResponseDeadline(t.repo, push);
	assert.deepEqual(
		notified.map((n) => n.uid),
		[fed.id]
	);
});

test('stale push subscriptions are removed', () => {
	t.repo.webpush.upsert({
		userId: fed.id,
		endpoint: 'https://push.test/old',
		p256dh: 'k',
		auth: 'a',
		now: Date.now() - 91 * 86400000
	});
	t.repo.webpush.upsert({
		userId: fed.id,
		endpoint: 'https://push.test/new',
		p256dh: 'k',
		auth: 'a',
		now: Date.now()
	});
	assert.equal(cleanupStaleSubscriptions(t.repo), 1);
	assert.deepEqual(
		t.repo.webpush.forUser(fed.id).map((s) => s.endpoint),
		['https://push.test/new']
	);
});

test('push service drops subscriptions the push service reports as gone', async () => {
	const gone = t.subscribe(fed, 'gone');
	const alive = t.subscribe(fed, 'alive');
	const flaky = t.subscribe(fed, 'flaky');
	t.sender.failures[gone] = 410;
	t.sender.failures[flaky] = 500;
	const service = createPushService({ repo: t.repo, sender: t.sender.send, log: { error: () => {} } });

	const res = await service.sendToUser(fed.id, { title: 'Olá', body: 'x', url: '/?event=1' });
	assert.deepEqual(res, { ok: false, sent: 1, failed: 2 });
	assert.deepEqual(t.pushes, [{ endpoint: alive, title: 'Olá', body: 'x', url: '/?event=1' }]);
	assert.deepEqual(
		t.repo.webpush
			.forUser(fed.id)
			.map((s) => s.endpoint)
			.sort(),
		[alive, flaky].sort(),
		'only 404/410 removes'
	);
});

test('push without VAPID keys is disabled, not an error', async () => {
	const service = createPushService({ repo: t.repo, sender: null });
	t.subscribe(fed);
	assert.equal(service.enabled, false);
	assert.deepEqual(await service.sendToUser(fed.id, { title: 'x' }), { ok: true, sent: 0, failed: 0 });
});

test('push subscription endpoints', async () => {
	const sub = { endpoint: 'https://push.example/abc', keys: { p256dh: 'BKey', auth: 'secret' } };
	assert.deepEqual((await t.request(null, 'GET', '/api/push/config')).body, {
		enabled: true,
		publicKey: 'test-public-key'
	});
	assert.equal((await t.request(null, 'POST', '/api/push/subscriptions', sub)).status, 401);
	assert.equal((await t.request(fed, 'POST', '/api/push/subscriptions', sub)).status, 200);
	assert.equal((await t.request(fed, 'POST', '/api/push/subscriptions', sub)).status, 200, 'idempotent');
	assert.equal(t.repo.webpush.forUser(fed.id).length, 1);
	assert.equal((await t.request(fed, 'POST', '/api/push/subscriptions', { endpoint: 'http://x' })).status, 400);

	const test = await t.request(fed, 'POST', '/api/push/test');
	assert.equal(test.body.sent, 1);
	assert.equal(t.pushes.at(-1).title, 'Notificações ativas ✓');

	// Another user cannot remove it
	assert.equal((await t.request(cpt, 'DELETE', '/api/push/subscriptions', { endpoint: sub.endpoint })).status, 200);
	assert.equal(t.repo.webpush.forUser(fed.id).length, 1);
	await t.request(fed, 'DELETE', '/api/push/subscriptions', { endpoint: sub.endpoint });
	assert.equal(t.repo.webpush.forUser(fed.id).length, 0);
});
