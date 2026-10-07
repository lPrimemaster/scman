import { createSignal, Show, type Component } from 'solid-js';
import { createStore, produce } from 'solid-js/store';
import type { EventInput, EventItem, EventType } from '../../lib/types';
import { api } from '../../lib/api';
import { todayISO } from '../../lib/dates';
import { EVENT_TYPE_OPTIONS } from '../../lib/events';
import { invalidateEvents } from '../../lib/eventsBus';
import { toast } from '../../lib/toast';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Field, Input, Select, Textarea } from '../../components/ui/Field';
import { FileUploader, type UploadItem } from './FileUploader';

interface FormState {
	name: string;
	location: string;
	start: string;
	end: string;
	sub_limit_date: string;
	change_limit: number;
	type: EventType | undefined;
	price: string;
	description: string;
}

function initialState(event?: EventItem): FormState {
	return {
		name: event?.name ?? '',
		location: event?.location ?? '',
		start: event?.start ?? '',
		end: event?.end ?? '',
		sub_limit_date: event?.sub_limit_date ?? '',
		change_limit: event?.change_limit ?? 5,
		type: event?.type,
		price: event ? Number(event.price).toFixed(2) : '',
		description: event?.description ?? ''
	};
}

/** Accepts "12", "12,5", "12.50" and returns "12.50", or null when invalid. */
export function normalizePrice(value: string): string | null {
	const v = value.trim().replace(',', '.');
	if (v === '') return '0.00';
	if (!/^\d+(\.\d{0,2})?$/.test(v)) return null;
	return Number(v).toFixed(2);
}

let uploadKey = 0;

/** Create (no `event`) or edit an event, including attachments. */
export const EventFormDialog: Component<{
	event?: EventItem;
	onClose: () => void;
	onSaved?: (event: EventItem) => void;
}> = (props) => {
	const editing = !!props.event;
	const [form, setForm] = createStore<FormState>(initialState(props.event));
	const [uploads, setUploads] = createStore<UploadItem[]>(
		(props.event?.files ?? []).map((f) => ({
			key: uploadKey++,
			name: f.name,
			handle: f.handle,
			progress: 100,
			status: 'done',
			existing: true
		}))
	);
	// Existing attachments removed during this edit, deleted only once saved
	const removedExisting: string[] = [];
	const [saving, setSaving] = createSignal(false);
	const [priceError, setPriceError] = createSignal<string>();

	const today = todayISO();
	const uploading = () => uploads.some((u) => u.status === 'uploading');

	function updateUpload(key: number, patch: Partial<UploadItem>) {
		setUploads((u) => u.key === key, patch);
	}

	function addFiles(files: File[]) {
		for (const file of files) {
			const key = uploadKey++;
			setUploads(uploads.length, {
				key,
				name: file.name,
				size: file.size,
				progress: 0,
				status: 'uploading',
				existing: false
			});
			api.files
				.upload(file, (progress) => updateUpload(key, { progress }))
				.then((res) => updateUpload(key, { handle: res.handle, status: 'done', progress: 100 }))
				.catch((err) => {
					updateUpload(key, { status: 'error' });
					toast.error(err?.message === 'File too large.' ? 'Ficheiro demasiado grande.' : 'Falha no upload.');
				});
		}
	}

	function removeUpload(item: UploadItem) {
		if (item.existing && item.handle) removedExisting.push(item.handle);
		else if (item.handle) api.files.remove(item.handle).catch(() => {});
		setUploads(produce((list) => list.splice(list.indexOf(list.find((u) => u.key === item.key)!), 1)));
	}

	// Closing without saving: remove files uploaded in this session
	function cancel() {
		for (const u of uploads) {
			if (!u.existing && u.handle) api.files.remove(u.handle).catch(() => {});
		}
		props.onClose();
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		const price = normalizePrice(form.price);
		if (price === null) {
			setPriceError('Formato inválido. Ex.: 12.50');
			return;
		}
		if (form.type === undefined) return;

		const payload: EventInput = {
			name: form.name,
			location: form.location,
			start: form.start,
			end: form.end,
			sub_limit_date: form.sub_limit_date,
			change_limit: form.change_limit,
			type: form.type,
			price,
			description: form.description,
			files: uploads
				.filter((u) => u.status === 'done' && u.handle)
				.map((u) => ({ handle: u.handle!, name: u.name }))
		};

		setSaving(true);
		try {
			const saved = editing
				? await api.events.update(props.event!.id, payload)
				: await api.events.create(payload);
			await Promise.all(removedExisting.map((h) => api.files.remove(h).catch(() => {})));
			invalidateEvents();
			toast.success(editing ? 'Evento editado.' : 'Evento criado.');
			props.onSaved?.(saved);
			props.onClose();
		} catch {
			toast.error(editing ? 'Falha ao editar evento.' : 'Falha ao criar evento.');
		} finally {
			setSaving(false);
		}
	}

	return (
		<Dialog
			open
			onClose={cancel}
			size='lg'
			title={editing ? 'Editar evento' : 'Novo evento'}
			footer={
				<>
					<Button onClick={cancel}>Cancelar</Button>
					<Button type='submit' form='event-form' variant='primary' loading={saving()} disabled={uploading()}>
						{editing ? 'Guardar alterações' : 'Criar evento'}
					</Button>
				</>
			}
		>
			<form id='event-form' class='grid grid-cols-1 gap-4 sm:grid-cols-2' onSubmit={submit}>
				<Field label='Nome' class='sm:col-span-2'>
					<Input
						name='name'
						value={form.name}
						onInput={(e) => setForm('name', e.currentTarget.value)}
						required
					/>
				</Field>
				<Field label='Local'>
					<Input
						name='location'
						value={form.location}
						onInput={(e) => setForm('location', e.currentTarget.value)}
						required
					/>
				</Field>
				<Field label='Tipo'>
					<Select
						aria-label='Tipo'
						value={form.type}
						options={EVENT_TYPE_OPTIONS}
						onChange={(v) => setForm('type', v)}
						required
					/>
				</Field>
				<Field label='Início'>
					<Input
						name='start'
						type='date'
						value={form.start}
						min={editing ? undefined : today}
						onInput={(e) => setForm('start', e.currentTarget.value)}
						required
					/>
				</Field>
				<Field label='Fim'>
					<Input
						name='end'
						type='date'
						value={form.end}
						min={form.start || (editing ? undefined : today)}
						onInput={(e) => setForm('end', e.currentTarget.value)}
						required
					/>
				</Field>
				<Field label='Limite de inscrição'>
					<Input
						name='sub_limit_date'
						type='date'
						value={form.sub_limit_date}
						min={editing ? undefined : today}
						max={form.start || undefined}
						onInput={(e) => setForm('sub_limit_date', e.currentTarget.value)}
						required
					/>
				</Field>
				<Field label='Máximo de alterações' hint='Quantas vezes cada atleta pode mudar a resposta.'>
					<Input
						name='change_limit'
						type='number'
						min={0}
						max={100}
						value={form.change_limit}
						onInput={(e) => setForm('change_limit', Number(e.currentTarget.value))}
						required
					/>
				</Field>
				<Field label='Custo (€)' error={priceError()}>
					<Input
						name='price'
						inputmode='decimal'
						placeholder='0.00'
						value={form.price}
						onInput={(e) => {
							setPriceError(undefined);
							setForm('price', e.currentTarget.value);
						}}
						onBlur={() => {
							const p = normalizePrice(form.price);
							if (p !== null && form.price !== '') setForm('price', p);
						}}
					/>
				</Field>
				<Field label='Descrição' class='sm:col-span-2'>
					<Textarea
						name='description'
						value={form.description}
						onInput={(e) => setForm('description', e.currentTarget.value)}
					/>
				</Field>
				<div class='flex flex-col gap-1.5 sm:col-span-2'>
					<span class='text-sm font-medium'>Anexos</span>
					<FileUploader items={uploads} onFiles={addFiles} onRemove={removeUpload} />
					<Show when={uploading()}>
						<p class='text-xs text-fg-muted'>Aguarda que os anexos terminem de enviar.</p>
					</Show>
				</div>
			</form>
		</Dialog>
	);
};
