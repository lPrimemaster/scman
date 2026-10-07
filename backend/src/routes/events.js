import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { parseEventFiles, serializeEventFiles } from '../lib/eventFiles.js';
import { isDeadlinePassed } from '../lib/dates.js';
import { canSeeEventType, EVENT_TYPES, OPEN_EVENT_TYPES, visibleEventTypes } from '../lib/roles.js';

export const RESPONSE_STATUS = { NOT_GOING: 0, GOING: 1, MAYBE: 2 };
const STATUS_NAMES = ['Sem interesse', 'Interessado', 'Talvez'];

const isoDate = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' };

const idParams = {
	type: 'object',
	required: ['id'],
	properties: { id: { type: 'integer' } }
};

const eventBody = {
	type: 'object',
	required: ['name', 'location', 'start', 'end', 'sub_limit_date', 'change_limit', 'type', 'price'],
	properties: {
		name: { type: 'string', minLength: 1 },
		location: { type: 'string', minLength: 1 },
		start: isoDate,
		end: isoDate,
		sub_limit_date: isoDate,
		change_limit: { type: 'integer', minimum: 0, maximum: 100 },
		type: { type: 'integer', enum: EVENT_TYPES },
		price: { type: 'string', pattern: '^\\d+(\\.\\d{1,2})?$' },
		description: { type: ['string', 'null'] },
		files: {
			type: 'array',
			items: {
				type: 'object',
				required: ['handle', 'name'],
				properties: { handle: { type: 'string', minLength: 1 }, name: { type: 'string', minLength: 1 } }
			}
		}
	}
};

export function toEventDto(row) {
	return {
		id: row.id,
		name: row.name,
		location: row.location,
		start: row.start,
		end: row.end,
		sub_limit_date: row.sub_limit_date,
		change_limit: row.change_limit,
		type: row.type,
		price: row.price,
		description: row.description ?? '',
		files: parseEventFiles(row.files)
	};
}

function toEventRow(body) {
	if (body.end < body.start) throw badRequest('End date is before start date.');
	return {
		name: body.name.trim(),
		location: body.location.trim(),
		start: body.start,
		end: body.end,
		sub_limit_date: body.sub_limit_date,
		change_limit: body.change_limit,
		type: body.type,
		price: body.price,
		description: body.description ?? '',
		files: serializeEventFiles(body.files)
	};
}

export default async function eventRoutes(app, { ctx }) {
	const { repo, push, storage, now, authenticate, requireRole } = ctx;
	const admin = [authenticate, requireRole('admin')];

	function loadVisibleEvent(id, user) {
		const event = repo.events.byId(id);
		if (!event || !canSeeEventType(user.role, event.type)) throw notFound('Event not found.');
		return event;
	}

	// The caller's own situation regarding an event
	function selfState(event, userId) {
		const response = repo.responses.get(userId, event.id);
		const count = response?.count ?? 0;
		const paid = !!repo.payments.completed(event.id, userId);
		const deadlinePassed = isDeadlinePassed(event.sub_limit_date, now());
		const locked = count > event.change_limit;

		return {
			status: response?.status ?? -1, // -1: no answer yet
			changesLeft: Math.max(0, event.change_limit + 1 - count),
			locked,
			paid,
			deadlinePassed,
			canRespond: !locked && !paid && !deadlinePassed
		};
	}

	function attendance(event) {
		const going = [];
		const not_going = [];
		const maybe = [];
		for (const r of repo.responses.byStatus(event.id)) {
			[not_going, going, maybe][r.status]?.push(r.full_name);
		}
		const roles = OPEN_EVENT_TYPES.includes(event.type) ? null : ['admin', 'federado'];
		const noanswer = repo.responses.missing(event.id, roles).map((r) => r.full_name);
		return { going, not_going, maybe, noanswer };
	}

	function eventDetail(event, user) {
		return { event: toEventDto(event), attendance: attendance(event), me: selfState(event, user.id) };
	}

	function notifyEventChange(type, message) {
		if (OPEN_EVENT_TYPES.includes(Number(type))) {
			push.notifyRole('cpt', message);
		}
		push.notifyRole('federado', message);
		push.notifyRole('admin', message);
	}

	app.get(
		'/',
		{
			preHandler: authenticate,
			schema: {
				querystring: {
					type: 'object',
					properties: {
						upcoming: { type: 'boolean' },
						type: { type: 'integer', enum: EVENT_TYPES },
						limit: { type: 'integer', minimum: 1 }
					}
				}
			}
		},
		async (req) => {
			const { upcoming, type, limit } = req.query;
			if (type !== undefined && !canSeeEventType(req.user.role, type)) {
				throw forbidden('Insufficient permissions for this event type.');
			}
			const types = type !== undefined ? [type] : visibleEventTypes(req.user.role);
			return repo.events.list({ types, upcoming, limit }).map(toEventDto);
		}
	);

	app.get('/:id', { preHandler: authenticate, schema: { params: idParams } }, async (req) => {
		return eventDetail(loadVisibleEvent(req.params.id, req.user), req.user);
	});

	app.put(
		'/:id/response',
		{
			preHandler: authenticate,
			schema: {
				params: idParams,
				body: {
					type: 'object',
					required: ['status'],
					properties: { status: { type: 'integer', enum: Object.values(RESPONSE_STATUS) } }
				}
			}
		},
		async (req) => {
			const event = loadVisibleEvent(req.params.id, req.user);
			const me = selfState(event, req.user.id);

			if (me.paid) throw badRequest('Cannot change signature. Event is already payed for.');
			if (!me.canRespond) throw badRequest('Cannot change signature. Limit reached.');

			const { status } = req.body;
			repo.responses.upsert(req.user.id, event.id, status);

			push.notifyRole('admin', {
				title: 'Nova inscrição',
				body: `${req.user.full_name} alterou o seu estado no evento ${event.name} para "${STATUS_NAMES[status]}"`
			});

			return eventDetail(event, req.user);
		}
	);

	app.post('/', { preHandler: admin, schema: { body: eventBody } }, async (req) => {
		const row = toEventRow(req.body);
		const id = repo.events.create(row);
		notifyEventChange(row.type, { title: 'Novo evento adicionado.', body: row.name });
		return toEventDto(repo.events.byId(id));
	});

	app.put('/:id', { preHandler: admin, schema: { params: idParams, body: eventBody } }, async (req) => {
		const { id } = req.params;
		if (!repo.events.byId(id)) throw notFound('Event not found.');

		const row = toEventRow(req.body);
		repo.events.update(id, row);
		notifyEventChange(row.type, { title: 'Evento editado.', body: row.name });
		return toEventDto(repo.events.byId(id));
	});

	app.delete('/:id', { preHandler: admin, schema: { params: idParams } }, async (req) => {
		const event = repo.events.byId(req.params.id);
		if (!event) throw notFound('Event not found.');
		// Payment records are kept for accounting
		if (repo.events.hasPayments(event.id)) throw conflict('Event has payments and cannot be deleted.');

		repo.transaction(() => repo.events.remove(event.id));

		// Attachments belong to a single event, remove them as well
		for (const { handle } of parseEventFiles(event.files)) {
			const file = repo.files.byHandle(handle);
			if (!file) continue;
			await storage.remove(file.path, file.internal_filename);
			repo.files.remove(handle);
		}

		return { ok: true };
	});
}
