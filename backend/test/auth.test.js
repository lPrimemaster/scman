import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { setup, PASSWORD, SECRET } from './helpers.js';

let t;
beforeEach(async () => (t = await setup()));
afterEach(() => t.cleanup());

test('login returns a token for valid credentials', async () => {
	t.addUser('ana', 'federado');
	const res = await t.request(null, 'POST', '/api/auth/login', { username: 'ana', password: PASSWORD });
	assert.equal(res.status, 200);
	assert.equal(res.body.user.username, 'ana');
	const payload = jwt.verify(res.body.token, SECRET);
	assert.equal(payload.role, 'federado');
});

test('login rejects wrong password and unknown user', async () => {
	t.addUser('ana', 'federado');
	assert.equal((await t.request(null, 'POST', '/api/auth/login', { username: 'ana', password: 'nope' })).status, 401);
	assert.equal((await t.request(null, 'POST', '/api/auth/login', { username: 'x', password: 'nope' })).status, 401);
});

test('login of a never activated account is a 401, not a crash', async () => {
	t.addUser('pending', 'cpt', { active: false });
	const res = await t.request(null, 'POST', '/api/auth/login', { username: 'pending', password: 'whatever' });
	assert.equal(res.status, 401);
});

test('disabled users cannot log in or use their token', async () => {
	const u = t.addUser('ana', 'federado');
	t.repo.users.setDisabled(u.id, true);
	assert.equal(
		(await t.request(null, 'POST', '/api/auth/login', { username: 'ana', password: PASSWORD })).status,
		403
	);
	assert.equal((await t.request(u, 'GET', '/api/auth/me')).status, 403);
});

test('me returns the current user and uses the role from the database', async () => {
	const u = t.addUser('ana', 'federado');
	t.repo.users.setRole(u.id, 'admin');
	const res = await t.request(u, 'GET', '/api/auth/me');
	assert.equal(res.status, 200);
	assert.equal(res.body.role, 'admin');
	assert.equal(res.body.username, 'ana');
});

test('requests without or with a bad token are 401', async () => {
	assert.equal((await t.request(null, 'GET', '/api/auth/me')).status, 401);
	assert.equal((await t.request({ token: 'garbage' }, 'GET', '/api/auth/me')).status, 401);
	const forged = jwt.sign({ id: 1, role: 'admin' }, 'other-secret');
	assert.equal((await t.request({ token: forged }, 'GET', '/api/auth/me')).status, 401);
});

test('tokens issued by the previous server format are accepted', async () => {
	const u = t.addUser('ana', 'federado');
	// Old server: jwt.sign({ id, role }, SECRET, { expiresIn: '7d' })
	const old = jwt.sign({ id: u.id, role: u.role }, SECRET, { expiresIn: '7d' });
	assert.equal((await t.request({ token: old }, 'GET', '/api/auth/me')).status, 200);
});

test('users change their own password', async () => {
	const ana = t.addUser('ana', 'federado');
	const change = (body) => t.request(ana, 'POST', '/api/auth/password', body);

	const wrong = await change({ current: 'nope', password: 'novapass1' });
	assert.equal(wrong.status, 400, 'not 401: that would sign the user out');
	assert.equal((await change({ current: PASSWORD, password: '123' })).status, 400, 'minimum length');
	assert.equal(
		(await t.request(null, 'POST', '/api/auth/password', { current: PASSWORD, password: 'novapass1' })).status,
		401
	);

	assert.equal((await change({ current: PASSWORD, password: 'novapass1' })).status, 200);
	const login = (password) => t.request(null, 'POST', '/api/auth/login', { username: 'ana', password });
	assert.equal((await login(PASSWORD)).status, 401);
	assert.equal((await login('novapass1')).status, 200);
});
