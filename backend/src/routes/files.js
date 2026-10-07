import path from 'node:path';
import crypto from 'node:crypto';
import { v7 as uuidv7 } from 'uuid';
import { badRequest, forbidden, notFound } from '../lib/errors.js';

const LINK_TTL_MS = 60 * 1000;

export function signDownload(secret, handle, exp) {
	return crypto.createHmac('sha256', secret).update(`${handle}.${exp}`).digest('hex');
}

function safeEqual(a, b) {
	const ba = Buffer.from(String(a));
	const bb = Buffer.from(String(b));
	return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

export function contentDisposition(filename) {
	const fallback = filename.replace(/[^\x20-\x7e]|["\\]/g, '_');
	return `inline; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

const handleParams = {
	type: 'object',
	required: ['handle'],
	properties: { handle: { type: 'string', minLength: 1 } }
};

export default async function fileRoutes(app, { ctx }) {
	const { repo, storage, secret, now, authenticate, requireRole } = ctx;
	const admin = [authenticate, requireRole('admin')];

	app.post('/', { preHandler: admin }, async (req) => {
		const file = await req.file();
		if (!file) throw badRequest('Missing file.');

		const handle = uuidv7();
		const internalFilename = handle + path.extname(file.filename);

		const { size } = await storage.save(file.file, internalFilename);
		if (file.file.truncated) {
			await storage.remove(storage.dir, internalFilename);
			throw badRequest('File too large.');
		}

		try {
			repo.files.create({
				filename: file.filename,
				internalFilename,
				handle,
				path: storage.dir,
				size,
				mimeType: file.mimetype
			});
		} catch (err) {
			await storage.remove(storage.dir, internalFilename);
			throw err;
		}

		req.log.info(`File: <${handle}> uploaded.`);
		return { handle, name: file.filename, size };
	});

	app.delete('/:handle', { preHandler: admin, schema: { params: handleParams } }, async (req) => {
		const file = repo.files.byHandle(req.params.handle);
		if (!file) throw notFound('Failed to find file.');

		await storage.remove(file.path, file.internal_filename);
		repo.files.remove(file.handle);
		return { ok: true };
	});

	app.get('/:handle/link', { preHandler: authenticate, schema: { params: handleParams } }, async (req) => {
		const { handle } = req.params;
		if (!repo.files.byHandle(handle)) throw notFound('File not found.');

		const exp = now() + LINK_TTL_MS;
		const sig = signDownload(secret, handle, exp);
		return { url: `/api/files/${encodeURIComponent(handle)}?exp=${exp}&sig=${sig}` };
	});

	// No auth pre handler: the link carries a signature
	app.get(
		'/:handle',
		{
			schema: {
				params: handleParams,
				querystring: {
					type: 'object',
					required: ['exp', 'sig'],
					properties: { exp: { type: 'integer' }, sig: { type: 'string' } }
				}
			}
		},
		async (req, reply) => {
			const { handle } = req.params;
			const { exp, sig } = req.query;

			if (now() > exp) throw forbidden('Link expired.');
			if (!safeEqual(sig, signDownload(secret, handle, exp))) throw forbidden('Invalid signature.');

			const file = repo.files.byHandle(handle);
			if (!file || !storage.exists(file.path, file.internal_filename)) throw notFound('File not found.');

			reply.header('Content-Disposition', contentDisposition(file.filename));
			reply.type(file.mime_type || 'application/octet-stream');
			return reply.send(storage.stream(file.path, file.internal_filename));
		}
	);
}
