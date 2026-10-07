import Database from 'better-sqlite3';

// ====================================================
// SQL Schema
// NOTE: This must stay compatible with the production database.
//       Never alter existing tables here; only ever add new `if not exists` objects.
// ====================================================
export const SCHEMA = `
create table if not exists users (
	id integer primary key autoincrement,
	passhash text,
	role text not null,
	active integer not null default 0,
	full_name text not null,
	username text unique not null
);

create table if not exists invites (
	token text primary key,
	user_id integer not null,
	expires_at date not null,
	used integer not null default 0,
	foreign key (user_id) references users(id)
);

create table if not exists account_resets (
	token text primary key,
	user_id integer not null,
	used integer not null default 0,
	foreign key (user_id) references users(id)
);

create table if not exists account_disabled (
	user_id integer primary key
);

create table if not exists events (
	id integer primary key autoincrement,
	name text not null,
	start text not null,
	end text not null,
	location text not null,
	sub_limit_date text not null,
	change_limit integer not null,
	type integer not null,
	price text not null,
	description text,
	files text
);

create table if not exists eventnotifies (
	id integer not null,
	notified integer not null default 1,
	foreign key (id) references events(id)
);

create index if not exists idx_event_start on events(start);
create unique index if not exists idx_eventnotifies_id on eventnotifies(id);

create table if not exists responses (
	user_id integer not null,
	event_id integer not null,
	status integer not null,
	count integer not null,
	updated_at timestamp not null,
	primary key (user_id, event_id)
);

create table if not exists fcmtokens (
	id integer primary key autoincrement,
	user_id integer not null,
	token text not null unique,
	platform text,
	created_at integer not null,
	last_seen integer not null,
	disabled integer not null default 0,
	foreign key (user_id) references users(id)
);

create index if not exists idx_fcmtokens_user on fcmtokens(user_id);
create index if not exists idx_fcmtokens_last_seen on fcmtokens(last_seen);

create table if not exists payments (
	id integer primary key autoincrement,
	order_id text not null unique,
	transaction_id text,
	status text not null,
	amount text not null,
	payer text,
	currency text not null default 'EUR',
	description text,
	event_id integer not null,
	user_id integer not null,
	created_at integer not null,
	payed_at integer,
	foreign key (event_id) references events(id),
	foreign key (user_id) references users(id)
);

create index if not exists idx_payments_order on payments(order_id);

create table if not exists files (
	id integer primary key autoincrement,
	filename text not null,
	internal_filename text not null,
	handle text not null,
	path text not null,
	size integer not null,
	mime_type text,
	uploaded_at datetime default CURRENT_TIMESTAMP
);
`;

export function openDb(path, options = {}) {
	const db = new Database(path, options);
	if (!options.readonly) {
		db.exec(SCHEMA);
	}
	return db;
}

const EVENT_COLUMNS = 'name, start, end, location, sub_limit_date, change_limit, type, price, description, files';

// All SQL lives here so routes and services stay free of queries.
export function createRepo(db) {
	const q = (sql) => db.prepare(sql);

	return {
		db,
		transaction: (fn) => db.transaction(fn)(),

		// ---------- Users ----------
		users: {
			byId: (id) => q('select * from users where id = ?').get(id),
			byUsername: (username) => q('select * from users where username = ?').get(username),
			list: () =>
				q(`
					select u.id, u.username, u.full_name, u.role, u.active, ad.user_id is not null as is_disabled
					from users as u left join account_disabled as ad on u.id = ad.user_id
					order by u.full_name collate nocase
				`).all(),
			create: ({ username, full_name, role }) =>
				Number(
					q('insert into users (username, full_name, role, active) values (?, ?, ?, 0)').run(
						username,
						full_name,
						role
					).lastInsertRowid
				),
			remove: (id) => q('delete from users where id = ?').run(id),
			setRole: (id, role) => q('update users set role = ? where id = ?').run(role, id),
			setPassword: (id, passhash) => q('update users set passhash = ? where id = ?').run(passhash, id),
			activate: (id, passhash) => q('update users set passhash = ?, active = 1 where id = ?').run(passhash, id),
			isDisabled: (id) => !!q('select 1 from account_disabled where user_id = ?').get(id),
			setDisabled: (id, disabled) =>
				disabled
					? q('insert or ignore into account_disabled (user_id) values (?)').run(id)
					: q('delete from account_disabled where user_id = ?').run(id),
			idsByRole: (role) =>
				q('select id from users where role = ?')
					.all(role)
					.map((r) => r.id)
		},

		// ---------- Invites ----------
		invites: {
			create: (token, userId, expiresAt) =>
				q('insert into invites (token, user_id, expires_at, used) values (?, ?, ?, 0)').run(
					token,
					userId,
					expiresAt
				),
			list: () =>
				q(`
					select i.token, i.user_id, i.expires_at, i.used, u.username, u.full_name, u.role, u.active
					from invites i join users u on i.user_id = u.id
					order by i.expires_at desc
				`).all(),
			byToken: (token) =>
				q(`
					select i.token, i.user_id, i.expires_at, i.used, u.username, u.active
					from invites i join users u on u.id = i.user_id
					where i.token = ?
				`).get(token),
			markUsed: (token) => q('update invites set used = 1 where token = ?').run(token),
			remove: (token) => q('delete from invites where token = ?').run(token)
		},

		// ---------- Password resets ----------
		resets: {
			openForUser: (userId) => q('select token from account_resets where user_id = ? and used = 0').get(userId),
			create: (token, userId) =>
				q('insert into account_resets (token, user_id, used) values (?, ?, 0)').run(token, userId),
			byToken: (token) =>
				q(`
					select r.token, r.user_id, r.used, u.username
					from account_resets r join users u on u.id = r.user_id
					where r.token = ?
				`).get(token),
			markUsed: (token) => q('update account_resets set used = 1 where token = ?').run(token)
		},

		// ---------- Events ----------
		events: {
			byId: (id) => q('select * from events where id = ?').get(id),
			list: ({ types, upcoming = false, limit = -1 }) => {
				const placeholders = types.map(() => '?').join(', ');
				const upcomingClause = upcoming ? " and start >= date('now')" : '';
				return q(
					`select * from events where type in (${placeholders})${upcomingClause} order by start asc limit ?`
				).all(...types, limit);
			},
			create: (e) =>
				Number(
					q(`insert into events (${EVENT_COLUMNS}) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
						e.name,
						e.start,
						e.end,
						e.location,
						e.sub_limit_date,
						e.change_limit,
						e.type,
						e.price,
						e.description,
						e.files
					).lastInsertRowid
				),
			update: (id, e) =>
				q(`
					update events set
					name = ?, start = ?, end = ?, location = ?, sub_limit_date = ?, change_limit = ?, type = ?, price = ?, description = ?, files = ?
					where id = ?
				`).run(
					e.name,
					e.start,
					e.end,
					e.location,
					e.sub_limit_date,
					e.change_limit,
					e.type,
					e.price,
					e.description,
					e.files,
					id
				),
			upcomingOfType: (type, today) =>
				q('select * from events where type = ? and end >= ? order by start asc').all(type, today),
			hasPayments: (id) => !!q('select 1 from payments where event_id = ?').get(id),
			// better-sqlite3 enforces foreign keys: drop rows referencing the event first
			remove: (id) => {
				q('delete from eventnotifies where id = ?').run(id);
				q('delete from responses where event_id = ?').run(id);
				q('delete from events where id = ?').run(id);
			}
		},

		// ---------- Responses ----------
		responses: {
			statusByEvent: (userId) =>
				new Map(
					q('select event_id, status from responses where user_id = ?')
						.all(userId)
						.map((r) => [r.event_id, r.status])
				),
			get: (userId, eventId) =>
				q('select status, count from responses where user_id = ? and event_id = ?').get(userId, eventId),
			upsert: (userId, eventId, status) =>
				q(`
					insert into responses (user_id, event_id, status, count, updated_at)
					values (?, ?, ?, 1, CURRENT_TIMESTAMP)
					on conflict do update set status = excluded.status, count = count + 1, updated_at = CURRENT_TIMESTAMP
				`).run(userId, eventId, status),
			byStatus: (eventId) =>
				q(`
					select u.full_name, u.username, r.status from responses r join users u on u.id = r.user_id
					where r.event_id = ? order by u.full_name collate nocase
				`).all(eventId),
			// Active, enabled users (optionally restricted to roles) who have not answered
			missing: (eventId, roles) => {
				const roleClause = roles ? ` and u.role in (${roles.map(() => '?').join(', ')})` : '';
				return q(`
					select u.full_name, u.username from users u
					left join responses r on u.id = r.user_id and r.event_id = ?
					left join account_disabled ad on ad.user_id = u.id
					where r.user_id is null and u.active = 1 and ad.user_id is null${roleClause}
					order by u.full_name collate nocase
				`).all(eventId, ...(roles ?? []));
			}
		},

		// ---------- Payments ----------
		payments: {
			completed: (eventId, userId) =>
				q("select * from payments where event_id = ? and user_id = ? and status = 'COMPLETED'").get(
					eventId,
					userId
				),
			byOrder: (orderId) => q('select * from payments where order_id = ?').get(orderId),
			create: ({ orderId, amount, eventId, userId, now }) =>
				q(`
					insert into payments (order_id, status, amount, created_at, description, event_id, user_id)
					values (?, 'PENDING', ?, ?, 'User event payment.', ?, ?)
				`).run(orderId, amount, now, eventId, userId),
			expire: (orderId) => q("update payments set status = 'EXPIRED' where order_id = ?").run(orderId),
			capture: ({ orderId, transactionId, status, payer, payedAt }) =>
				q(`
					update payments set transaction_id = ?, status = ?, payer = ?, payed_at = ?
					where order_id = ?
				`).run(transactionId, status, payer, payedAt, orderId),
			expireStale: (cutoff) =>
				q("update payments set status = 'EXPIRED' where status = 'PENDING' and created_at < ?").run(cutoff)
		},

		// ---------- FCM tokens ----------
		fcm: {
			upsert: ({ userId, token, platform, now }) =>
				q(`
					insert into fcmtokens (user_id, token, platform, created_at, last_seen, disabled)
					values (@userId, @token, @platform, @now, @now, 0)
					on conflict do update set
						user_id = excluded.user_id,
						platform = excluded.platform,
						last_seen = excluded.last_seen,
						disabled = 0
				`).run({ userId, token, platform, now }),
			disableForUser: (userId, token) =>
				q('update fcmtokens set disabled = 1 where user_id = ? and token = ?').run(userId, token),
			disable: (token) => q('update fcmtokens set disabled = 1 where token = ?').run(token),
			activeForUser: (userId) =>
				q('select token from fcmtokens where user_id = ? and disabled = 0 order by last_seen desc')
					.all(userId)
					.map((r) => r.token),
			deleteStale: (cutoff) => q('delete from fcmtokens where last_seen < ?').run(cutoff).changes
		},

		// ---------- Files ----------
		files: {
			create: (f) =>
				q(`
					insert into files (filename, internal_filename, handle, path, size, mime_type)
					values (?, ?, ?, ?, ?, ?)
				`).run(f.filename, f.internalFilename, f.handle, f.path, f.size, f.mimeType),
			byHandle: (handle) => q('select * from files where handle = ?').get(handle),
			remove: (handle) => q('delete from files where handle = ?').run(handle)
		},

		// ---------- Statistics (read only) ----------
		stats: {
			eventsBetween: (from, to) =>
				q('select id, name, start, end, type from events where start between ? and ? order by start asc').all(
					from,
					to
				),
			// `first_invite_expiry` approximates when the account was created
			athletes: () =>
				q(`
					select u.id, u.full_name, u.username, u.role, u.active,
						ad.user_id is not null as disabled,
						(select min(i.expires_at) from invites i where i.user_id = u.id) as first_invite_expiry
					from users u left join account_disabled ad on ad.user_id = u.id
					order by u.full_name collate nocase
				`).all(),
			responsesBetween: (from, to) =>
				q(`
					select r.user_id, r.event_id, r.status, r.updated_at
					from responses r join events e on e.id = r.event_id
					where e.start between ? and ?
				`).all(from, to)
		},

		// ---------- Scheduler ----------
		schedule: {
			// (event, user) pairs with a response whose event has not been notified yet
			unnotifiedResponses: () =>
				q(`
					select r.event_id as eid, r.user_id as uid, r.status, e.name as name, e.start as start
					from responses r
					join events e on e.id = r.event_id
					left join eventnotifies n on n.id = e.id
					where n.id is null
				`).all(),
			markNotified: (eventId) => q('insert or ignore into eventnotifies (id) values (?)').run(eventId),
			// (event, user) pairs without a response
			missingResponses: () =>
				q(`
					select e.id as eid, e.name, e.type, e.sub_limit_date, u.id as uid, u.full_name, u.role
					from events e cross join users u
					left join responses r on r.user_id = u.id and r.event_id = e.id
					where r.user_id is null
				`).all()
		}
	};
}
