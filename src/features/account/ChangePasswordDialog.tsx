import { createSignal, type Component } from 'solid-js';
import { createStore } from 'solid-js/store';
import { api, ApiError } from '../../lib/api';
import { toast } from '../../lib/toast';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';

const MIN_LENGTH = 6;

export const ChangePasswordDialog: Component<{ open: boolean; onClose: () => void }> = (props) => {
	const [form, setForm] = createStore({ current: '', password: '', confirm: '' });
	const [errors, setErrors] = createStore<{ current?: string; password?: string; confirm?: string }>({});
	const [saving, setSaving] = createSignal(false);

	function close() {
		setForm({ current: '', password: '', confirm: '' });
		setErrors({ current: undefined, password: undefined, confirm: undefined });
		props.onClose();
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		setErrors({
			current: undefined,
			password: form.password.length < MIN_LENGTH ? `Pelo menos ${MIN_LENGTH} caracteres.` : undefined,
			confirm: form.password !== form.confirm ? 'As passwords não coincidem.' : undefined
		});
		if (errors.password || errors.confirm) return;

		setSaving(true);
		try {
			await api.auth.changePassword(form.current, form.password);
			toast.success('Password alterada.');
			close();
		} catch (err) {
			if (err instanceof ApiError && err.status === 400) setErrors('current', 'Password atual incorreta.');
			else toast.error('Não foi possível alterar a password.');
		} finally {
			setSaving(false);
		}
	}

	return (
		<Dialog
			open={props.open}
			onClose={close}
			title='Alterar password'
			size='sm'
			footer={
				<>
					<Button onClick={close}>Cancelar</Button>
					<Button type='submit' form='password-form' variant='primary' loading={saving()}>
						Guardar
					</Button>
				</>
			}
		>
			<form id='password-form' class='flex flex-col gap-4' onSubmit={submit}>
				<Field label='Password atual' error={errors.current}>
					<Input
						type='password'
						autocomplete='current-password'
						value={form.current}
						onInput={(e) => setForm('current', e.currentTarget.value)}
						required
					/>
				</Field>
				<Field label='Nova password' error={errors.password} hint={`Pelo menos ${MIN_LENGTH} caracteres.`}>
					<Input
						type='password'
						autocomplete='new-password'
						value={form.password}
						onInput={(e) => setForm('password', e.currentTarget.value)}
						required
					/>
				</Field>
				<Field label='Confirmar nova password' error={errors.confirm}>
					<Input
						type='password'
						autocomplete='new-password'
						value={form.confirm}
						onInput={(e) => setForm('confirm', e.currentTarget.value)}
						required
					/>
				</Field>
			</form>
		</Dialog>
	);
};
