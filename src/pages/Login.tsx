import { Navigate, useNavigate } from '@solidjs/router';
import { createSignal, Show, type Component, type ParentComponent } from 'solid-js';
import { useSession } from '../lib/session';
import { ApiError } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Field';
import { Notice } from '../components/ui/Feedback';
import { APP_VERSION } from '../components/layout/AppShell';

export const AuthLayout: ParentComponent<{ title: string; subtitle?: string }> = (props) => (
	<div class='flex min-h-dvh flex-col items-center justify-center px-4 py-10'>
		<div class='w-full max-w-sm'>
			<div class='mb-8 flex flex-col items-center text-center'>
				<img src='/logo.svg' alt='Seixal Clube 1925' class='mb-5 h-20 w-auto' />
				<h1 class='text-xl font-semibold tracking-tight'>{props.title}</h1>
				<Show when={props.subtitle}>
					<p class='mt-1 text-sm text-fg-muted'>{props.subtitle}</p>
				</Show>
			</div>
			<div class='rounded-2xl border border-border bg-surface p-6 shadow-sm'>{props.children}</div>
			<p class='mt-6 text-center text-xs text-fg-muted'>Seixal Clube 1925 · {APP_VERSION}</p>
		</div>
	</div>
);

export const Login: Component = () => {
	const session = useSession();
	const navigate = useNavigate();
	const [username, setUsername] = createSignal('');
	const [password, setPassword] = createSignal('');
	const [error, setError] = createSignal<string>();
	const [busy, setBusy] = createSignal(false);

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		setError(undefined);
		setBusy(true);
		try {
			await session.login(username(), password());
			navigate('/', { replace: true });
		} catch (err) {
			setError(
				err instanceof ApiError && err.status === 403
					? 'Conta desativada por um administrador.'
					: err instanceof ApiError && err.status === 401
						? 'Credenciais inválidas.'
						: 'Não foi possível iniciar sessão.'
			);
		} finally {
			setBusy(false);
		}
	}

	return (
		<Show when={!session.user()} fallback={<Navigate href='/' />}>
			<AuthLayout title='Gestão de Ciclismo' subtitle='Inicia sessão para continuar.'>
				<form class='flex flex-col gap-4' onSubmit={submit}>
					<Field label='Utilizador'>
						<Input
							name='username'
							autocomplete='username'
							autocapitalize='none'
							value={username()}
							onInput={(e) => setUsername(e.currentTarget.value)}
							required
						/>
					</Field>
					<Field label='Password'>
						<Input
							name='password'
							type='password'
							autocomplete='current-password'
							value={password()}
							onInput={(e) => setPassword(e.currentTarget.value)}
							required
						/>
					</Field>
					<Show when={error()}>
						<Notice tone='danger'>{error()}</Notice>
					</Show>
					<Button type='submit' variant='primary' size='lg' block loading={busy()}>
						Entrar
					</Button>
				</form>
			</AuthLayout>
		</Show>
	);
};
