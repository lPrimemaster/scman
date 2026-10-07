import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers.js';
import { flagExpiredPayments } from '../src/services/scheduler.js';

let t, fed;
beforeEach(async () => {
	t = await setup();
	fed = t.addUser('fed', 'federado');
});
afterEach(() => t.cleanup());

test('order and capture a payment', async () => {
	const id = t.addEvent({ price: '10.00' });
	const order = await t.request(fed, 'POST', '/api/payments/orders', { event_id: id });
	assert.equal(order.status, 200);
	assert.equal(t.repo.payments.byOrder(order.body.orderId).status, 'PENDING');

	const cap = await t.request(fed, 'POST', `/api/payments/orders/${order.body.orderId}/capture`);
	assert.equal(cap.status, 200);
	const row = t.repo.payments.byOrder(order.body.orderId);
	assert.equal(row.status, 'COMPLETED');
	assert.equal(row.transaction_id, 'CAP-1');

	assert.equal((await t.request(fed, 'POST', '/api/payments/orders', { event_id: id })).body.error, 'Already paid.');
});

test('free events are not payable', async () => {
	const id = t.addEvent({ price: '0' });
	assert.equal((await t.request(fed, 'POST', '/api/payments/orders', { event_id: id })).status, 400);
});

test('expired orders cannot be captured', async () => {
	const id = t.addEvent({ price: '5' });
	const order = await t.request(fed, 'POST', '/api/payments/orders', { event_id: id });
	t.state.now += 6 * 60 * 1000;
	const cap = await t.request(fed, 'POST', `/api/payments/orders/${order.body.orderId}/capture`);
	assert.equal(cap.status, 409);
	assert.equal(t.repo.payments.byOrder(order.body.orderId).status, 'EXPIRED');
});

test("users cannot capture someone else's order", async () => {
	const other = t.addUser('other', 'federado');
	const id = t.addEvent({ price: '5' });
	const order = await t.request(fed, 'POST', '/api/payments/orders', { event_id: id });
	assert.equal((await t.request(other, 'POST', `/api/payments/orders/${order.body.orderId}/capture`)).status, 404);
});

test('scheduler flags stale pending payments', () => {
	t.addEvent();
	t.repo.payments.create({
		orderId: 'OLD',
		amount: '1',
		eventId: 1,
		userId: fed.id,
		now: Date.now() - 10 * 60 * 1000
	});
	t.repo.payments.create({ orderId: 'NEW', amount: '1', eventId: 1, userId: fed.id, now: Date.now() });
	assert.equal(flagExpiredPayments(t.repo), 1);
	assert.equal(t.repo.payments.byOrder('OLD').status, 'EXPIRED');
	assert.equal(t.repo.payments.byOrder('NEW').status, 'PENDING');
});

test('events with payments cannot be deleted', async () => {
	const admin = t.addUser('admin', 'admin');
	const id = t.addEvent({ price: '5' });
	await t.request(fed, 'POST', '/api/payments/orders', { event_id: id });
	assert.equal((await t.request(admin, 'DELETE', `/api/events/${id}`)).status, 409);
});
