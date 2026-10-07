import { A, useLocation, useNavigate } from '@solidjs/router';
import { createSignal, For, Show, type ParentComponent } from 'solid-js';
import { useSession } from '../../lib/session';
import { ROLE_LABELS } from '../../lib/events';
import { Icon, type IconName } from '../ui/Icon';
import { Dialog } from '../ui/Dialog';
import { Button, IconButton } from '../ui/Button';
import { theme, toggleTheme } from '../../lib/theme';
import { NotificationsSetting } from '../../features/account/NotificationsSetting';
import { ChangePasswordDialog } from '../../features/account/ChangePasswordDialog';
import { InstallAppSetting } from '../../features/account/InstallPrompt';
import { cx } from '../ui/cx';

export const APP_VERSION = 'v0.8';

interface NavItem {
	href: string;
	label: string;
	icon: IconName;
	adminOnly?: boolean;
}

const NAV: NavItem[] = [
	{ href: '/', label: 'Início', icon: 'home' },
	{ href: '/calendar', label: 'Calendário', icon: 'calendar' },
	{ href: '/admin', label: 'Admin', icon: 'shield', adminOnly: true }
];

function initials(name = '') {
	const parts = name.trim().split(/\s+/);
	return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

const Avatar = (props: { name?: string; class?: string }) => (
	<span
		class={cx(
			'inline-flex items-center justify-center rounded-full bg-accent-soft font-semibold text-accent-strong',
			props.class ?? 'size-8 text-xs'
		)}
	>
		{initials(props.name)}
	</span>
);

export const AppShell: ParentComponent = (props) => {
	const session = useSession();
	const location = useLocation();
	const navigate = useNavigate();
	const [accountOpen, setAccountOpen] = createSignal(false);
	const [passwordOpen, setPasswordOpen] = createSignal(false);

	const items = () => NAV.filter((i) => !i.adminOnly || session.isAdmin());
	const isActive = (href: string) => (href === '/' ? location.pathname === '/' : location.pathname.startsWith(href));

	async function logout() {
		setAccountOpen(false);
		await session.logout();
		navigate('/login', { replace: true });
	}

	return (
		<div class='min-h-dvh'>
			{/* Top bar */}
			<header class='pt-safe sticky top-0 z-30 border-b border-border bg-surface/85 backdrop-blur-md'>
				<div class='mx-auto flex h-14 max-w-5xl items-center gap-6 px-4 sm:px-6'>
					<A href='/' class='flex items-center gap-2.5'>
						<img src='/logo.svg' alt='' class='h-8 w-auto' />
						<span class='text-sm font-semibold tracking-tight'>SC 1925</span>
					</A>

					<nav class='hidden items-center gap-1 md:flex' aria-label='Principal'>
						<For each={items()}>
							{(item) => (
								<A
									href={item.href}
									class={cx(
										'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
										isActive(item.href) ? 'bg-surface-2 text-fg' : 'text-fg-muted hover:text-fg'
									)}
								>
									{item.label}
								</A>
							)}
						</For>
					</nav>

					<IconButton
						class='ml-auto'
						icon={theme() === 'dark' ? 'sun' : 'moon'}
						label={theme() === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
						onClick={toggleTheme}
					/>
					<button
						class='-ml-4 flex cursor-pointer items-center gap-2 rounded-full py-1 pr-1 pl-3 hover:bg-surface-2'
						onClick={() => setAccountOpen(true)}
						aria-label='Conta'
					>
						<span class='hidden text-sm text-fg-muted sm:inline'>{session.user()?.full_name}</span>
						<Avatar name={session.user()?.full_name} />
					</button>
				</div>
			</header>

			<main class='mx-auto max-w-5xl px-4 pt-5 pb-28 sm:px-6 md:pt-8 md:pb-12'>{props.children}</main>

			{/* Mobile tab bar */}
			<nav
				class='pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/90 backdrop-blur-md md:hidden'
				aria-label='Principal'
			>
				<div class='mx-auto flex max-w-md'>
					<For each={items()}>
						{(item) => (
							<A
								href={item.href}
								class={cx(
									'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors',
									isActive(item.href) ? 'text-accent' : 'text-fg-muted'
								)}
							>
								<Icon name={item.icon} class='size-5' />
								{item.label}
							</A>
						)}
					</For>
				</div>
			</nav>

			<Dialog open={accountOpen()} onClose={() => setAccountOpen(false)} title='Conta' size='sm'>
				<Show when={session.user()}>
					{(user) => (
						<div class='flex flex-col gap-5'>
							<div class='flex items-center gap-3'>
								<Avatar name={user().full_name} class='size-12 text-base' />
								<div class='min-w-0'>
									<p class='truncate font-medium'>{user().full_name}</p>
									<p class='text-sm text-fg-muted'>
										@{user().username} · {ROLE_LABELS[user().role] ?? user().role}
									</p>
								</div>
							</div>
							<NotificationsSetting />
							<div class='flex flex-col gap-2'>
								<InstallAppSetting />
								<Button
									icon='lock'
									block
									onClick={() => {
										setAccountOpen(false);
										setPasswordOpen(true);
									}}
								>
									Alterar password
								</Button>
								<Button icon='logout' block onClick={logout}>
									Terminar sessão
								</Button>
							</div>
							<p class='text-center text-xs text-fg-muted'>Seixal Clube 1925 · {APP_VERSION}</p>
						</div>
					)}
				</Show>
			</Dialog>
			<ChangePasswordDialog open={passwordOpen()} onClose={() => setPasswordOpen(false)} />
		</div>
	);
};
