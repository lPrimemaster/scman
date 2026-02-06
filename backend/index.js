import Fastify from "fastify";
import Database from "better-sqlite3";
import cors from "@fastify/cors";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import admin from 'firebase-admin';
import fs from 'node:fs';
import cron from 'node-cron';
import 'dotenv/config';

const app = Fastify();

// Database
let DB_PATH = process.env.DB_PATH || 'database.db';
const db = new Database(DB_PATH);

// Auth
const SECRET = process.env.JWT_SECRET || 'dev-secret';

// Port
const PORT = process.env.PORT || 4200;

// Firebase
admin.initializeApp({
	credential: admin.credential.cert(JSON.parse(fs.readFileSync('serviceAccountKey.json')))
});

// Paypal
const PAYPAL_BASE = process.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
const PAYPAL_EXPIRE_DELTA = 5 * 60 * 1000;

console.log('Setting environment:');
console.log(`DB_PATH: ${DB_PATH}`);
console.log(`SECRET_PROD: ${SECRET !== 'dev-secret'}`);
console.log(`PORT: ${PORT}`);

// ====================================================
// SQL Schema setup
// ====================================================
db.exec(`
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
	description text
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
`);
// ====================================================

// Setup Paypal
async function getPaypalAccessToken() {
	const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');

	const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
		method: 'POST',
		headers: {
			Authorization: `Basic ${auth}`,
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: 'grant_type=client_credentials'
	});

	if(!res.ok) {
		const text = await res.text();
		console.log(`Paypal access token error: [${res.status}] ${text}`);
		return null;
	}

	const data = await res.json();
	return data.access_token;
}

// Setup notifications from fcm
async function sendNotification(user_id, { title, body, data }) {
	const getUserTokens = db.prepare('select token from fcmtokens where user_id = ? and disabled = 0 order by last_seen desc');
	const disableToken = db.prepare('update fcmtokens set disabled = 1 where token = ?');

	const tokens = getUserTokens.all(user_id).map(r => r.token);

	if(tokens.length === 0) {
		return { ok: true, sent: 0 };
	}

	const chunks = [];
	for(let i = 0; i < tokens.length; i += 500) chunks.push(tokens.slice(i, i + 500));

	let sent = 0;
	let failed = 0;

	for(const chunk of chunks) {
		const message = {
			tokens: chunk,
			notification: { title, body },
			data: data ?? {}
		};

		const resp = await admin.messaging().sendEachForMulticast(message);

		sent += resp.successCount;
		failed += resp.failureCount;

		// Disable failed tokens (expired)
		resp.responses.forEach((r, i) => {
			if(!r.success) {
				const code = r.error?.code || '';
				if(
					code.includes('registration-token-not-registered') ||
					code.includes('invalid-argument') ||
					code.includes('unregistered')
				) {
					disableToken.run(chunk[i]);
				}
			}
		});
	}

	return { ok: failed === 0, sent, failed };
}

async function sendNotificationToRole(role, { title, body, data }) {
	const users = db.prepare('select id from users where role = ?').all(role);
	for(const user of users) {
		sendNotification(user.id, { title, body, data });
	}
}

async function sendNotificationToAll({ title, body, data }) {
	const users = db.prepare('select id from users').all();
	for(const user of users) {
		sendNotification(user.id, { title, body, data });
	}
}

function cleanupStaleFCMTokens() {
	const STALE_MS_TS = 1000 * 60 * 60 * 24 * 30; // 30 days
	const cutoff = Date.now() - STALE_MS_TS;
	const result = db.prepare('delete from fcmtokens where last_seen < ?').run(cutoff);

	console.log(`[FCM] Cleanup: Removed ${result.changes} tokens.`);
}

function notifyEvent1Day() {
	// Check for upcoming events
	const now = new Date();
	now.setHours(0, 0, 0, 0);
	const oneDayNotify = 86400000;

	const uEvents = db.prepare(`
		select r.event_id as eid, r.user_id as uid, e.name as name, e.start as start
		from responses r
		join events e on e.id = r.event_id
		left join eventnotifies n on n.id = e.id
		where 
			n.id is null
	`).all();

	const events = uEvents.map((x) => {
		const e_start = new Date(x.start);
		const daysToGo = (e_start - now) / oneDayNotify;
		return {
			...x,
			daysToGo
		};
	});

	for(const eu_pair of events) {
		if(eu_pair.daysToGo == 1) {
			console.log(`[cron] Notifying user ${eu_pair.uid} for event ${eu_pair.name}.`);

			sendNotification(eu_pair.uid, {
				title: 'Falta 1 dia para um evento em que estás inscrito!',
				body: `${eu_pair.name}`
			});
		}

		if(eu_pair.daysToGo <= 1) {
			// Insert this event into already notified table
			db.prepare('insert or ignore into eventnotifies (id) values (?)').run(eu_pair.eid);
		}
	}
}

function notifyEvent1DayResponse() {
	// Check for upcoming events
	const now = new Date();
	now.setHours(0, 0, 0, 0);
	const oneDayNotify = 86400000;

	const uEvents = db.prepare(`
		select v.*, r.status, r.user_id, r.event_id
		from (select e.id as eid, e.name, e.type as etype, e.sub_limit_date as sld, u.full_name, u.role, u.id as uid from events e left join users u) v
		left join responses r
			on r.user_id = uid
			and r.event_id = eid
		where r.user_id is null
	`).all();

	const events = uEvents.map((x) => {
		const e_sublim = new Date(x.sld);
		const daysToGo = (e_sublim - now) / oneDayNotify;
		const notifyValid = !((x.etype > 1) && (x.role == 'cpt'));
		return {
			...x,
			daysToGo,
			notifyValid
		};
	}).filter((x) => x.notifyValid && (x.daysToGo >= 0)).map((x) => {
		return {
			ename: x.name,
			uname: x.full_name,
			uid: x.uid,
			daysToGo: x.daysToGo
		};
	});

	for(const eu_pair of events) {
		if(eu_pair.daysToGo <= 7) {
			console.log(`[cron] Notifying user ${eu_pair.uname} for event ${eu_pair.ename} response date limit.`);

			let title = '';
			if(eu_pair.daysToGo > 0) {
				title = `Faltam ${eu_pair.daysToGo} dia(s) para o limite de inscrição do evento!`;
			} else {
				title = 'É hoje a data limite para inscrição do evento!';
			}

			sendNotification(eu_pair.uid, {
				title,
				body: `${eu_pair.ename}`
			});
		}
	}
}

function flagExpiredPayments() {
	db.prepare(`
		update payments
		set
			status = 'EXPIRED'
		where
			status = 'PENDING'
			and created_at < ?
	`).run(Date.now() - PAYPAL_EXPIRE_DELTA);
}

// ====================================================
// CRON and on restart events
// ====================================================

// Cleanup fcm tokens every day at 12:00AM and on restart
cleanupStaleFCMTokens();
cron.schedule('0 0 * * *', cleanupStaleFCMTokens, { timezone: 'UTC' });

// Setup notifications event trigger every day at 10:00AM
cron.schedule('0 10 * * *', notifyEvent1Day, { timezone: 'UTC' });

// Setup notifications event sub date trigger every day at 10:00AM
cron.schedule('0 10 * * *', notifyEvent1DayResponse, { timezone: 'UTC' });

// Expire pending payments every hour and on restart
flagExpiredPayments();
cron.schedule('0 * * * *', flagExpiredPayments);

// ====================================================
// ====================================================

function signJWT(user) {
	return jwt.sign(
		{
			id: user.id,
			role: user.role
		},
		SECRET,
		{ expiresIn: '7d' }
	);
}

function verifyJWT(token) {
	return jwt.verify(token, SECRET);
}

function parseDateFormatToEpoch(date) {
	const [d, m, y] = date.split('/').map(Number);
	return (new Date(y, m-1, d)).getTime();
}

app.decorate('auth', async (req, res) => {
	const h = req.headers.authorization;

	if(!h) return res.code(401).send();

	try {
		const token = h.split(" ")[1];
		req.user = verifyJWT(token);
	} catch {
		return res.code(401).send();
	}
});

function requireAdmin(req, res, next) {
	if(req.user.role !== 'admin') {
		return res.code(403).send();
	}
	next();
}

function requireFed(req, res, next) {
	if(
		req.user.role !== 'admin' ||
		req.user.role !== 'federado'
	) {
		return res.code(403).send();
	}
	next();
}

await app.register(cors, {
  origin: true
});

/* ---------- API ---------- */

// Register
app.post('/api/register', { preHandler: [app.auth, requireAdmin] }, async (req, res) => {
	const {
		username,
		full_name,
		role
	} = req.body;

	let user = undefined;
	try {
		user = db.prepare('insert into users (username, full_name, role, active) values (?, ?, ?, 0)').run(username, full_name, role);
	} catch(err) {
		console.log(err);
		return res.code(400).send({ error: 'Username already exists.' });
	}

	const token = randomBytes(32).toString('hex');
	const expires_at = Date.now() + 5 * (24 * 60 * 60 * 1000); // 5 days expiry

	try {
		db.prepare('insert into invites (token, user_id, expires_at, used) values (?, ?, ?, 0)').run(token, user.lastInsertRowid, expires_at);
	} catch(err) {
		console.log(err);
		return res.code(400).send({ error: 'Failed to generate invite code.' });
	}

	return {
		inviteLink: `/activate?token=${token}`
	};
});

app.post('/api/modify_user', { preHandler: [app.auth, requireAdmin] }, async (req, res) => {
	const body = req.body;

	if(!body || typeof body !== 'object' && body.id === undefined) {
		return res.code(400).send({ error: 'Invalid request.' });
	}

	if(body.role !== undefined) {
		try {
			db.prepare('update users set role = ? where id = ?').run(body.role, body.id);
		} catch(err) {
			console.log(err);
			return res.code(400).send({ error: 'SQL Error.' });
		}
	}

	return { ok: true };
});

// Fetch account links
app.get('/api/activation_links', { preHandler: [app.auth, requireAdmin] }, async (res) => {
	try {
		const links = db.prepare('select * from invites i join users u on i.user_id = u.id').all();
		return links;
	} catch(err) {
		console.log(err);
		return res.code(400).send({ error: 'Failed to fetch activation links.' });
	}
});

// Erase link
app.post('/api/erase_token', { preHandler: [app.auth, requireAdmin ]}, async (req, res) => {
	const {
		token
	} = req.body;

	try {
		const link = db.prepare('select * from invites i join users u on i.user_id = u.id where i.token = ?').get(token);

		db.prepare('delete from invites where token = ?').run(link.token);

		// The account is rogue delete it too
		// The double check should not be required...
		if(!link.used && !link.active) {
			db.prepare('delete from users where id = ?').run(link.user_id);
		}
	} catch(err) {
		console.log(err);
		return res.code(400).send({ error: 'Invalid token.' });
	}

	return { ok: true };
});

// Account activation
app.get('/api/activate', async (req, res) => {
	if(!req.query) {
		return res.code(400).send({ error: 'Invalid parameters.' });
	}
	const token = req.query.token;

	if(!token) {
		return { valid: false, reason: 'no_token' };
	}

	const invite = db.prepare('select i.expires_at, i.used, u.username from invites i join users u on u.id = i.user_id where i.token = ?').get(token);

	if(!invite) {
		return { valid: false, reason: 'invalid_token' };
	} else if(invite.used) {
		return { valid: false, reason: 'used_token' };
	} else if(invite.expires_at < Date.now()) {
		return { valid: false, reason: 'expired_token' };
	}

	return {
		valid: true,
		username: invite.username
	};
});

app.post('/api/activate', async (req, res) => {
	const {
		token,
		password
	} = req.body;

	const invite = db.prepare('select * from invites where token = ? and used = 0').get(token);

	if(!invite || invite.expires_at < Date.now()) {
		return { ok: false, error: 'Invalid or expired link.' };
	}

	const hash = await bcrypt.hash(password, 10);

	try {
		db.prepare('update users set passhash = ?, active = 1 where id = ?').run(hash, invite.user_id);
		db.prepare('update invites set used = 1 where token = ?').run(token);
	} catch(err) {
		console.log(err);
		return { ok: false, error: 'Failed to update user database.' };
	}

	const { full_name } = db.prepare('select full_name from users where id = ?').get(invite.user_id);

	sendNotificationToRole('admin', {
		title: 'Novo utilizador registado.',
		body: `${full_name}`
	});

	return { ok: true };
});

// Login
app.post("/api/login", async (req, res) => {
	const { username, password } = req.body;

	const user = db.prepare('select * from users where username=?').get(username);

	if(!user || !(await bcrypt.compare(password, user.passhash))) {
		return res.code(401).send({ error: 'Invalid credentials.' });
	}

	return {
		token: signJWT(user),
		user: { id: user.id, name: user.username }
	};
})

// token check
app.get('/api/vcheck', { preHandler: app.auth }, () => {
	return { ok: true };
});

// admin token check
app.get('/api/adminvcheck', { preHandler: [app.auth, requireAdmin] }, (req) => {
	return { ok: true };
});

// fetch all competitons
app.get('/api/all_events', { preHandler: app.auth }, (req, res) => {
	if(!req.query) {
		return res.code(400).send({ error: 'Invalid parameters.' });
	}

	try {
		let extra_clause = '';

		if(req.user.role == 'cpt') {
			extra_clause = ' where type = 0 or type = 1';
		}

		const events = db.prepare('select * from events' + extra_clause).all();
		return events;
	} catch(err) {
		console.log(err);
		return res.code(400).send({ error: 'SQL Error.' });
	}
});

// fetch all users
app.get('/api/all_users', { preHandler: [app.auth, requireAdmin] }, (req, res) => {
	if(!req.query) {
		return res.code(400).send({ error: 'Invalid parameters.' });
	}

	try {
		const users = db.prepare('select * from users').all();
		return users;
	} catch(err) {
		console.log(err);
		return res.code(400).send({ error: 'SQL Error.' });
	}
});

app.post('/api/erase_event', { preHandler: [app.auth, requireAdmin] }, (req, res) => {
	const {
		id
	} = req.body;

	try {
		db.prepare('delete from events where id = ?').run(id);
		return { ok: true };
	} catch(err) {
		console.log(err);
		return res.code(400).send({ error: 'SQL Error.' });
	}
});

// fetch next competitons
app.get('/api/upcoming', { preHandler: app.auth }, (req, res) => {
	if(!req.query) {
		return res.code(400).send({ error: 'Invalid parameters.' });
	}
	const { n, t } = req.query;
	const count = Number(n);
	const type = Number(t);

	// type
	// 0 - Prova CPT
	// 1 - Estágio/Evento Aberto
	// 2 - Prova FED
	// 3 - Estágio Fechado

	if((req.user.role !== 'federado' && req.user.role !== 'admin') && type != 0 && type != 1) {
		return res.code(400).send({ error: 'Invalid parameters.' });
	}

	if(type < 0 && type > 3) {
		return res.code(400).send({ error: 'Invalid parameters.' });
	}

	const events = db.prepare('select * from events where type=? and (start >= date(\'now\')) order by start asc limit ?').all(type, count);
	return events;
});

app.get('/api/sign_limit_reached', { preHandler: app.auth }, (req, res) => {
	if(!req.query) {
		return res.code(400).send({ error: 'Invalid parameters.' });
	}
	const { id } = req.query;
	const eid = Number(id);

	const q1 = db.prepare('select count from responses where user_id = ? and event_id = ?').get(req.user.id, eid);
	const { change_limit } = db.prepare('select change_limit from events where id = ?').get(eid);

	if(q1 !== undefined && q1.count > change_limit) {
		return { status: true };
	}
	return { status: false };
});

app.post('/api/sign_evt', { preHandler: app.auth }, (req, res) => {
	const { event_id, status } = req.body;

	try {
		// Block events 2 and 3 from CPT users
		if(req.user.role === 'cpt') {
			const { type } = db.prepare('select type from events where id = ?').get(event_id);
			if(type === undefined) {
				return res.code(400).send({ error: 'SQL Error.' });
			} else if(type == 2 || type == 3) {
				return res.code(400).send({ error: 'Insufficient permissions to sign the specified event.' });
			}
		}

		// Block sign changes if event is already payed
		const pstatus = db.prepare('select status from payments where event_id = ? and user_id = ?').get(event_id, req.user.id);
		if(pstatus !== undefined && pstatus.status === 'COMPLETED') {
			return res.code(400).send({ error: 'Cannot change signature. Event is already payed for.' });
		}

		let limit_reached = false;
		const q1 = db.prepare('select count from responses where user_id = ? and event_id = ?').get(req.user.id, event_id);
		const { change_limit, sub_limit_date } = db.prepare('select change_limit, sub_limit_date from events where id = ?').get(event_id);
		const limit_date = parseDateFormatToEpoch(sub_limit_date);
		const oneDayMs = 86400000;
		if((q1 !== undefined && q1.count > change_limit) || limit_date + oneDayMs < Date.now()) {
			return res.code(400).send({ error: 'Cannot change signature. Limit reached.' });
		} else if(q1 !== undefined && q1.count > (change_limit - 1)) {
			limit_reached = true;
		}
		try {
			db.prepare(
				'insert into responses (user_id, event_id, status, count, updated_at) values (?, ?, ?, 1, CURRENT_TIMESTAMP) on conflict do update set status = excluded.status, count = count + 1, updated_at = CURRENT_TIMESTAMP'
			).run(req.user.id, event_id, status);

			const { full_name } = db.prepare('select full_name from users where id = ?').get(req.user.id);
			const { name } = db.prepare('select name from events where id = ?').get(event_id);

			const status_name = (status === 0) ? 'Não vou' : ((status === 1) ? 'Vou' : 'Talvez');

			sendNotificationToRole('admin', {
				title: 'Nova inscrição',
				body: `${full_name} alterou o seu estado no evento ${name} para "${status_name}"`
			});

			return { ok: true, limit_reached };
		} catch(err) {
			console.log(err);
			return res.code(400).send({ error: 'Username already exists.' });
		}
	} catch(err) {
		console.log(err);
		return res.code(400).send({ error: 'SQL Error.' });
	}
});

app.get('/api/attendance', { preHandler: app.auth }, (req, res) => {
	if(!req.query) {
		return res.code(400).send({ error: 'Invalid parameters.' });
	}
	const { event } = req.query;
	const event_id = Number(event);
	try {
		const evres = db.prepare('select type from events where id = ?').get(event_id);
		let response_clause = '';

		if(evres.type > 1) {
			response_clause = " and (u.role = 'federado' or u.role = 'admin')";
			if(req.user.role !== 'admin' && req.user.role !== 'federado') {
				return res.code(400).send({ error: 'No Permission.' });
			}
		}

		const ng = db.prepare('select u.full_name from responses r join users u on u.id = r.user_id where r.event_id = ? and r.status = 0').all(event_id);
		const go = db.prepare('select u.full_name from responses r join users u on u.id = r.user_id where r.event_id = ? and r.status = 1').all(event_id);
		const mb = db.prepare('select u.full_name from responses r join users u on u.id = r.user_id where r.event_id = ? and r.status = 2').all(event_id);
		const na = db.prepare('select u.full_name from users u left join responses r on u.id = r.user_id and r.event_id = ? where r.user_id is null' + response_clause).all(event_id);

		const ustatus = db.prepare('select status from responses where user_id = ? and event_id = ?').get(req.user.id, event_id);
		let self = -1; // No response yet

		if(ustatus !== undefined) {
			self = ustatus.status;
		}

		return {
			not_going: ng,
			going: go,
			maybe: mb,
			noanswer: na,
			self: self
		};

	} catch(err) {
		console.log(err);
		return res.code(400).send({ error: 'SQL Error.' });
	}
});

app.post('/api/new_event', { preHandler: [app.auth, requireAdmin] }, (req, res) => {
	const {
		name,
		location,
		start,
		end,
		limit,
		maxalt,
		type,
		price,
		description
	} = req.body;

	try {
		db.prepare('insert into events (name, start, end, location, sub_limit_date, change_limit, type, price, description) values (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
			name,
			start,
			end,
			location,
			limit,
			maxalt,
			type,
			price,
			description
		);

		const message = {
			title: 'Novo evento adicionado.',
			body: name
		};

		// CPT
		if(Number(type) < 2) {
			sendNotificationToRole('cpt', message);
		}

		sendNotificationToRole('federado', message);
		sendNotificationToRole('admin', message);

		return { ok: true };
	} catch(err) {
		console.log(err);
		return res.code(400).send({ error: 'SQL Error.' });
	}
});

app.post("/api/fcm/register", { preHandler: [app.auth] }, (req, res) => {
	const upsert = db.prepare(`
		insert into fcmtokens (user_id, token, platform, created_at, last_seen, disabled)
		values (@user_id, @token, @platform, @now, @now, 0)
		on conflict do update set
			user_id=excluded.user_id,
			platform=excluded.platform,
			last_seen=excluded.last_seen,
			disabled=0
	`);

	const {
		token,
		platform
	} = req.body;

	if(typeof token !== 'string' || token.length < 20) {
		return res.status(400).send({ error: 'Invalid FCM token format.' });
	}

	try {
		upsert.run({
			user_id: req.user.id,
			token: token,
			platform: platform ?? null,
			now: Date.now()
		});
		return { ok: true };
	} catch(err) {
		console.log(err);
		return res.code(400).send({ error: 'SQL Error.' });
	}
});

app.post("/api/fcm/unregister", { preHandler: [app.auth] }, (req, res) => {
	const disableToken = db.prepare('update fcmtokens set disabled = 1 where user_id = ? and token = ?');
	const { token } = req.body;
	try {
		disableToken.run(req.user.id, token);
		return { ok: true };
	} catch(err) {
		console.log(err);
		return res.code(400).send({ error: 'SQL Error.' });
	}
});

// Paypal endpoints
app.post("/api/paypal/order", { preHandler: [app.auth] }, async (req, res) => {
	try {
		const { event } = req.body;

		const ppToken = await getPaypalAccessToken();

		const payment = db.prepare(`select * from payments where event_id = ? and user_id = ? and status = 'COMPLETED'`).get(event, req.user.id);
		const { price } = db.prepare(`select price from events where id = ?`).get(event);

		if(price === undefined) {
			// Event does not exist
			return res.code(400).send({ error: 'Invalid event.' });
		} else if(Number(price) === 0) {
			// Event is not payable
			return res.code(400).send({ error: 'Event not payable.' });
		}

		if(payment && payment.status == 'COMPLETED') {
			// User already paid
			// cancel
			return res.code(400).send({ error: 'Already paid.' });
		}

		const ammount = price;
		const order = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${ppToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				intent: 'CAPTURE',
				purchase_units: [{
					amount: {
						currency_code: 'EUR',
						value: ammount
					}
				}]
			})
		});

		const data = await order.json();
		if(!order.ok) {
			return res.code(order.status).send(data);
		}

		// All is ok, create the payment entry
		db.prepare(`
			insert into payments (order_id, status, amount, created_at, description, event_id, user_id)
			values (?, 'PENDING', ?, ?, 'User event payment.', ?, ?)
		`).run(data.id, ammount, Date.now(), event, req.user.id);

		return { orderId: data.id };
	} catch (err) {
		console.log(err);
		return res.code(400).send({ error: 'SQL Error.' });
	}
});

function extractPaypalCaptureInfo(data) {
	return {
		capId: data?.purchase_units?.[0]?.payments?.captures?.[0].id,
		orderId: data.id,
		payerId: data?.payer?.payer_id ?? null,
		status: data.status
	};
}

app.post("/api/paypal/capture", { preHandler: [app.auth] }, async (req, res) => {
	const { orderId } = req.body;
	if(!orderId) return res.code(400).send({ error: 'Missing order id.' });

	const ppToken = await getPaypalAccessToken();

	// Check if the order expired. If so refuse the capture
	const { created_at, status, event_id } = db.prepare('select created_at, status, event_id from payments where order_id = ?').get(orderId);

	if(status === 'EXPIRED' || created_at + PAYPAL_EXPIRE_DELTA < Date.now()) {
		try {
			db.prepare(`
				update payments
				set
					status = ?,
				where order_id = ?
			`).run('EXPIRED', orderId);
		} catch (err) {
			console.log(err);
			return res.code(400).send({ error: 'SQL Error.' });
		}

		return res.code(409).send({ error: 'Expired.' });
	}

	const capture = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${ppToken}`,
			'Content-Type': 'application/json'
		}
	});

	const data = await capture.json();
	if(!capture.ok) {
		return res.code(capture.status).send(data);
	}

	const ppInfo = extractPaypalCaptureInfo(data);
	const payed_at = (ppInfo.status === 'COMPLETED') ? Date.now() : null;

	try {
		db.prepare(`
			update payments
			set
				transaction_id = ?,
				status = ?,
				payer = ?,
				payed_at = ?
			where order_id = ?
		`).run(ppInfo.capId, ppInfo.status, ppInfo.payerId, payed_at, ppInfo.orderId);
	} catch (err) {
		console.log(err);
		return res.code(400).send({ error: 'SQL Error.' });
	}

	const { full_name } = db.prepare('select full_name from users where id = ?').get(req.user.id);
	const { name } = db.prepare('select name from events where id = ?').get(event_id);

	if(ppInfo.status === 'COMPLETED') {
		sendNotificationToRole('admin', {
			title: 'Pagamento efetuado.',
			body: `${full_name} pagou o evento "${name}"`
		});
	}

	return res.send(data);
});

app.get('/api/payment_status', { preHandler: [app.auth] }, async (req, res) => {
	const event_id = req.query.event_id;
	const user_id = req.user.id;

	const payment = db.prepare(`
		select * from payments where event_id = ? and user_id = ? and status = 'COMPLETED'
	`).get(event_id, user_id);

	const event = db.prepare(`
		select price from events where id = ?
	`).get(event_id);

	if(payment && payment.status && event && event.price) {
		return { status: Number(event.price) == 0 ? 'FREE' : payment.status };
	}
	return { status: 'UNPAID' };
});

app.listen({ port: PORT });
console.log('Service running!');
