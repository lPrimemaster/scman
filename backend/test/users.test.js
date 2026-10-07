import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setup, PASSWORD } from './helpers.js';

let t, admin;
beforeEach(async () => {
	t = await setup();
	admin = t.addUser('admin', 'admin');
});
afterEach(() => t.cleanup());

test('only admins can manage users', async () => {
	const fed = t.addUser('fed', 'federado');
	assert.equal((await t.request(fed, 'GET', '/api/users')).status, 403);
	assert.equal(
		(await t.request(fed, 'POST', '/api/users', { username: 'x', full_name: 'X', role: 'cpt' })).status,
		403
	);
	assert.equal((await t.request(fed, 'GET', '/api/invites')).status, 403);
});

test('invite → activate → login flow', async () => {
	const created = await t.request(admin, 'POST', '/api/users', {
		username: 'j.silva',
		full_name: 'João Silva',
		role: 'cpt'
	});
	assert.equal(created.status, 200);
	assert.match(created.body.inviteLink, /^\/activate\?token=[0-9a-f]{64}$/);
	const { token } = created.body;

	const check = await t.request(null, 'GET', `/api/invites/${token}`);
	assert.deepEqual(check.body, { valid: true, username: 'j.silva' });

	const list = await t.request(admin, 'GET', '/api/invites');
	assert.equal(list.body[0].status, 'pending');

	const act = await t.request(null, 'POST', `/api/invites/${token}/activate`, { password: 'newpass1' });
	assert.equal(act.status, 200);

	assert.deepEqual((await t.request(null, 'GET', `/api/invites/${token}`)).body, {
		valid: false,
		reason: 'used_token'
	});
	assert.equal(
		(await t.request(null, 'POST', `/api/invites/${token}/activate`, { password: 'again123' })).status,
		400
	);

	const login = await t.request(null, 'POST', '/api/auth/login', { username: 'j.silva', password: 'newpass1' });
	assert.equal(login.status, 200);
	assert.equal((await t.request(admin, 'GET', '/api/invites')).body[0].status, 'active');
});

test('duplicate usernames are rejected', async () => {
	const res = await t.request(admin, 'POST', '/api/users', { username: 'admin', full_name: 'Dup', role: 'cpt' });
	assert.equal(res.status, 409);
});

test('expired invites cannot be used', async () => {
	const { body } = await t.request(admin, 'POST', '/api/users', { username: 'late', full_name: 'Late', role: 'cpt' });
	t.state.now += 6 * 86400000;
	assert.equal((await t.request(null, 'GET', `/api/invites/${body.token}`)).body.reason, 'expired_token');
	assert.equal(
		(await t.request(null, 'POST', `/api/invites/${body.token}/activate`, { password: 'abcdef1' })).status,
		400
	);
	assert.equal((await t.request(admin, 'GET', '/api/invites')).body[0].status, 'expired');
});

test('deleting a pending invite also removes the never activated account', async () => {
	const { body } = await t.request(admin, 'POST', '/api/users', { username: 'gone', full_name: 'Gone', role: 'cpt' });
	assert.equal((await t.request(admin, 'DELETE', `/api/invites/${body.token}`)).status, 200);
	assert.equal(t.repo.users.byUsername('gone'), undefined);
});

test('deleting a used invite keeps the account', async () => {
	const { body } = await t.request(admin, 'POST', '/api/users', { username: 'kept', full_name: 'Kept', role: 'cpt' });
	await t.request(null, 'POST', `/api/invites/${body.token}/activate`, { password: 'abcdef1' });
	await t.request(admin, 'DELETE', `/api/invites/${body.token}`);
	assert.ok(t.repo.users.byUsername('kept'));
});

test('list users with status', async () => {
	const fed = t.addUser('fed', 'federado');
	t.addUser('pending', 'cpt', { active: false });
	t.repo.users.setDisabled(fed.id, true);
	const { body } = await t.request(admin, 'GET', '/api/users');
	const byName = Object.fromEntries(body.map((u) => [u.username, u.status]));
	assert.deepEqual(byName, { admin: 'active', fed: 'disabled', pending: 'inactive' });
	assert.equal(body[0].passhash, undefined);
});

test('patch role and disabled flag', async () => {
	const fed = t.addUser('fed', 'federado');
	let res = await t.request(admin, 'PATCH', `/api/users/${fed.id}`, { role: 'cpt' });
	assert.equal(res.body.role, 'cpt');
	res = await t.request(admin, 'PATCH', `/api/users/${fed.id}`, { disabled: true });
	assert.equal(res.body.status, 'disabled');
	assert.equal((await t.request(fed, 'GET', '/api/auth/me')).status, 403);
	res = await t.request(admin, 'PATCH', `/api/users/${fed.id}`, { disabled: false });
	assert.equal(res.body.status, 'active');
	assert.equal((await t.request(admin, 'PATCH', `/api/users/${fed.id}`, { role: 'king' })).status, 400);
	assert.equal((await t.request(admin, 'PATCH', '/api/users/9999', { role: 'cpt' })).status, 404);
});

test('password reset flow reuses the open link', async () => {
	const fed = t.addUser('fed', 'federado');
	const first = await t.request(admin, 'POST', `/api/users/${fed.id}/reset`);
	const second = await t.request(admin, 'POST', `/api/users/${fed.id}/reset`);
	assert.equal(first.body.resetLink, second.body.resetLink);
	const token = first.body.resetLink.split('=')[1];

	assert.deepEqual((await t.request(null, 'GET', `/api/resets/${token}`)).body, { valid: true, username: 'fed' });
	assert.equal((await t.request(null, 'POST', `/api/resets/${token}`, { password: 'brandnew1' })).status, 200);
	assert.equal((await t.request(null, 'GET', `/api/resets/${token}`)).body.reason, 'used_token');
	assert.equal((await t.request(null, 'GET', '/api/resets/unknown')).body.reason, 'invalid_token');

	assert.equal(
		(await t.request(null, 'POST', '/api/auth/login', { username: 'fed', password: PASSWORD })).status,
		401
	);
	assert.equal(
		(await t.request(null, 'POST', '/api/auth/login', { username: 'fed', password: 'brandnew1' })).status,
		200
	);
});

test('admins cannot demote or disable themselves', async () => {
	assert.equal((await t.request(admin, 'PATCH', `/api/users/${admin.id}`, { role: 'cpt' })).status, 400);
	assert.equal((await t.request(admin, 'PATCH', `/api/users/${admin.id}`, { disabled: true })).status, 400);
});
