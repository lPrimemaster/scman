import jwt from 'jsonwebtoken';

const TOKEN_TTL = '7d';

export function signToken(user, secret) {
	return jwt.sign({ id: user.id, role: user.role }, secret, { expiresIn: TOKEN_TTL });
}

// Fastify preHandler factories. `req.user` is loaded from the database on every request so
// role changes and disabled accounts take effect immediately (tokens only carry the id).
export function createAuth({ repo, secret }) {
	async function authenticate(req, reply) {
		const header = req.headers.authorization;
		const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
		if (!token) return reply.code(401).send({ error: 'Unauthorized.' });

		let payload;
		try {
			payload = jwt.verify(token, secret);
		} catch {
			return reply.code(401).send({ error: 'Unauthorized.' });
		}

		const user = repo.users.byId(payload.id);
		if (!user) return reply.code(401).send({ error: 'Unauthorized.' });
		if (repo.users.isDisabled(user.id)) return reply.code(403).send({ error: 'Account disabled' });

		req.user = { id: user.id, role: user.role, username: user.username, full_name: user.full_name };
	}

	function requireRole(...roles) {
		return async (req, reply) => {
			if (!roles.includes(req.user?.role)) {
				return reply.code(403).send({ error: 'Forbidden.' });
			}
		};
	}

	return { authenticate, requireRole };
}
