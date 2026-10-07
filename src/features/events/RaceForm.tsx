import { createResource, createSignal, type Component } from 'solid-js';
import { createStore } from 'solid-js/store';
import type { EventItem, RaceInput } from '../../lib/types';
import { api, ApiError } from '../../lib/api';
import { addDays, todayISO } from '../../lib/dates';
import { createDebounced } from '../../lib/debounce';
import { MEMBER_RACE, normalizeName } from '../../lib/events';
import { invalidateEvents } from '../../lib/eventsBus';
import { toast } from '../../lib/toast';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Field, Input, Textarea } from '../../components/ui/Field';
import { RaceNameField } from './RaceNameField';

/** Default deadline: `deadlineDays` before the start, never before today. */
export function defaultRaceDeadline(start: string, today = todayISO()) {
	const deadline = addDays(start, -MEMBER_RACE.deadlineDays);
	return deadline < today ? today : deadline;
}

/** Any athlete can add a CPT race; type, price and change limit are fixed by the server. */
export const RaceFormDialog: Component<{
	onClose: () => void;
	onSaved?: (event: EventItem) => void;
	/** Open an existing race instead of creating a new one */
	onOpenExisting: (id: number) => void;
}> = (props) => {
	const today = todayISO();
	const [form, setForm] = createStore<RaceInput>({
		name: '',
		location: '',
		start: '',
		sub_limit_date: '',
		description: ''
	});
	// Once the deadline is picked by hand, stop deriving it from the start date
	const [deadlineTouched, setDeadlineTouched] = createSignal(false);
	const [saving, setSaving] = createSignal(false);

	// Suggest existing races while typing, so the same race is not added twice
	const lookup = createDebounced(() => {
		const name = form.name.trim();
		if (name.length < 3) return undefined;
		return { name, location: form.location.trim() || undefined, start: form.start || undefined };
	});
	const [similar] = createResource(lookup, (params) => api.events.similarRaces(params).catch(() => []));
	// Keep showing the previous suggestions while a new lookup is in flight
	const suggestions = () => (lookup() ? (similar.latest ?? []) : []);
	// Names must be unique: compare against the current input, not the (debounced) query
	const sameName = () => {
		const name = normalizeName(form.name);
		return name ? suggestions().find((race) => normalizeName(race.name) === name) : undefined;
	};

	function setStart(start: string) {
		setForm('start', start);
		if (start && !deadlineTouched()) setForm('sub_limit_date', defaultRaceDeadline(start, today));
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (sameName()) return;
		setSaving(true);
		try {
			const saved = await api.events.createRace(form);
			invalidateEvents();
			toast.success('Prova criada.');
			props.onSaved?.(saved);
			props.onClose();
		} catch (err) {
			const existingId = err instanceof ApiError && err.status === 409 ? err.data?.existingId : undefined;
			if (typeof existingId === 'number') {
				toast.error('Esta prova já existe.');
				props.onOpenExisting(existingId);
			} else {
				toast.error('Falha ao criar prova.');
			}
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
					<Button type='submit' form='race-form' variant='primary' loading={saving()} disabled={!!sameName()}>
						Criar prova
					</Button>
				</>
			}
		>
			<form id='race-form' class='grid grid-cols-1 gap-4 sm:grid-cols-2' onSubmit={submit}>
				<RaceNameField
					value={form.name}
					onInput={(name) => setForm('name', name)}
					suggestions={suggestions()}
					sameName={sameName()}
					onPick={(race) => props.onOpenExisting(race.id)}
				/>
				<Field label='Local' class='sm:col-span-2'>
					<Input
						name='location'
						value={form.location}
						onInput={(e) => setForm('location', e.currentTarget.value)}
						required
					/>
				</Field>
				<Field label='Data' hint='Provas de um só dia.'>
					<Input
						name='start'
						type='date'
						value={form.start}
						min={today}
						onInput={(e) => setStart(e.currentTarget.value)}
						required
					/>
				</Field>
				<Field
					label='Limite de inscrição'
					hint={`Por defeito, ${MEMBER_RACE.deadlineDays} dias antes da prova.`}
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
