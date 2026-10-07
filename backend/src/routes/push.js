const subscriptionBody = {
	type: 'object',
	required: ['endpoint', 'keys'],
	properties: {
		endpoint: { type: 'string', pattern: '^https://' },
		keys: {
			type: 'object',
			required: ['p256dh', 'auth'],
			properties: { p256dh: { type: 'string', minLength: 1 }, auth: { type: 'string', minLength: 1 } }
		}
	}
};

// Web Push: browsers (and the installed PWA) subscribe here
export default async function pushRoutes(app, { ctx }) {
	const { repo, push, now, authenticate, vapidPublicKey } = ctx;

	app.get('/config', async () => ({ enabled: push.enabled && !!vapidPublicKey, publicKey: vapidPublicKey ?? null }));

	app.post('/subscriptions', { preHandler: authenticate, schema: { body: subscriptionBody } }, async (req) => {
		const { endpoint, keys } = req.body;
		repo.webpush.upsert({
			userId: req.user.id,
			endpoint,
			p256dh: keys.p256dh,
			auth: keys.auth,
			userAgent: req.headers['user-agent']?.slice(0, 200),
			now: now()
		});
		return { ok: true };
	});

	app.delete(
		'/subscriptions',
		{
			preHandler: authenticate,
			schema: { body: { type: 'object', required: ['endpoint'], properties: { endpoint: { type: 'string' } } } }
		},
		async (req) => {
			repo.webpush.removeForUser(req.user.id, req.body.endpoint);
			return { ok: true };
		}
	);

	// Lets users check that notifications reach this device
	app.post('/test', { preHandler: authenticate }, async (req) => {
		const result = await push.sendToUser(req.user.id, {
			title: 'Notificações ativas ✓',
			body: 'Vais receber aqui os avisos do SC 1925.',
			url: '/',
			tag: 'test'
		});
		return result;
	});
}
