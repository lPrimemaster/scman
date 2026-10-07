import { A } from '@solidjs/router';
import { For, type Component } from 'solid-js';
import { PageHeader } from '../../components/ui/Feedback';
import { Icon, type IconName } from '../../components/ui/Icon';

const LINKS: Array<{ href: string; title: string; description: string; icon: IconName }> = [
	{ href: '/admin/events', title: 'Eventos', description: 'Criar, editar e apagar eventos.', icon: 'calendar' },
	{
		href: '/admin/register',
		title: 'Convites',
		description: 'Criar contas e partilhar links de ativação.',
		icon: 'user-plus'
	},
	{
		href: '/admin/manage',
		title: 'Utilizadores',
		description: 'Permissões, passwords e contas desativadas.',
		icon: 'users'
	}
];

export const AdminHome: Component = () => (
	<>
		<PageHeader title='Administração' />
		<div class='grid grid-cols-1 gap-3 sm:grid-cols-3'>
			<For each={LINKS}>
				{(link) => (
					<A
						href={link.href}
						class='group flex items-start gap-3.5 rounded-2xl border border-border bg-surface p-4 transition hover:border-accent/50 hover:bg-surface-2 sm:flex-col sm:p-5'
					>
						<div class='flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong'>
							<Icon name={link.icon} class='size-5' />
						</div>
						<div class='flex-1'>
							<p class='font-medium'>{link.title}</p>
							<p class='mt-0.5 text-sm text-fg-muted'>{link.description}</p>
						</div>
						<Icon name='chevron-right' class='mt-1 size-4 text-fg-muted sm:hidden' />
					</A>
				)}
			</For>
		</div>
	</>
);

export const BackLink: Component<{ href?: string; label?: string }> = (props) => (
	<A
		href={props.href ?? '/admin'}
		class='mb-3 inline-flex items-center gap-1 text-sm text-fg-muted transition hover:text-fg'
	>
		<Icon name='chevron-left' class='size-4' />
		{props.label ?? 'Administração'}
	</A>
);
