import { badRequest, conflict, notFound } from '../lib/errors.js';
import { canSeeEventType } from '../lib/roles.js';
import { extractCaptureInfo } from '../services/paypal.js';
import { PAYMENT_EXPIRE_MS } from '../services/scheduler.js';

export default async function paymentRoutes(app, { ctx }) {
	const { repo, push, paypal, now, authenticate } = ctx;
	app.addHook('preHandler', authenticate);

	app.post(
		'/orders',
		{
			schema: {
				body: {
					type: 'object',
					required: ['event_id'],
					properties: { event_id: { type: 'integer' } }
				}
			}
		},
		async (req, reply) => {
			const event = repo.events.byId(req.body.event_id);
			if (!event || !canSeeEventType(req.user.role, event.type)) throw notFound('Invalid event.');
			if (Number(event.price) === 0) throw badRequest('Event not payable.');
			if (repo.payments.completed(event.id, req.user.id)) throw badRequest('Already paid.');

			const order = await paypal.createOrder(event.price);
			if (!order.ok) return reply.code(order.status).send(order.data);

			repo.payments.create({
				orderId: order.data.id,
				amount: event.price,
				eventId: event.id,
				userId: req.user.id,
				now: now()
			});

			return { orderId: order.data.id };
		}
	);

	app.post(
		'/orders/:orderId/capture',
		{
			schema: {
				params: { type: 'object', required: ['orderId'], properties: { orderId: { type: 'string' } } }
			}
		},
		async (req, reply) => {
			const payment = repo.payments.byOrder(req.params.orderId);
			if (!payment || payment.user_id !== req.user.id) throw notFound('Order not found.');

			// Refuse to capture expired orders
			if (payment.status === 'EXPIRED' || payment.created_at + PAYMENT_EXPIRE_MS < now()) {
				repo.payments.expire(payment.order_id);
				throw conflict('Expired.');
			}

			const capture = await paypal.captureOrder(payment.order_id);
			if (!capture.ok) return reply.code(capture.status).send(capture.data);

			const info = extractCaptureInfo(capture.data);
			const completed = info.status === 'COMPLETED';
			repo.payments.capture({
				orderId: payment.order_id,
				transactionId: info.transactionId,
				status: info.status,
				payer: info.payer,
				payedAt: completed ? now() : null
			});

			if (completed) {
				const event = repo.events.byId(payment.event_id);
				push.notifyRole('admin', {
					title: 'Pagamento efetuado.',
					body: `${req.user.full_name} pagou o evento "${event?.name}"`
				});
			}

			return capture.data;
		}
	);
}
