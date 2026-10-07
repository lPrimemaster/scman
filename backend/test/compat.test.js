// Ensures the restructured backend works on a database written by the previous version.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { openDb } from '../src/db.js';
import { setup, SECRET } from './helpers.js';

function legacyDatabase() {
	const db = new Database(':memory:');
	// Same tables as the old server, with the column order found in production for `files`
	db.exec(`
		create table users (id integer primary key autoincrement, passhash text, role text not null,
			active integer not null default 0, full_name text not null, username text unique not null);
		create table invites (token text primary key, user_id integer not null, expires_at date not null, used integer not null default 0);
		create table account_resets (token text primary key, user_id integer not null, used integer not null default 0);
		create table account_disabled (user_id integer primary key);
		create table events (id integer primary key autoincrement, name text not null, start text not null, end text not null,
			location text not null, sub_limit_date text not null, change_limit integer not null, type integer not null,
			price text not null, description text, files text);
		create table responses (user_id integer not null, event_id integer not null, status integer not null,
			count integer not null, updated_at timestamp not null, primary key (user_id, event_id));
		create table files (id integer primary key autoincrement, filename text not null, internal_filename text not null,
			handle text not null, path text not null, size integer not null, uploaded_at datetime default CURRENT_TIMESTAMP);
		alter table files add column mime_type text;
	`);
	return db;
}

test('legacy database: existing accounts log in and events parse', async () => {
	const db = legacyDatabase();
	// Exactly how the old server stored a user (bcrypt cost 10)
	const hash = await bcrypt.hash('old-password', 10);
	db.prepare(
		"insert into users (username, passhash, full_name, role, active) values ('a.antigo', ?, 'António Antigo', 'federado', 1)"
	).run(hash);
	db.prepare(
		`insert into events (name, start, end, location, sub_limit_date, change_limit, type, price, description, files)
		values ('Antigo', '2099-01-30', '2099-01-31', 'Seixal', '2099-01-20', 5, 2, '10', null, 'h1[Regulamento.pdf]:h2')`
	).run();
	db.prepare('insert into responses values (1, 1, 1, 2, CURRENT_TIMESTAMP)').run();

	// openDb-style schema exec must be a no-op on existing tables
	db.exec((await import('../src/db.js')).SCHEMA);
	assert.ok(openDb);

	const t = await setup({ db });
	try {
		const login = await t.request(null, 'POST', '/api/auth/login', {
			username: 'a.antigo',
			password: 'old-password'
		});
		assert.equal(login.status, 200);

		// A session token issued by the old server keeps working
		const oldToken = jwt.sign({ id: 1, role: 'federado' }, SECRET, { expiresIn: '7d' });
		const detail = await t.request({ token: oldToken }, 'GET', '/api/events/1');
		assert.equal(detail.status, 200);
		assert.equal(detail.body.event.description, '');
		assert.deepEqual(detail.body.event.files, [
			{ handle: 'h1', name: 'Regulamento.pdf' },
			{ handle: 'h2', name: 'Anexo' }
		]);
		assert.equal(detail.body.me.status, 1);
		assert.equal(detail.body.me.changesLeft, 4);
	} finally {
		await t.cleanup();
	}
});
