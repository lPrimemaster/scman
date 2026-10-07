import { createResource, createSignal, For, Show, type Component } from 'solid-js';
import { api, ApiError } from '../../lib/api';
import type { Invite, InviteStatus, Role } from '../../lib/types';
import { ROLE_LABELS, ROLE_OPTIONS } from '../../lib/events';
import { autoUsername } from '../../lib/username';
import { absoluteUrl } from '../../lib/media';
import { toast } from '../../lib/toast';
import { Badge, Card, EmptyState, PageHeader, PageSpinner, SectionHeader } from '../../components/ui/Feedback';
import { Button, IconButton } from '../../components/ui/Button';
import { Field, Input, Select } from '../../components/ui/Field';
import { ConfirmDialog } from '../../components/ui/Dialog';
import { BackLink } from './AdminHome';
import { CopyField, copyWithToast } from './CopyField';

const STATUS: Record<InviteStatus, { label: string; tone: 'success' | 'warning' | 'danger' }> = {
	active: { label: 'Conta ativa', tone: 'success' },
	pending: { label: 'Espera ativação', tone: 'warning' },
	expired: { label: 'Expirado', tone: 'danger' }
};

export const InvitesPage: Component = () => {
	const [invites, { refetch }] = createResource(api.invites.list);
	const [fullName, setFullName] = createSignal('');
	const [username, setUsername] = createSignal('');
	const [role, setRole] = createSignal<Role>();
	const [busy, setBusy] = createSignal(false);
	const [created, setCreated] = createSignal<{ name: string; link: string }>();
	const [toDelete, setToDelete] = createSignal<Invite>();

	const suggested = () => autoUsername(fullName());

	async function create(e: SubmitEvent) {
		e.preventDefault();
		if (!role()) return;
		setBusy(true);
		try {
			const res = await api.users.create({
				full_name: fullName().trim(),
				username: username().trim() || suggested(),
				role: role()!
			});
			setCreated({ name: fullName().trim(), link: absoluteUrl(res.inviteLink) });
			setFullName('');
			setUsername('');
			setRole(undefined);
			refetch();
		} catch (err) {
			toast.error(
				err instanceof ApiError && err.status === 409
					? 'Nome de utilizador já existe.'
					: 'Erro ao criar convite.'
			);
		} finally {
			setBusy(false);
		}
	}

	async function remove(invite: Invite) {
		try {
			await api.invites.remove(invite.token);
			toast.success('Convite apagado.');
			refetch();
		} catch {
			toast.error('Erro ao apagar convite.');
		}
	}

	return (
		<>
			<BackLink />
			<PageHeader title='Convites' subtitle='Cria uma conta e envia o link de ativação ao atleta.' />

			<div class='flex flex-col gap-5'>
				<Card class='p-4 sm:p-5'>
					<form
						class='grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1.5fr_1fr_auto] sm:items-end'
						onSubmit={create}
					>
						<Field label='Nome completo'>
							<Input
								name='full_name'
								value={fullName()}
								onInput={(e) => setFullName(e.currentTarget.value)}
								required
							/>
						</Field>
						<Field label='Utilizador'>
							<Input
								name='username'
								value={username()}
								placeholder={suggested() || 'n.apelido'}
								autocapitalize='none'
								pattern='\S+'
								onInput={(e) => setUsername(e.currentTarget.value)}
								required={!suggested()}
							/>
						</Field>
						<Field label='Permissão'>
							<Select
								aria-label='Permissão'
								value={role()}
								options={ROLE_OPTIONS}
								onChange={setRole}
								required
							/>
						</Field>
						<Button type='submit' variant='primary' icon='plus' loading={busy()}>
							Criar convite
						</Button>
					</form>

					<Show when={created()}>
						{(c) => (
							<div class='mt-4 flex flex-col gap-2 rounded-xl bg-success-soft p-3'>
								<p class='text-sm font-medium text-success'>
									Convite criado para {c().name}. Partilha o link:
								</p>
								<CopyField value={c().link} label='Link de ativação' />
							</div>
						)}
					</Show>
				</Card>

				<Card>
					<SectionHeader title='Links registados' />
					<Show when={!invites.loading || invites()} fallback={<PageSpinner />}>
						<Show
							when={(invites()?.length ?? 0) > 0}
							fallback={<EmptyState icon='mail' title='Sem convites registados.' />}
						>
							<ul class='divide-y divide-border'>
								<For each={invites()}>
									{(invite) => (
										<li class='flex items-center gap-3 px-4 py-3 sm:px-5'>
											<div class='min-w-0 flex-1'>
												<p class='truncate font-medium'>{invite.full_name}</p>
												<div class='mt-1 flex flex-wrap items-center gap-1.5 text-sm text-fg-muted'>
													<span>@{invite.username}</span>
													<span>·</span>
													<span>{ROLE_LABELS[invite.role] ?? invite.role}</span>
													<Badge tone={STATUS[invite.status].tone}>
														{STATUS[invite.status].label}
													</Badge>
												</div>
											</div>
											<IconButton
												icon='copy'
												label='Copiar link'
												disabled={invite.status !== 'pending'}
												onClick={() => copyWithToast(absoluteUrl(invite.link))}
											/>
											<IconButton
												icon='trash'
												label='Apagar convite'
												variant='danger'
												onClick={() => setToDelete(invite)}
											/>
										</li>
									)}
								</For>
							</ul>
						</Show>
					</Show>
				</Card>
			</div>

			<ConfirmDialog
				open={!!toDelete()}
				title='Apagar convite?'
				confirmLabel='Apagar'
				danger
				onConfirm={() => remove(toDelete()!)}
				onClose={() => setToDelete(undefined)}
			>
				<Show
					when={toDelete()?.status === 'active'}
					fallback='O link deixa de funcionar e a conta por ativar é removida.'
				>
					A conta de {toDelete()?.full_name} já está ativa e não é apagada. Apenas o registo do link é
					removido.
				</Show>
			</ConfirmDialog>
		</>
	);
};
