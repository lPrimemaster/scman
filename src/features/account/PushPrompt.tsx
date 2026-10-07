import { createSignal, onMount, Show, type Component } from 'solid-js';
import { enablePush, pushState, refreshPushState } from '../../lib/push';
import { toast, toastError } from '../../lib/toast';
import { Button, IconButton } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';

const DISMISSED_KEY = 'push.prompt.dismissed';

function readDismissed() {
	try {
		return localStorage.getItem(DISMISSED_KEY) === '1';
	} catch {
		return false;
	}
}

/** One-time invitation on Home to turn notifications on (or install the app on iPhone). */
export const PushPrompt: Component = () => {
	const [dismissed, setDismissed] = createSignal(readDismissed());
	const [busy, setBusy] = createSignal(false);
	onMount(refreshPushState);

	function dismiss() {
		setDismissed(true);
		try {
			localStorage.setItem(DISMISSED_KEY, '1');
		} catch {
			// Shown again next visit, no harm
		}
	}

	async function enable() {
		setBusy(true);
		try {
			if (await enablePush()) {
				toast.success('Notificações ativadas.');
				dismiss();
			}
		} catch (err) {
			toastError('Não foi possível ativar as notificações.')(err);
		} finally {
			setBusy(false);
		}
	}

	return (
		<Show when={!dismissed() && (pushState() === 'off' || pushState() === 'needs-install')}>
			<div class='mb-5 flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent-soft p-4'>
				<Icon name='bell' class='mt-0.5 size-5 shrink-0 text-accent-strong' />
				<div class='min-w-0 flex-1'>
					<p class='text-sm font-medium'>Recebe avisos de eventos e prazos</p>
					<p class='mt-0.5 text-sm text-fg-muted'>
						<Show
							when={pushState() === 'needs-install'}
							fallback='Sabe logo quando há um novo evento, uma alteração ou um prazo a terminar.'
						>
							No iPhone: Partilhar → Adicionar ao ecrã principal, e ativa as notificações na app.
						</Show>
					</p>
					<Show when={pushState() === 'off'}>
						<Button size='sm' variant='primary' icon='bell' class='mt-3' loading={busy()} onClick={enable}>
							Ativar notificações
						</Button>
					</Show>
				</div>
				<IconButton icon='x' label='Dispensar' onClick={dismiss} class='-mt-1 -mr-1' />
			</div>
		</Show>
	);
};
