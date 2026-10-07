import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';

import { createAuth } from './plugins/auth.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import inviteRoutes from './routes/invites.js';
import eventRoutes from './routes/events.js';
import fileRoutes from './routes/files.js';
import pushRoutes from './routes/push.js';
import paymentRoutes from './routes/payments.js';

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * Builds the HTTP app. All dependencies are injected so tests can provide fakes.
 * @param {{ repo, push, paypal, storage, secret: string, logger?: boolean, now?: () => number }} deps
 */
export async function buildApp({ repo, push, paypal, storage, secret, logger = false, now = Date.now }) {
	const app = Fastify({ logger });

	await app.register(cors, { origin: true });
	await app.register(multipart, { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });

	app.setErrorHandler((err, req, reply) => {
		if (err.validation) {
			return reply.code(400).send({ error: err.message });
		}
		const status = err.statusCode ?? 500;
		if (status >= 500) {
			req.log.error(err);
			console.error(err);
		}
		return reply.code(status).send({ error: status >= 500 ? 'Internal error.' : err.message });
	});

	const ctx = { repo, push, paypal, storage, secret, now, ...createAuth({ repo, secret }) };

	await app.register(authRoutes, { prefix: '/api/auth', ctx });
	await app.register(userRoutes, { prefix: '/api/users', ctx });
	await app.register(inviteRoutes, { prefix: '/api', ctx });
	await app.register(eventRoutes, { prefix: '/api/events', ctx });
	await app.register(fileRoutes, { prefix: '/api/files', ctx });
	await app.register(pushRoutes, { prefix: '/api/push', ctx });
	await app.register(paymentRoutes, { prefix: '/api/payments', ctx });

	return app;
}
