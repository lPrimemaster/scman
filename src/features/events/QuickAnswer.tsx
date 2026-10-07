import { createSignal, For, type Component } from 'solid-js';
import type { EventItem, ResponseStatus } from '../../lib/types';
import { api } from '../../lib/api';
import { invalidateEvents } from '../../lib/eventsBus';
import { toast } from '../../lib/toast';
import { cx } from '../../components/ui/cx';
import { Icon } from '../../components/ui/Icon';

const OPTIONS = [
	{ status: 1, label: 'Disponível', icon: 'check', on: 'bg-success text-white border-success' },
	{ status: 0, label: 'Indisponível', icon: 'x', on: 'bg-danger text-white border-danger' }
] as const;

/** One-tap Disponível / Indisponível on an event list row, without opening the event. */
export const QuickAnswer: Component<{ event: EventItem }> = (props) => {
	const [busy, setBusy] = createSignal(false);

	async function answer(status: ResponseStatus) {
		if (busy() || props.event.my_status === status) return;
		setBusy(true);
		try {
			await api.events.respond(props.event.id, status);
			toast.success('Resposta registada.');
			invalidateEvents();
		} catch {
			toast.error('Não foi possível registar a resposta. Abre o evento para ver porquê.');
		} finally {
			setBusy(false);
		}
	}

	return (
		<div class='flex shrink-0 gap-1.5' role='group' aria-label={`Responder a ${props.event.name}`}>
			<For each={OPTIONS}>
				{(o) => {
					const pressed = () => props.event.my_status === o.status;
					return (
						<button
							type='button'
							aria-pressed={pressed()}
							aria-label={o.label}
							title={o.label}
							disabled={busy()}
							class={cx(
								'flex size-9 cursor-pointer items-center justify-center rounded-lg border transition disabled:cursor-wait disabled:opacity-60',
								pressed() ? o.on : 'border-border text-fg-muted hover:bg-surface-2 hover:text-fg'
							)}
							onClick={() => answer(o.status)}
						>
							<Icon name={o.icon} class='size-4' />
						</button>
					);
				}}
			</For>
		</div>
	);
};
