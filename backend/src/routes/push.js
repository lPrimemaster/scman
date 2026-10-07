const tokenBody = {
	type: 'object',
	required: ['token'],
	properties: { token: { type: 'string', minLength: 20 }, platform: { type: ['string', 'null'] } }
};

export default async function pushRoutes(app, { ctx }) {
	const { repo, now, authenticate } = ctx;
	app.addHook('preHandler', authenticate);

	app.post('/tokens', { schema: { body: tokenBody } }, async (req) => {
		repo.fcm.upsert({
			userId: req.user.id,
			token: req.body.token,
			platform: req.body.platform ?? null,
			now: now()
		});
		return { ok: true };
	});

	app.delete('/tokens', { schema: { body: tokenBody } }, async (req) => {
		repo.fcm.disableForUser(req.user.id, req.body.token);
		return { ok: true };
	});
}
