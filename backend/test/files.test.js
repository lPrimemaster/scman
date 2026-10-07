import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers.js';
import { contentDisposition } from '../src/routes/files.js';

let t, admin, fed;
beforeEach(async () => {
	t = await setup();
	admin = t.addUser('admin', 'admin');
	fed = t.addUser('fed', 'federado');
});
afterEach(() => t.cleanup());

function multipart(filename, content, type = 'application/pdf') {
	const boundary = '----scman';
	const payload =
		`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
		`Content-Type: ${type}\r\n\r\n${content}\r\n--${boundary}--\r\n`;
	return { payload, headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}

async function upload(user, filename = 'regulamento.pdf', content = 'hello world') {
	const { payload, headers } = multipart(filename, content);
	const res = await t.app.inject({
		method: 'POST',
		url: '/api/files',
		payload,
		headers: { ...headers, authorization: `Bearer ${user.token}` }
	});
	return { status: res.statusCode, body: JSON.parse(res.body) };
}

test('upload, sign, download and delete', async () => {
	assert.equal((await upload(fed)).status, 403);

	const up = await upload(admin, 'Regulamento é.pdf');
	assert.equal(up.status, 200);
	assert.equal(up.body.size, 11);

	const link = await t.request(fed, 'GET', `/api/files/${up.body.handle}/link`);
	assert.equal(link.status, 200);

	const dl = await t.app.inject({ method: 'GET', url: link.body.url });
	assert.equal(dl.statusCode, 200);
	assert.equal(dl.body, 'hello world');
	assert.equal(dl.headers['content-type'], 'application/pdf');
	assert.match(dl.headers['content-disposition'], /filename\*=UTF-8''Regulamento%20%C3%A9\.pdf/);

	assert.equal((await t.request(admin, 'DELETE', `/api/files/${up.body.handle}`)).status, 200);
	assert.equal((await t.request(admin, 'DELETE', `/api/files/${up.body.handle}`)).status, 404);
	assert.equal((await t.app.inject({ method: 'GET', url: link.body.url })).statusCode, 404);
});

test('download links expire and are tamper proof', async () => {
	const up = await upload(admin);
	const { url } = (await t.request(fed, 'GET', `/api/files/${up.body.handle}/link`)).body;

	// Change the first signature digit to a different one
	const tampered = url.replace(/sig=(.)/, (_, c) => `sig=${c === '0' ? '1' : '0'}`);
	assert.notEqual(tampered, url);
	assert.equal((await t.app.inject({ method: 'GET', url: tampered })).statusCode, 403);
	assert.equal((await t.app.inject({ method: 'GET', url: url.replace(/sig=.*/, 'sig=short') })).statusCode, 403);
	t.state.now += 61 * 1000;
	assert.equal((await t.app.inject({ method: 'GET', url })).statusCode, 403);
});

test('deleting an event removes its attachments', async () => {
	const up = await upload(admin);
	const id = t.addEvent({ files: `${up.body.handle}[a.pdf]` });
	await t.request(admin, 'DELETE', `/api/events/${id}`);
	assert.equal(t.repo.files.byHandle(up.body.handle), undefined);
});

test('content disposition escapes quotes', () => {
	assert.equal(contentDisposition('a"b.pdf'), `inline; filename="a_b.pdf"; filename*=UTF-8''a%22b.pdf`);
});
