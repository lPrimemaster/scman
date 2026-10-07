import { createSignal, type Component } from 'solid-js';
import { createStore } from 'solid-js/store';
import type { EventItem } from '../../lib/types';
import { api } from '../../lib/api';
import { addDays, todayISO } from '../../lib/dates';
import { MEMBER_RACE } from '../../lib/events';
import { invalidateEvents } from '../../lib/eventsBus';
import { toast } from '../../lib/toast';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Field, Input, Textarea } from '../../components/ui/Field';

/** Default deadline: `deadlineDays` before the start, never before today. */
export function defaultRaceDeadline(start: string, today = todayISO()) {
	const deadline = addDays(start, -MEMBER_RACE.deadlineDays);
	return deadline < today ? today : deadline;
}

/** Any athlete can add a CPT race; type, price and change limit are fixed by the server. */
export const RaceFormDialog: Component<{ onClose: () => void; onSaved?: (event: EventItem) => void }> = (props) => {
	const today = todayISO();
	const [form, setForm] = createStore({
		name: '',
		location: '',
		start: '',
		end: '',
		sub_limit_date: '',
		description: ''
	});
	// Once the deadline is picked by hand, stop deriving it from the start date
	const [deadlineTouched, setDeadlineTouched] = createSignal(false);
	const [saving, setSaving] = createSignal(false);

	function setStart(start: string) {
		setForm('start', start);
		if (start && (!form.end || form.end < start)) setForm('end', start);
		if (start && !deadlineTouched()) setForm('sub_limit_date', defaultRaceDeadline(start, today));
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		setSaving(true);
		try {
			const saved = await api.events.createRace(form);
			invalidateEvents();
			toast.success('Prova criada.');
			props.onSaved?.(saved);
			props.onClose();
		} catch {
			toast.error('Falha ao criar prova.');
		} finally {
			setSaving(false);
		}
	}

	return (
		<Dialog
			open
			onClose={props.onClose}
			title='Nova prova CPT'
			footer={
				<>
					<Button onClick={props.onClose}>Cancelar</Button>
					<Button type='submit' form='race-form' variant='primary' loading={saving()}>
						Criar prova
					</Button>
				</>
			}
		>
			<form id='race-form' class='grid grid-cols-1 gap-4 sm:grid-cols-2' onSubmit={submit}>
				<Field label='Nome' class='sm:col-span-2'>
					<Input
						name='name'
						value={form.name}
						onInput={(e) => setForm('name', e.currentTarget.value)}
						required
					/>
				</Field>
				<Field label='Local' class='sm:col-span-2'>
					<Input
						name='location'
						value={form.location}
						onInput={(e) => setForm('location', e.currentTarget.value)}
						required
					/>
				</Field>
				<Field label='Início'>
					<Input
						name='start'
						type='date'
						value={form.start}
						min={today}
						onInput={(e) => setStart(e.currentTarget.value)}
						required
					/>
				</Field>
				<Field label='Fim'>
					<Input
						name='end'
						type='date'
						value={form.end}
						min={form.start || today}
						onInput={(e) => setForm('end', e.currentTarget.value)}
						required
					/>
				</Field>
				<Field
					label='Limite de inscrição'
					hint={`Por defeito, ${MEMBER_RACE.deadlineDays} dias antes do início.`}
					class='sm:col-span-2'
				>
					<Input
						name='sub_limit_date'
						type='date'
						value={form.sub_limit_date}
						min={today}
						max={form.start || undefined}
						onInput={(e) => {
							setDeadlineTouched(true);
							setForm('sub_limit_date', e.currentTarget.value);
						}}
						required
					/>
				</Field>
				<Field label='Descrição' class='sm:col-span-2'>
					<Textarea
						name='description'
						value={form.description}
						onInput={(e) => setForm('description', e.currentTarget.value)}
					/>
				</Field>
				<p class='text-xs text-fg-muted sm:col-span-2'>
					Prova gratuita. Cada atleta pode alterar a resposta até {MEMBER_RACE.changeLimit} vezes.
				</p>
			</form>
		</Dialog>
	);
};
