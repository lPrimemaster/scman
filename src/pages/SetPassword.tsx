import { A, useNavigate, useSearchParams } from '@solidjs/router';
import { createResource, createSignal, Match, Switch, type Component } from 'solid-js';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { toast } from '../lib/toast';
import type { TokenCheck } from '../lib/types';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Field';
import { EmptyState, Notice, PageSpinner } from '../components/ui/Feedback';
import { AuthLayout } from './Login';

const MIN_LENGTH = 6;

const REASONS: Record<string, string> = {
	invalid_token: 'Este link não é válido.',
	used_token: 'Este link já foi utilizado.',
	expired_token: 'Este link expirou. Pede um novo a um administrador.'
};

interface Mode {
	title: string;
	submitLabel: string;
	check: (token: string) => Promise<TokenCheck>;
	submit: (token: string, password: string) => Promise<{ username: string }>;
	success: string;
}

const MODES: Record<'activate' | 'reset', Mode> = {
	activate: {
		title: 'Ativar conta',
		submitLabel: 'Ativar conta',
		check: api.invites.check,
		submit: api.invites.activate,
		success: 'Conta ativada.'
	},
	reset: {
		title: 'Nova password',
		submitLabel: 'Definir password',
		check: api.resets.check,
		submit: api.resets.submit,
		success: 'Password alterada.'
	}
};

/** Shared page for account activation (/activate) and password reset (/reset_password). */
export const SetPasswordPage: Component<{ mode: 'activate' | 'reset' }> = (props) => {
	const mode = MODES[props.mode];
	const [params] = useSearchParams<{ token?: string }>();
	const navigate = useNavigate();
	const session = useSession();
	const token = () => params.token ?? '';

	const [check] = createResource(token, (t) =>
		t ? mode.check(t).catch((): TokenCheck => ({ valid: false, reason: 'invalid_token' })) : null
	);

	const [password, setPassword] = createSignal('');
	const [confirm, setConfirm] = createSignal('');
	const [error, setError] = createSignal<string>();
	const [busy, setBusy] = createSignal(false);

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (password().length < MIN_LENGTH) return setError(`A password deve ter pelo menos ${MIN_LENGTH} caracteres.`);
		if (password() !== confirm()) return setError('As passwords não coincidem.');

		setBusy(true);
		setError(undefined);
		try {
			const { username } = await mode.submit(token(), password());
			toast.success(mode.success);
			await session.logout();
			await session.login(username, password()).catch(() => undefined);
			navigate('/', { replace: true });
		} catch {
			setError('Não foi possível concluir. O link pode ter expirado.');
		} finally {
			setBusy(false);
		}
	}

	return (
		<AuthLayout title={mode.title}>
			<Switch>
				<Match when={check.loading}>
					<PageSpinner />
				</Match>
				<Match when={!check() || !check()!.valid}>
					<EmptyState
						icon='ban'
						title={REASONS[(check() as { reason?: string })?.reason ?? ''] ?? 'Link inválido.'}
					>
						<A href='/login' class='font-medium text-accent hover:underline'>
							Ir para o início de sessão
						</A>
					</EmptyState>
				</Match>
				<Match when={check()?.valid && check()}>
					{(c) => (
						<form class='flex flex-col gap-4' onSubmit={submit}>
							<Field label='Utilizador'>
								<Input
									name='username'
									autocomplete='username'
									value={(c() as { username: string }).username}
									readonly
								/>
							</Field>
							<Field label='Password' hint={`Mínimo de ${MIN_LENGTH} caracteres.`}>
								<Input
									name='password'
									type='password'
									autocomplete='new-password'
									value={password()}
									onInput={(e) => setPassword(e.currentTarget.value)}
									required
								/>
							</Field>
							<Field label='Confirmar password'>
								<Input
									name='confirm'
									type='password'
									autocomplete='new-password'
									value={confirm()}
									onInput={(e) => setConfirm(e.currentTarget.value)}
									required
								/>
							</Field>
							{error() && <Notice tone='danger'>{error()}</Notice>}
							<Button type='submit' variant='primary' size='lg' block loading={busy()}>
								{mode.submitLabel}
							</Button>
						</form>
					)}
				</Match>
			</Switch>
		</AuthLayout>
	);
};
