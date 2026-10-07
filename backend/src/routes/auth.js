import bcrypt from 'bcrypt';
import { signToken } from '../plugins/auth.js';
import { badRequest } from '../lib/errors.js';
import { BCRYPT_ROUNDS } from './invites.js';

export default async function authRoutes(app, { ctx }) {
	const { repo, secret, authenticate } = ctx;

	app.post(
		'/login',
		{
			schema: {
				body: {
					type: 'object',
					required: ['username', 'password'],
					properties: { username: { type: 'string' }, password: { type: 'string' } }
				}
			}
		},
		async (req, reply) => {
			const { username, password } = req.body;
			const user = repo.users.byUsername(username.trim());

			// Accounts that were never activated have no password hash
			if (!user || !user.passhash || !(await bcrypt.compare(password, user.passhash))) {
				return reply.code(401).send({ error: 'Invalid credentials.' });
			}

			if (repo.users.isDisabled(user.id)) {
				return reply.code(403).send({ error: 'Account disabled' });
			}

			return {
				token: signToken(user, secret),
				user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role }
			};
		}
	);

	app.get('/me', { preHandler: authenticate }, async (req) => req.user);

	// Signed-in users change their own password. A wrong current password is a 400, not a 401,
	// so the client does not treat it as an expired session.
	app.post(
		'/password',
		{
			preHandler: authenticate,
			schema: {
				body: {
					type: 'object',
					required: ['current', 'password'],
					properties: { current: { type: 'string' }, password: { type: 'string', minLength: 6 } }
				}
			}
		},
		async (req) => {
			const user = repo.users.byId(req.user.id);
			if (!user.passhash || !(await bcrypt.compare(req.body.current, user.passhash))) {
				throw badRequest('Current password is incorrect.');
			}
			repo.users.setPassword(user.id, await bcrypt.hash(req.body.password, BCRYPT_ROUNDS));
			return { ok: true };
		}
	);
}
