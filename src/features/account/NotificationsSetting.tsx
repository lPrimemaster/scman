import { createSignal, Match, onMount, Show, Switch, type Component } from 'solid-js';
import { api } from '../../lib/api';
import { disablePush, enablePush, pushState, refreshPushState } from '../../lib/push';
import { toast, toastError } from '../../lib/toast';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';

/** "Notificações" row in the account dialog: enable/disable push on this device and send a test. */
export const NotificationsSetting: Component = () => {
	const [busy, setBusy] = createSignal(false);
	onMount(refreshPushState);

	async function run(action: () => Promise<unknown>) {
		setBusy(true);
		try {
			await action();
		} catch (err) {
			toastError('Não foi possível alterar as notificações.')(err);
		} finally {
			setBusy(false);
		}
	}

	async function enable() {
		const ok = await enablePush();
		if (ok) toast.success('Notificações ativadas neste dispositivo.');
	}

	async function sendTest() {
		const res = await api.push.test();
		if (res.sent > 0) toast.success('Notificação de teste enviada.');
		else toast.error('Não foi possível entregar a notificação.');
	}

	return (
		<div class='flex flex-col gap-3 rounded-xl border border-border p-3.5'>
			<div class='flex items-center gap-3'>
				<div class='flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-fg-muted'>
					<Icon name='bell' class='size-4' />
				</div>
				<div class='min-w-0 flex-1'>
					<p class='text-sm font-medium'>Notificações</p>
					<p class='text-xs text-fg-muted'>
						<Switch fallback='Avisos de novos eventos, alterações e prazos.'>
							<Match when={pushState() === 'on'}>Ativas neste dispositivo.</Match>
							<Match when={pushState() === 'denied'}>
								Bloqueadas no browser. Permite-as nas definições do site.
							</Match>
							<Match when={pushState() === 'needs-install'}>
								No iPhone, adiciona a app ao ecrã principal (Partilhar → Adicionar ao ecrã principal) e
								ativa-as lá.
							</Match>
							<Match when={pushState() === 'unsupported'}>Este browser não suporta notificações.</Match>
							<Match when={pushState() === 'unavailable'}>Indisponíveis de momento.</Match>
						</Switch>
					</p>
				</div>
				<Show when={pushState() === 'off'}>
					<Button size='sm' variant='primary' loading={busy()} onClick={() => run(enable)}>
						Ativar
					</Button>
				</Show>
				<Show when={pushState() === 'on'}>
					<Button size='sm' loading={busy()} onClick={() => run(disablePush)}>
						Desativar
					</Button>
				</Show>
			</div>
			<Show when={pushState() === 'on'}>
				<Button size='sm' variant='ghost' icon='send' onClick={() => run(sendTest)} class='self-start'>
					Enviar teste
				</Button>
			</Show>
		</div>
	);
};
