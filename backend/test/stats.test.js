import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers.js';
import { INVITE_TTL_MS } from '../src/routes/invites.js';

let t, admin, fed, cpt;
beforeEach(async () => {
	t = await setup();
	admin = t.addUser('admin', 'admin', { full_name: 'Ana' });
	fed = t.addUser('fed', 'federado', { full_name: 'Filipe' });
	cpt = t.addUser('cpt', 'cpt', { full_name: 'Carla' });
});
afterEach(() => t.cleanup());

const url = '/api/stats/attendance';

test('attendance stats are admin only', async () => {
	assert.equal((await t.request(fed, 'GET', url)).status, 403);
	assert.equal((await t.request(cpt, 'GET', url)).status, 403);
	assert.equal((await t.request(null, 'GET', url)).status, 401);
	assert.equal((await t.request(admin, 'GET', url)).status, 200);
});

test('events and responses are limited to the range', async () => {
	const inRange = t.addEvent({ name: 'in', start: '2026-03-10', end: '2026-03-10' });
	const outside = t.addEvent({ name: 'out', start: '2026-06-01', end: '2026-06-01' });
	t.repo.responses.upsert(fed.id, inRange, 1);
	t.repo.responses.upsert(fed.id, outside, 0);

	const res = await t.request(admin, 'GET', `${url}?from=2026-01-01&to=2026-03-31`);
	assert.equal(res.status, 200);
	assert.deepEqual(
		res.body.events.map((e) => e.id),
		[inRange]
	);
	assert.deepEqual(
		res.body.responses.map((r) => [r.user_id, r.event_id, r.status]),
		[[fed.id, inRange, 1]]
	);
	assert.equal((await t.request(admin, 'GET', `${url}?from=2026-04-01&to=2026-03-01`)).status, 400);
	assert.equal((await t.request(admin, 'GET', `${url}?from=01-01-2026`)).status, 400);
});

test('athletes carry role, flags and a join date from their invite', async () => {
	const created = Date.UTC(2026, 1, 15, 12);
	t.repo.invites.create('tok', cpt.id, created + INVITE_TTL_MS);
	t.repo.users.setDisabled(fed.id, true);
	const pending = t.addUser('new', 'cpt', { active: false, full_name: 'Nuno' });

	const { athletes } = (await t.request(admin, 'GET', url)).body;
	const by = Object.fromEntries(athletes.map((a) => [a.username, a]));
	assert.equal(by.cpt.joined, '2026-02-15');
	assert.equal(by.admin.joined, null, 'no invite: member from the start');
	assert.equal(by.fed.disabled, true);
	assert.equal(by.new.active, false);
	assert.equal(by.new.id, pending.id);
	assert.deepEqual(Object.keys(by.cpt).sort(), [
		'active',
		'disabled',
		'full_name',
		'id',
		'joined',
		'role',
		'username'
	]);
});
