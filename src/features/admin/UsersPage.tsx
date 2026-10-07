import { createMemo, createResource, createSignal, For, Show, type Component } from 'solid-js';
import { api } from '../../lib/api';
import type { ManagedUser, Role, UserStatus } from '../../lib/types';
import { ROLE_LABELS, ROLE_OPTIONS } from '../../lib/events';
import { absoluteUrl } from '../../lib/media';
import { toast } from '../../lib/toast';
import { useSession } from '../../lib/session';
import { Badge, Card, EmptyState, Notice, PageHeader, PageSpinner } from '../../components/ui/Feedback';
import { Button } from '../../components/ui/Button';
import { Field, SearchInput, Select } from '../../components/ui/Field';
import { ConfirmDialog, Dialog } from '../../components/ui/Dialog';
import { Icon } from '../../components/ui/Icon';
import { BackLink } from './AdminHome';
import { CopyField } from './CopyField';

const STATUS: Record<UserStatus, { label: string; tone: 'success' | 'neutral' | 'danger' }> = {
	active: { label: 'Ativa', tone: 'success' },
	inactive: { label: 'Por ativar', tone: 'neutral' },
	disabled: { label: 'Desativada', tone: 'danger' }
};

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function filterUsers(users: ManagedUser[], query: string) {
	const q = normalize(query.trim());
	if (!q) return users;
	return users.filter((u) =>
		[u.full_name, u.username, ROLE_LABELS[u.role] ?? u.role, STATUS[u.status].label].some((v) =>
			normalize(v).includes(q)
		)
	);
}

const ManageUserDialog: Component<{
	user: ManagedUser;
	isSelf: boolean;
	onClose: () => void;
	onChange: (u: ManagedUser) => void;
}> = (props) => {
	const [resetLink, setResetLink] = createSignal<string>();
	const [confirmDisable, setConfirmDisable] = createSignal(false);
	const [busy, setBusy] = createSignal<string>();

	async function run(key: string, fn: () => Promise<void>, error: string) {
		setBusy(key);
		try {
			await fn();
		} catch {
			toast.error(error);
		} finally {
			setBusy(undefined);
		}
	}

	const changeRole = (role: Role) =>
		run(
			'role',
			async () => {
				props.onChange(await api.users.update(props.user.id, { role }));
				toast.success('Permissão alterada.');
			},
			'Falha ao alterar permissão.'
		);

	const setDisabled = (disabled: boolean) =>
		run(
			'disable',
			async () => {
				props.onChange(await api.users.update(props.user.id, { disabled }));
				toast.success(disabled ? 'Conta desativada.' : 'Conta reativada.');
			},
			disabled ? 'Falha ao desativar o utilizador.' : 'Falha ao reativar o utilizador.'
		);

	const reset = () =>
		run(
			'reset',
			async () => {
				setResetLink(absoluteUrl((await api.users.resetPassword(props.user.id)).resetLink));
			},
			'Falha ao gerar link de reset.'
		);

	return (
		<Dialog open onClose={props.onClose} title={props.user.full_name} size='sm'>
			<div class='flex flex-col gap-5'>
				<div class='flex items-center gap-2 text-sm text-fg-muted'>
					@{props.user.username}
					<Badge tone={STATUS[props.user.status].tone}>{STATUS[props.user.status].label}</Badge>
				</div>

				<Field label='Permissão'>
					<Select
						aria-label='Permissão'
						value={props.user.role}
						options={ROLE_OPTIONS}
						onChange={changeRole}
						disabled={props.isSelf || busy() === 'role'}
					/>
				</Field>

				<div class='flex flex-col gap-2'>
					<span class='text-sm font-medium'>Password</span>
					<Show
						when={resetLink()}
						fallback={
							<Button icon='key' onClick={reset} loading={busy() === 'reset'}>
								Gerar link de reset
							</Button>
						}
					>
						<CopyField value={resetLink()!} label='Link de reset' />
						<p class='text-xs text-fg-muted'>
							Envia este link ao utilizador para definir uma nova password.
						</p>
					</Show>
				</div>

				<Show when={!props.isSelf}>
					<div class='flex flex-col gap-2 border-t border-border pt-4'>
						<Show
							when={props.user.status === 'disabled'}
							fallback={
								<Button
									variant='ghost'
									icon='ban'
									class='text-danger'
									onClick={() => setConfirmDisable(true)}
									disabled={props.user.status === 'inactive'}
								>
									Desativar conta
								</Button>
							}
						>
							<Button icon='user-check' onClick={() => setDisabled(false)} loading={busy() === 'disable'}>
								Reativar conta
							</Button>
						</Show>
					</div>
				</Show>
				<Show when={props.isSelf}>
					<Notice icon='user'>Não podes alterar a permissão nem desativar a tua própria conta.</Notice>
				</Show>
			</div>

			<ConfirmDialog
				open={confirmDisable()}
				title='Desativar conta?'
				confirmLabel='Desativar'
				danger
				onConfirm={() => setDisabled(true)}
				onClose={() => setConfirmDisable(false)}
			>
				A conta não é apagada. O utilizador deixa de conseguir entrar até ser reativado.
			</ConfirmDialog>
		</Dialog>
	);
};

export const UsersPage: Component = () => {
	const session = useSession();
	const [users, { mutate }] = createResource(api.users.list);
	const [query, setQuery] = createSignal('');
	const [selectedId, setSelectedId] = createSignal<number>();

	const filtered = createMemo(() => filterUsers(users() ?? [], query()));
	const selected = () => users()?.find((u) => u.id === selectedId());

	function replace(user: ManagedUser) {
		mutate((list) => list?.map((u) => (u.id === user.id ? user : u)));
	}

	return (
		<>
			<BackLink />
			<PageHeader title='Utilizadores' subtitle={users() ? `${users()!.length} contas` : undefined} />

			<div class='mb-4'>
				<SearchInput value={query()} onInput={setQuery} placeholder='Pesquisar por nome, utilizador, grupo…' />
			</div>

			<Card>
				<Show when={!users.loading || users()} fallback={<PageSpinner />}>
					<Show when={filtered().length > 0} fallback={<EmptyState icon='users' title='Sem resultados.' />}>
						<ul class='divide-y divide-border'>
							<For each={filtered()}>
								{(user) => (
									<li>
										<button
											class='flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-2 sm:px-5'
											onClick={() => setSelectedId(user.id)}
										>
											<div class='min-w-0 flex-1'>
												<p class='truncate font-medium'>{user.full_name}</p>
												<p class='truncate text-sm text-fg-muted'>@{user.username}</p>
											</div>
											<span class='hidden text-sm text-fg-muted sm:inline'>
												{ROLE_LABELS[user.role] ?? user.role}
											</span>
											<Badge tone={STATUS[user.status].tone}>{STATUS[user.status].label}</Badge>
											<Icon name='chevron-right' class='size-4 text-fg-muted' />
										</button>
									</li>
								)}
							</For>
						</ul>
					</Show>
				</Show>
			</Card>

			<Show when={selected()}>
				{(user) => (
					<ManageUserDialog
						user={user()}
						isSelf={user().id === session.user()?.id}
						onClose={() => setSelectedId(undefined)}
						onChange={replace}
					/>
				)}
			</Show>
		</>
	);
};
