import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcrypt';
import { openDb, createRepo } from '../src/db.js';
import { buildApp } from '../src/app.js';
import { createPushService } from '../src/services/push.js';
import { createStorage } from '../src/services/storage.js';
import { signToken } from '../src/plugins/auth.js';

export const SECRET = 'test-secret';
export const PASSWORD = 'secret123';

/** Records Web Push deliveries; `failures[endpoint] = statusCode` makes that endpoint fail. */
export function fakeSender() {
	const sent = [];
	const failures = {};
	async function send(subscription, payload) {
		const status = failures[subscription.endpoint];
		if (status) throw Object.assign(new Error('push failed'), { statusCode: status });
		sent.push({ endpoint: subscription.endpoint, ...JSON.parse(payload) });
	}
	return { send, sent, failures };
}

export function fakePaypal({ captureStatus = 'COMPLETED' } = {}) {
	let n = 0;
	return {
		createOrder: async () => ({ ok: true, status: 201, data: { id: `ORDER-${++n}` } }),
		captureOrder: async (orderId) => ({
			ok: true,
			status: 201,
			data: {
				id: orderId,
				status: captureStatus,
				payer: { payer_id: 'PAYER' },
				purchase_units: [{ payments: { captures: [{ id: 'CAP-1' }] } }]
			}
		})
	};
}

export const iso = (offsetDays, now = Date.now()) => new Date(now + offsetDays * 86400000).toISOString().slice(0, 10);

export async function setup({ db, clock } = {}) {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scman-test-'));
	const repo = createRepo(db ?? openDb(':memory:'));
	const sender = fakeSender();
	const push = createPushService({ repo, sender: sender.send, log: { error: () => {} } });
	const state = { now: clock ?? Date.now() };
	const app = await buildApp({
		repo,
		push,
		paypal: fakePaypal(),
		storage: createStorage(path.join(tmp, 'uploads')),
		secret: SECRET,
		vapidPublicKey: 'test-public-key',
		now: () => state.now
	});

	const hash = await bcrypt.hash(PASSWORD, 4);
	function addUser(username, role, { active = true, full_name } = {}) {
		const id = repo.users.create({ username, full_name: full_name ?? username.toUpperCase(), role });
		if (active) repo.users.activate(id, hash);
		return { id, username, role, token: signToken({ id, role }, SECRET) };
	}

	/** Registers a browser for push; deliveries show up in `pushes` with this endpoint. */
	function subscribe(user, name = user.username) {
		const endpoint = `https://push.test/${name}`;
		repo.webpush.upsert({ userId: user.id, endpoint, p256dh: 'p256dh', auth: 'auth', now: state.now });
		return endpoint;
	}

	function addEvent(overrides = {}) {
		return repo.events.create({
			name: 'Evento',
			location: 'Seixal',
			start: iso(10, state.now),
			end: iso(11, state.now),
			sub_limit_date: iso(5, state.now),
			change_limit: 2,
			type: 2,
			price: '0',
			description: '',
			files: '',
			...overrides
		});
	}

	async function request(user, method, url, payload) {
		const res = await app.inject({
			method,
			url,
			payload,
			headers: user ? { authorization: `Bearer ${user.token}` } : {}
		});
		return {
			status: res.statusCode,
			body: res.body ? safeJson(res.body) : undefined,
			headers: res.headers,
			raw: res
		};
	}

	return {
		app,
		repo,
		sender,
		/** Delivered notifications: { endpoint, title, body, url, tag } */
		pushes: sender.sent,
		state,
		subscribe,
		addUser,
		addEvent,
		request,
		cleanup: async () => {
			await app.close();
			fs.rmSync(tmp, { recursive: true, force: true });
		}
	};
}

function safeJson(s) {
	try {
		return JSON.parse(s);
	} catch {
		return s;
	}
}
