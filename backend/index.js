import Fastify from "fastify";
import Database from "better-sqlite3";
import cors from "@fastify/cors";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

const app = Fastify();

// Database
let DB_PATH = process.env.DB_PATH || 'database.db';
const db = new Database(DB_PATH);

// Auth
const SECRET = process.env.JWT_SECRET || 'dev-secret';

// Port
const PORT = process.env.PORT || 4200;

console.log('Setting environment:');
console.log(`DB_PATH: ${DB_PATH}`);
console.log(`SECRET_PROD: ${SECRET !== 'dev-secret'}`);
console.log(`PORT: ${PORT}`);

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
	description text
);

create table if not exists responses (
	user_id integer not null,
	event_id integer not null,
	status integer not null,
	count integer not null,
	updated_at timestamp not null,
	primary key (user_id, event_id)
);
`);

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
		const events = db.prepare('select * from events').all();
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

	if(req.user.role !== 'federado' && type != 0 && type != 1) {
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
		let limit_reached = false;
		const q1 = db.prepare('select count from responses where user_id = ? and event_id = ?').get(req.user.id, event_id);
		const { change_limit } = db.prepare('select change_limit from events where id = ?').get(event_id);
		if(q1 !== undefined && q1.count > change_limit) {
			console.log(q1.count);
			return res.code(400).send({ error: 'Cannot change signature. Limit reached.' });
		} else if(q1 !== undefined && q1.count > (change_limit - 1)) {
			limit_reached = true;
		}
		try {
			db.prepare(
				'insert into responses (user_id, event_id, status, count, updated_at) values (?, ?, ?, 1, CURRENT_TIMESTAMP) on conflict do update set status = excluded.status, count = count + 1, updated_at = CURRENT_TIMESTAMP'
			).run(req.user.id, event_id, status);
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
		const ng = db.prepare('select u.full_name from responses r join users u on u.id = r.user_id where r.event_id = ? and r.status = 0').all(event_id);
		const go = db.prepare('select u.full_name from responses r join users u on u.id = r.user_id where r.event_id = ? and r.status = 1').all(event_id);
		const mb = db.prepare('select u.full_name from responses r join users u on u.id = r.user_id where r.event_id = ? and r.status = 2').all(event_id);
		const na = db.prepare('select u.full_name from users u left join responses r on u.id = r.user_id and r.event_id = ? where r.user_id is null').all(event_id);

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
		description
	} = req.body;

	try {
		db.prepare('insert into events (name, start, end, location, sub_limit_date, change_limit, type, description) values (?, ?, ?, ?, ?, ?, ?, ?)').run(
			name,
			start,
			end,
			location,
			limit,
			maxalt,
			type,
			description
		);

		return { ok: true };
	} catch(err) {
		console.log(err);
		return res.code(400).send({ error: 'SQL Error.' });
	}
});

app.listen({ port: PORT });
console.log('Service running!');
