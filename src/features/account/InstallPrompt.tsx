import { createSignal, Match, Show, Switch, type Component, type JSX } from 'solid-js';
import {
	dismissInstall,
	installMode,
	isDismissalActive,
	isFirefox,
	isMobile,
	promptInstall,
	readInstallDismissal
} from '../../lib/pwa';
import { toast } from '../../lib/toast';
import { Button, IconButton } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Icon, type IconName } from '../../components/ui/Icon';

const Step: Component<{ n: number; icon: IconName; children: JSX.Element }> = (props) => (
	<li class='flex items-center gap-3'>
		<span class='flex size-6 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-semibold text-fg'>
			{props.n}
		</span>
		<span class='min-w-0 flex-1 text-sm'>{props.children}</span>
		<Icon name={props.icon} class='size-5 shrink-0 text-fg-muted' />
	</li>
);

/** How to add the app to the home screen when the browser has no install button of its own. */
export const InstallSteps: Component = () => (
	<Switch>
		<Match when={installMode() === 'ios'}>
			<ol class='flex flex-col gap-2.5' aria-label='Como instalar no iPhone'>
				<Step n={1} icon='share'>
					Toca em <strong>Partilhar</strong> na barra do browser
				</Step>
				<Step n={2} icon='square-plus'>
					Escolhe <strong>Adicionar ao ecrã principal</strong>
				</Step>
				<Step n={3} icon='smartphone'>
					Abre o <strong>SC 1925</strong> a partir do ecrã principal
				</Step>
			</ol>
		</Match>
		<Match when={installMode() === 'manual'}>
			<ol class='flex flex-col gap-2.5' aria-label='Como instalar no Android'>
				<Step n={1} icon='more-vertical'>
					Abre o <strong>menu ⋮</strong> do browser
				</Step>
				<Step n={2} icon='square-plus'>
					<Show
						when={isFirefox()}
						fallback={
							<>
								Escolhe <strong>Instalar app</strong> (ou <em>Adicionar ao ecrã principal</em>)
							</>
						}
					>
						Escolhe <strong>Instalar</strong>
					</Show>
				</Step>
			</ol>
		</Match>
	</Switch>
);

async function install() {
	if (await promptInstall()) toast.success('App instalada. Encontra-a no ecrã principal.');
}

const [dismissed, setDismissed] = createSignal(isDismissalActive(readInstallDismissal()));

/** Phones and tablets that can install the app and haven't dismissed the card in the last 30 days. */
export const installCardVisible = () =>
	!dismissed() && isMobile() && ['prompt', 'ios', 'manual'].includes(installMode());

/** Card at the top of Home inviting phone users to install the app. Hidden once installed or dismissed. */
export const InstallPrompt: Component = () => {
	function dismiss() {
		dismissInstall();
		setDismissed(true);
	}

	return (
		<Show when={installCardVisible()}>
			<section
				aria-label='Instalar a app'
				class='mb-5 flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent-soft p-4'
			>
				<img src='/icons/icon-192.png' alt='' class='size-11 shrink-0 rounded-xl border border-border' />
				<div class='min-w-0 flex-1'>
					<p class='text-sm font-medium'>Instala a app SC 1925</p>
					<p class='mt-0.5 text-sm text-fg-muted'>
						<Show
							when={installMode() === 'ios'}
							fallback='Abre como uma app, a partir do ecrã principal, e recebe as notificações.'
						>
							Abre como uma app. No iPhone, as notificações só funcionam na app instalada.
						</Show>
					</p>
					<Show
						when={installMode() === 'prompt'}
						fallback={
							<div class='mt-3'>
								<InstallSteps />
							</div>
						}
					>
						<Button size='sm' variant='primary' icon='download' class='mt-3' onClick={install}>
							Instalar
						</Button>
					</Show>
				</div>
				<IconButton icon='x' label='Agora não' onClick={dismiss} class='-mt-1 -mr-1' />
			</section>
		</Show>
	);
};

/** "Instalar app" in the account menu: always available while not installed, even after dismissing the card. */
export const InstallAppSetting: Component = () => {
	const [open, setOpen] = createSignal(false);
	const available = () => ['prompt', 'ios', 'manual'].includes(installMode());

	return (
		<Show when={available()}>
			<Button icon='smartphone' block onClick={() => (installMode() === 'prompt' ? install() : setOpen(true))}>
				Instalar app
			</Button>
			<Dialog open={open()} onClose={() => setOpen(false)} title='Instalar a app' size='sm'>
				<div class='flex flex-col gap-4'>
					<p class='text-sm text-fg-muted'>
						Adiciona o SC 1925 ao ecrã principal para o abrires como uma app e receberes notificações.
					</p>
					<div class='rounded-xl bg-surface-2 p-3.5'>
						<InstallSteps />
					</div>
				</div>
			</Dialog>
		</Show>
	);
};
