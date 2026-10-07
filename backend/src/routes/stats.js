import { badRequest } from '../lib/errors.js';
import { INVITE_TTL_MS } from './invites.js';

const isoDate = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' };

// Accounts created before invites existed have no invite: treat them as members from the start
function joinedDate(firstInviteExpiry) {
	if (firstInviteExpiry == null) return null;
	const created = Number(firstInviteExpiry) - INVITE_TTL_MS;
	return Number.isFinite(created) ? new Date(created).toISOString().slice(0, 10) : null;
}

// Raw rows for the admin attendance overview; the client aggregates them
export default async function statsRoutes(app, { ctx }) {
	const { repo, authenticate, requireRole } = ctx;

	app.get(
		'/attendance',
		{
			preHandler: [authenticate, requireRole('admin')],
			schema: {
				querystring: {
					type: 'object',
					properties: { from: isoDate, to: isoDate }
				}
			}
		},
		async (req) => {
			const from = req.query.from ?? '0000-01-01';
			const to = req.query.to ?? '9999-12-31';
			if (to < from) throw badRequest('Invalid range.');

			return {
				from,
				to,
				events: repo.stats.eventsBetween(from, to),
				athletes: repo.stats.athletes().map((u) => ({
					id: u.id,
					full_name: u.full_name,
					username: u.username,
					role: u.role,
					active: u.active === 1,
					disabled: !!u.disabled,
					joined: joinedDate(u.first_invite_expiry)
				})),
				responses: repo.stats.responsesBetween(from, to)
			};
		}
	);
}
