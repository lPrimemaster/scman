import { onMount, Show, type Component } from 'solid-js';
import { loadScript } from '@paypal/paypal-js';
import type { EventItem, MyEventState } from '../../lib/types';
import { api } from '../../lib/api';
import { toast } from '../../lib/toast';
import { Notice } from '../../components/ui/Feedback';

/** Online payments are disabled unless VITE_ENABLE_PAYMENTS=1. */
export const paymentsEnabled = import.meta.env.VITE_ENABLE_PAYMENTS === '1';

const PaypalButtons: Component<{ eventId: number; onSuccess: () => void }> = (props) => {
	let container!: HTMLDivElement;

	onMount(async () => {
		const paypal = await loadScript({
			clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID ?? '',
			currency: 'EUR',
			components: 'buttons'
		}).catch(() => null);

		if (!paypal?.Buttons) {
			toast.error('Não foi possível carregar o PayPal.');
			return;
		}

		paypal
			.Buttons({
				createOrder: async () => (await api.payments.createOrder(props.eventId)).orderId,
				onApprove: async (data) => {
					await api.payments.capture(data.orderID);
					toast.success('Pagamento efetuado.');
					props.onSuccess();
				},
				onError: (err) => {
					console.error('Paypal error:', err);
					toast.error('Erro no pagamento.');
				}
			})
			.render(container);
	});

	return <div ref={container} />;
};

export const PaymentSection: Component<{ event: EventItem; me: MyEventState; onPaid: () => void }> = (props) => (
	<Show when={paymentsEnabled && Number(props.event.price) > 0 && props.me.status === 1 && !props.me.paid}>
		<Notice icon='euro'>Podes pagar a inscrição online.</Notice>
		<PaypalButtons eventId={props.event.id} onSuccess={props.onPaid} />
	</Show>
);
