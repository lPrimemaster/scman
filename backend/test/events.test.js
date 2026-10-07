import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setup, iso } from './helpers.js';

let t, admin, fed, cpt;
beforeEach(async () => {
	t = await setup();
	admin = t.addUser('admin', 'admin', { full_name: 'Ana' });
	fed = t.addUser('fed', 'federado', { full_name: 'Filipe' });
	cpt = t.addUser('cpt', 'cpt', { full_name: 'Carla' });
	t.subscribe(admin);
});
afterEach(() => t.cleanup());

const names = (list) => list.map((a) => a.full_name);
const tick = () => new Promise((r) => setImmediate(r));

const body = (o = {}) => ({
	name: 'Volta',
	location: 'Évora',
	start: iso(10),
	end: iso(11),
	sub_limit_date: iso(5),
	change_limit: 2,
	type: 2,
	price: '10.00',
	description: 'Desc',
	files: [{ handle: 'h1', name: 'regulamento.pdf' }],
	...o
});

test('create, read, update, delete an event (admin only)', async () => {
	assert.equal((await t.request(fed, 'POST', '/api/events', body())).status, 403);

	const created = await t.request(admin, 'POST', '/api/events', body());
	assert.equal(created.status, 200);
	const id = created.body.id;
	assert.deepEqual(created.body.files, [{ handle: 'h1', name: 'regulamento.pdf' }]);
	assert.equal(t.repo.events.byId(id).files, 'h1[regulamento.pdf]', 'stored in the legacy format');

	const updated = await t.request(admin, 'PUT', `/api/events/${id}`, body({ name: 'Volta 2', files: [] }));
	assert.equal(updated.body.name, 'Volta 2');
	assert.equal(t.repo.events.byId(id).files, '');

	await t.request(fed, 'PUT', `/api/events/${id}/response`, { status: 1 });
	t.repo.schedule.markNotified(id);
	assert.equal((await t.request(admin, 'DELETE', `/api/events/${id}`)).status, 200);
	assert.equal((await t.request(admin, 'GET', `/api/events/${id}`)).status, 404);
});

test('event validation', async () => {
	assert.equal((await t.request(admin, 'POST', '/api/events', body({ start: '01/02/2026' }))).status, 400);
	assert.equal((await t.request(admin, 'POST', '/api/events', body({ type: 7 }))).status, 400);
	assert.equal((await t.request(admin, 'POST', '/api/events', body({ price: 'free' }))).status, 400);
	assert.equal((await t.request(admin, 'POST', '/api/events', body({ end: iso(1) }))).status, 400);
});

test('new events notify the relevant roles', async () => {
	const cptEndpoint = t.subscribe(cpt);
	await t.request(admin, 'POST', '/api/events', body({ type: 2 }));
	await tick();
	assert.deepEqual(
		t.pushes.map((m) => m.endpoint),
		['https://push.test/admin'],
		'cpt not notified of federated event'
	);
	const created = await t.request(admin, 'POST', '/api/events', body({ type: 0 }));
	await tick();
	const toCpt = t.pushes.find((m) => m.endpoint === cptEndpoint);
	assert.equal(toCpt.title, 'Novo evento adicionado.');
	assert.equal(toCpt.url, `/?event=${created.body.id}`, 'opens the event');
});

test('cpt users only see open event types', async () => {
	const fedEvent = t.addEvent({ type: 2 });
	const open = t.addEvent({ type: 0 });

	const cptList = await t.request(cpt, 'GET', '/api/events');
	assert.deepEqual(
		cptList.body.map((e) => e.id),
		[open]
	);
	assert.equal((await t.request(fed, 'GET', '/api/events')).body.length, 2);

	assert.equal((await t.request(cpt, 'GET', `/api/events/${fedEvent}`)).status, 404);
	assert.equal((await t.request(cpt, 'GET', '/api/events?type=2')).status, 403);
	assert.equal((await t.request(cpt, 'PUT', `/api/events/${fedEvent}/response`, { status: 1 })).status, 404);
});

test('upcoming filter, type filter and limit', async () => {
	t.addEvent({ type: 2, start: iso(-5), end: iso(-4), name: 'past' });
	t.addEvent({ type: 2, start: iso(20), end: iso(20), name: 'later' });
	t.addEvent({ type: 2, start: iso(3), end: iso(3), name: 'soon' });
	t.addEvent({ type: 3, start: iso(4), end: iso(4), name: 'camp' });

	const res = await t.request(fed, 'GET', '/api/events?upcoming=true&type=2&limit=5');
	assert.deepEqual(
		res.body.map((e) => e.name),
		['soon', 'later']
	);
	const one = await t.request(fed, 'GET', '/api/events?upcoming=true&type=2&limit=1');
	assert.deepEqual(
		one.body.map((e) => e.name),
		['soon']
	);
	assert.equal((await t.request(fed, 'GET', '/api/events?type=9')).status, 400);
});

test('responding updates attendance and notifies admins', async () => {
	const id = t.addEvent({ type: 2 });
	t.addUser('pending', 'federado', { active: false });

	let detail = (await t.request(fed, 'GET', `/api/events/${id}`)).body;
	assert.equal(detail.me.status, -1);
	assert.deepEqual(
		detail.attendance.noanswer.map((a) => a.username),
		['admin', 'fed']
	);
	assert.deepEqual(names(detail.attendance.noanswer), ['Ana', 'Filipe'], 'only active federated users expected');

	const res = await t.request(fed, 'PUT', `/api/events/${id}/response`, { status: 1 });
	assert.equal(res.status, 200);
	assert.equal((await t.request(fed, 'GET', '/api/events')).body[0].my_status, 1);
	assert.equal((await t.request(admin, 'GET', '/api/events')).body[0].my_status, -1);
	assert.deepEqual(res.body.attendance.going, [{ full_name: 'Filipe', username: 'fed' }]);
	assert.equal(res.body.me.status, 1);

	await tick();
	assert.equal(t.pushes.at(-1).title, 'Nova inscrição');
	assert.match(t.pushes.at(-1).body, /Filipe .* para "Interessado"/);

	detail = (await t.request(cpt, 'GET', `/api/events/${t.addEvent({ type: 0 })}`)).body;
	assert.deepEqual(names(detail.attendance.noanswer), ['Ana', 'Carla', 'Filipe'], 'open events expect everyone');
});

test('change limit: initial answer plus change_limit changes', async () => {
	const id = t.addEvent({ change_limit: 1 });
	let r = await t.request(fed, 'PUT', `/api/events/${id}/response`, { status: 1 });
	assert.equal(r.body.me.changesLeft, 1);
	r = await t.request(fed, 'PUT', `/api/events/${id}/response`, { status: 0 });
	assert.equal(r.body.me.changesLeft, 0);
	assert.equal(r.body.me.canRespond, false);
	assert.equal(r.body.me.locked, true);
	r = await t.request(fed, 'PUT', `/api/events/${id}/response`, { status: 1 });
	assert.equal(r.status, 400);
});

test('answers are accepted until the end of the limit day', async () => {
	const today = iso(0);
	const id = t.addEvent({ sub_limit_date: today });
	assert.equal((await t.request(fed, 'PUT', `/api/events/${id}/response`, { status: 1 })).status, 200);

	const past = t.addEvent({ sub_limit_date: iso(-2) });
	const r = await t.request(fed, 'PUT', `/api/events/${past}/response`, { status: 1 });
	assert.equal(r.status, 400);
	assert.equal((await t.request(fed, 'GET', `/api/events/${past}`)).body.me.deadlinePassed, true);
});

test('paid events cannot be changed', async () => {
	const id = t.addEvent({ price: '10' });
	await t.request(fed, 'PUT', `/api/events/${id}/response`, { status: 1 });
	t.repo.payments.create({ orderId: 'O1', amount: '10', eventId: id, userId: fed.id, now: Date.now() });
	t.repo.payments.capture({
		orderId: 'O1',
		transactionId: 'T',
		status: 'COMPLETED',
		payer: 'P',
		payedAt: Date.now()
	});

	const detail = (await t.request(fed, 'GET', `/api/events/${id}`)).body;
	assert.equal(detail.me.paid, true);
	const r = await t.request(fed, 'PUT', `/api/events/${id}/response`, { status: 0 });
	assert.equal(r.status, 400);
	assert.match(r.body.error, /payed/);
});

test('invalid response status is rejected', async () => {
	const id = t.addEvent();
	assert.equal((await t.request(fed, 'PUT', `/api/events/${id}/response`, { status: 5 })).status, 400);
});

const race = (o = {}) => ({ name: 'Prova Clube', location: 'Seixal', start: iso(20), ...o });

test('any athlete can create a CPT race with fixed type, price and change limit', async () => {
	t.subscribe(fed);
	for (const user of [cpt, fed, admin]) {
		const res = await t.request(
			user,
			'POST',
			'/api/events/races',
			race({ name: `Prova ${user.id}`, type: 2, price: '99.00', change_limit: 0 })
		);
		assert.equal(res.status, 200);
		assert.equal(res.body.type, 0);
		assert.equal(res.body.price, '0.00');
		assert.equal(res.body.change_limit, 10);
		assert.equal(res.body.sub_limit_date, iso(10), 'deadline defaults to 10 days before the start');
		assert.equal(res.body.end, res.body.start, 'single-day race');
		assert.deepEqual(res.body.files, []);
	}
	await tick();
	assert.equal(t.pushes.at(-1).title, 'Nova prova CPT adicionada.');
	assert.match(t.pushes.at(-1).body, new RegExp(`Prova ${admin.id} \\(por Ana\\)`));
});

test('CPT race deadline: custom, clamped to today, validated', async () => {
	const custom = await t.request(
		cpt,
		'POST',
		'/api/events/races',
		race({ name: 'Custom', end: iso(20), sub_limit_date: iso(15) })
	);
	assert.equal(custom.status, 200, 'an end equal to the start is accepted');
	assert.equal(custom.body.sub_limit_date, iso(15));

	const soon = await t.request(cpt, 'POST', '/api/events/races', race({ name: 'Soon', start: iso(3) }));
	assert.equal(soon.body.sub_limit_date, iso(0), 'never before today');

	assert.equal((await t.request(cpt, 'POST', '/api/events/races', race({ sub_limit_date: iso(25) }))).status, 400);
	assert.equal((await t.request(cpt, 'POST', '/api/events/races', race({ sub_limit_date: iso(-1) }))).status, 400);
	assert.equal((await t.request(cpt, 'POST', '/api/events/races', race({ start: iso(-2) }))).status, 400);
	assert.equal((await t.request(cpt, 'POST', '/api/events/races', race({ end: iso(21) }))).status, 400);
	assert.equal((await t.request(cpt, 'POST', '/api/events/races', race({ end: iso(19) }))).status, 400);
	assert.equal((await t.request(cpt, 'POST', '/api/events/races', race({ name: '' }))).status, 400);
});

test('similar races: upcoming CPT races only, best first, at most 3', async () => {
	const seixal = t.addEvent({ name: 'Prova CPT Seixal', type: 0, start: iso(20), end: iso(20) });
	t.addEvent({ name: 'Seixal Fed', type: 2 });
	t.addEvent({ name: 'Seixal antiga', type: 0, start: iso(-20), end: iso(-20) });
	t.addEvent({ name: 'Prova de Évora', type: 0 });
	for (let i = 0; i < 4; i++) t.addEvent({ name: `Seixal ${i} extra palavras`, type: 0 });

	const res = await t.request(cpt, 'GET', `/api/events/races/similar?name=${encodeURIComponent('GP do Seixal')}`);
	assert.equal(res.status, 200);
	assert.equal(res.body.length, 3);
	assert.equal(res.body[0].id, seixal);
	assert.ok(res.body.every((e) => e.type === 0 && e.name.includes('Seixal') && e.start >= iso(0)));
	assert.ok(res.body[0].score >= res.body[1].score);

	assert.deepEqual((await t.request(cpt, 'GET', '/api/events/races/similar?name=Lisboa')).body, []);
	assert.equal((await t.request(cpt, 'GET', '/api/events/races/similar?name=ab')).status, 400);
	assert.equal((await t.request(null, 'GET', '/api/events/races/similar?name=Seixal')).status, 401);
});

test('race names are unique among unfinished events, whatever the date', async () => {
	const first = await t.request(cpt, 'POST', '/api/events/races', race({ name: 'Prova do Seixal' }));
	for (const body of [race({ name: ' prova do SEIXAL' }), race({ name: 'Prova do Seixal', start: iso(30) })]) {
		const dup = await t.request(fed, 'POST', '/api/events/races', body);
		assert.equal(dup.status, 409);
		assert.equal(dup.body.existingId, first.body.id);
	}
	// A finished event with the same name does not block (yearly races)
	t.addEvent({ name: 'Volta Antiga', type: 0, start: iso(-30), end: iso(-30) });
	assert.equal((await t.request(cpt, 'POST', '/api/events/races', race({ name: 'Volta Antiga' }))).status, 200);
	// Similar names are only suggestions
	assert.equal((await t.request(cpt, 'POST', '/api/events/races', race({ name: 'Prova do Seixal 2' }))).status, 200);
});

test('similar races flag exact names first and cover every visible type', async () => {
	const camp = t.addEvent({ name: 'cpt', type: 1, start: iso(5), end: iso(5) });
	t.addEvent({ name: 'Volta Seixal', type: 2, start: iso(5), end: iso(5) });

	const res = await t.request(cpt, 'GET', '/api/events/races/similar?name=CPT');
	assert.equal(res.body[0].id, camp);
	assert.equal(res.body[0].exact, true);
	assert.ok(
		res.body.every((e) => e.type < 2),
		'cpt athletes only see open types'
	);

	assert.deepEqual((await t.request(cpt, 'GET', '/api/events/races/similar?name=Seixal')).body, []);
	const fedRes = await t.request(fed, 'GET', '/api/events/races/similar?name=Seixal');
	assert.ok(
		fedRes.body.some((e) => e.type === 2 && !e.exact),
		'federados also see federated races'
	);
});

test('editing an event tells athletes what changed', async () => {
	t.subscribe(fed);
	const created = await t.request(admin, 'POST', '/api/events', body({ location: 'Évora' }));
	const id = created.body.id;
	await tick();
	t.pushes.length = 0;

	await t.request(admin, 'PUT', `/api/events/${id}`, body({ location: 'Beja' }));
	await tick();
	const msg = t.pushes.find((m) => m.endpoint === 'https://push.test/fed');
	assert.equal(msg.title, 'Evento alterado: Volta');
	assert.equal(msg.body, 'Local: Évora → Beja');
	assert.equal(msg.url, `/?event=${id}`);

	t.pushes.length = 0;
	await t.request(admin, 'PUT', `/api/events/${id}`, body({ location: 'Beja' }));
	await tick();
	assert.equal(t.pushes.length, 0, 'saving without changes does not notify');
});

test('the event list includes how many answer changes are left', async () => {
	const id = t.addEvent({ change_limit: 1 });
	const left = async () => (await t.request(fed, 'GET', '/api/events')).body.find((e) => e.id === id).my_changes_left;
	assert.equal(await left(), 2, 'first answer plus one change');
	await t.request(fed, 'PUT', `/api/events/${id}/response`, { status: 1 });
	assert.equal(await left(), 1);
	await t.request(fed, 'PUT', `/api/events/${id}/response`, { status: 0 });
	assert.equal(await left(), 0);
});
