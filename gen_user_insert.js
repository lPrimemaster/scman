
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

return { ok: true };
