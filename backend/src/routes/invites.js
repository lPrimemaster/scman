import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { badRequest, notFound } from '../lib/errors.js';

export const INVITE_TTL_MS = 5 * 24 * 60 * 60 * 1000; // 5 days
export const BCRYPT_ROUNDS = 10;

export const newToken = () => randomBytes(32).toString('hex');
export const inviteLink = (token) => `/activate?token=${token}`;
export const resetLink = (token) => `/reset_password?token=${token}`;

const tokenParams = {
	type: 'object',
	required: ['token'],
	properties: { token: { type: 'string', minLength: 1 } }
};

const passwordBody = {
	type: 'object',
	required: ['password'],
	properties: { password: { type: 'string', minLength: 6 } }
};

// Account invites (activation) and password resets
export default async function inviteRoutes(app, { ctx }) {
	const { repo, push, now, authenticate, requireRole } = ctx;
	const admin = { preHandler: [authenticate, requireRole('admin')] };

	// ---------- Invites ----------
	app.get('/invites', admin, async () =>
		repo.invites.list().map((i) => ({
			token: i.token,
			link: inviteLink(i.token),
			username: i.username,
			full_name: i.full_name,
			role: i.role,
			expires_at: i.expires_at,
			status: i.used ? 'active' : i.expires_at < now() ? 'expired' : 'pending'
		}))
	);

	app.delete('/invites/:token', { ...admin, schema: { params: tokenParams } }, async (req) => {
		const invite = repo.invites.byToken(req.params.token);
		if (!invite) throw notFound('Invalid token.');

		repo.transaction(() => {
			repo.invites.remove(invite.token);
			// The account was never activated, remove it too
			if (!invite.used && !invite.active) {
				repo.users.remove(invite.user_id);
			}
		});
		return { ok: true };
	});

	app.get('/invites/:token', { schema: { params: tokenParams } }, async (req) => {
		const invite = repo.invites.byToken(req.params.token);
		if (!invite) return { valid: false, reason: 'invalid_token' };
		if (invite.used) return { valid: false, reason: 'used_token' };
		if (invite.expires_at < now()) return { valid: false, reason: 'expired_token' };
		return { valid: true, username: invite.username };
	});

	app.post('/invites/:token/activate', { schema: { params: tokenParams, body: passwordBody } }, async (req) => {
		const invite = repo.invites.byToken(req.params.token);
		if (!invite || invite.used || invite.expires_at < now()) {
			throw badRequest('Invalid or expired link.');
		}

		const hash = await bcrypt.hash(req.body.password, BCRYPT_ROUNDS);
		repo.transaction(() => {
			repo.users.activate(invite.user_id, hash);
			repo.invites.markUsed(invite.token);
		});

		const { full_name } = repo.users.byId(invite.user_id);
		push.notifyRole('admin', { title: 'Novo utilizador registado.', body: `${full_name}` });

		return { ok: true, username: invite.username };
	});

	// ---------- Password resets ----------
	app.get('/resets/:token', { schema: { params: tokenParams } }, async (req) => {
		const reset = repo.resets.byToken(req.params.token);
		if (!reset) return { valid: false, reason: 'invalid_token' };
		if (reset.used) return { valid: false, reason: 'used_token' };
		return { valid: true, username: reset.username };
	});

	app.post('/resets/:token', { schema: { params: tokenParams, body: passwordBody } }, async (req) => {
		const reset = repo.resets.byToken(req.params.token);
		if (!reset || reset.used) throw badRequest('Invalid link.');

		const hash = await bcrypt.hash(req.body.password, BCRYPT_ROUNDS);
		repo.transaction(() => {
			repo.users.setPassword(reset.user_id, hash);
			repo.resets.markUsed(reset.token);
		});

		return { ok: true, username: reset.username };
	});
}
