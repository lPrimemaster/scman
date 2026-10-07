import { badRequest, conflict, notFound } from '../lib/errors.js';
import { ROLES } from '../lib/roles.js';
import { INVITE_TTL_MS, inviteLink, newToken, resetLink } from './invites.js';

const idParams = {
	type: 'object',
	required: ['id'],
	properties: { id: { type: 'integer' } }
};

function toUserDto(u) {
	return {
		id: u.id,
		username: u.username,
		full_name: u.full_name,
		role: u.role,
		status: u.active !== 1 ? 'inactive' : u.is_disabled ? 'disabled' : 'active'
	};
}

export default async function userRoutes(app, { ctx }) {
	const { repo, now, authenticate, requireRole } = ctx;
	app.addHook('preHandler', authenticate);
	app.addHook('preHandler', requireRole('admin'));

	app.get('/', async () => repo.users.list().map(toUserDto));

	// Create an inactive account and return its activation link
	app.post(
		'/',
		{
			schema: {
				body: {
					type: 'object',
					required: ['username', 'full_name', 'role'],
					properties: {
						username: { type: 'string', minLength: 1, pattern: '^\\S+$' },
						full_name: { type: 'string', minLength: 1 },
						role: { enum: ROLES }
					}
				}
			}
		},
		async (req) => {
			const username = req.body.username.trim();
			const full_name = req.body.full_name.trim();
			if (repo.users.byUsername(username)) throw conflict('Username already exists.');

			const token = newToken();
			const id = repo.transaction(() => {
				const userId = repo.users.create({ username, full_name, role: req.body.role });
				repo.invites.create(token, userId, now() + INVITE_TTL_MS);
				return userId;
			});

			return { id, token, inviteLink: inviteLink(token) };
		}
	);

	app.patch(
		'/:id',
		{
			schema: {
				params: idParams,
				body: {
					type: 'object',
					minProperties: 1,
					additionalProperties: false,
					properties: { role: { enum: ROLES }, disabled: { type: 'boolean' } }
				}
			}
		},
		async (req) => {
			const { id } = req.params;
			if (!repo.users.byId(id)) throw notFound('User not found.');

			const { role, disabled } = req.body;
			if (id === req.user.id && ((role !== undefined && role !== 'admin') || disabled)) {
				throw badRequest('You cannot demote or disable your own account.');
			}
			repo.transaction(() => {
				if (role !== undefined) repo.users.setRole(id, role);
				if (disabled !== undefined) repo.users.setDisabled(id, disabled);
			});

			const user = repo.users.list().find((u) => u.id === id);
			return toUserDto(user);
		}
	);

	// Generate (or reuse an unused) password reset link
	app.post('/:id/reset', { schema: { params: idParams } }, async (req) => {
		const { id } = req.params;
		if (!repo.users.byId(id)) throw notFound('User not found.');

		const existing = repo.resets.openForUser(id);
		if (existing) return { resetLink: resetLink(existing.token) };

		const token = newToken();
		repo.resets.create(token, id);
		return { resetLink: resetLink(token) };
	});
}
