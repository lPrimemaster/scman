import bcrypt from 'bcrypt';
import { signToken } from '../plugins/auth.js';

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
}
