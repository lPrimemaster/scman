import crypto from 'node:crypto';
import { notFound } from '../lib/errors.js';
import { visibleEventTypes } from '../lib/roles.js';
import { buildCalendar } from '../lib/ics.js';
import { DAY_MS, todayISO } from '../lib/dates.js';

// How far back the feed goes; older events only add noise to calendar apps
const PAST_DAYS = 90;

const newToken = () => crypto.randomBytes(24).toString('hex');
const feedPath = (token) => `/api/calendar/${token}.ics`;

// Personal calendar subscription: a secret URL calendar apps poll, without the login token
export default async function calendarRoutes(app, { ctx }) {
	const { repo, now, authenticate } = ctx;

	app.get('/feed', { preHandler: authenticate }, async (req) => {
		let feed = repo.calendarFeeds.byUser(req.user.id);
		if (!feed) {
			repo.calendarFeeds.set(req.user.id, newToken(), now());
			feed = repo.calendarFeeds.byUser(req.user.id);
		}
		return { path: feedPath(feed.token) };
	});

	// Replaces the secret: the old URL stops working (e.g. it was shared by mistake)
	app.post('/feed/regenerate', { preHandler: authenticate }, async (req) => {
		const token = newToken();
		repo.calendarFeeds.set(req.user.id, token, now());
		return { path: feedPath(token) };
	});

	app.get(
		'/:file',
		{
			schema: {
				params: { type: 'object', properties: { file: { type: 'string', pattern: '^[a-f0-9]{48}\\.ics$' } } },
				querystring: { type: 'object', properties: { only: { type: 'string', enum: ['going'] } } }
			}
		},
		async (req, reply) => {
			const token = req.params.file.slice(0, -'.ics'.length);
			const feed = repo.calendarFeeds.byToken(token);
			const user = feed && repo.users.byId(feed.user_id);
			if (!user || user.active !== 1 || repo.users.isDisabled(user.id)) throw notFound('Calendar not found.');

			const statuses = repo.responses.byUser(user.id);
			const since = todayISO(now() - PAST_DAYS * DAY_MS);
			const events = repo.events
				.list({ types: visibleEventTypes(user.role) })
				.filter((e) => (e.end || e.start) >= since)
				.filter((e) => req.query.only !== 'going' || statuses.get(e.id)?.status === 1);

			const name = req.query.only === 'going' ? 'SC 1925 · Os meus eventos' : 'SC 1925';
			reply
				.type('text/calendar; charset=utf-8')
				.header('Cache-Control', 'private, max-age=900')
				.header('Content-Disposition', 'inline; filename="sc1925.ics"');
			return buildCalendar({ events, statuses, name, now: now() });
		}
	);
}
