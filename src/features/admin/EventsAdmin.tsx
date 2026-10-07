import { createMemo, createResource, createSignal, For, Show, type Component } from 'solid-js';
import { api, ApiError } from '../../lib/api';
import type { EventItem } from '../../lib/types';
import { formatRange, todayISO } from '../../lib/dates';
import { EVENT_TYPES } from '../../lib/events';
import { eventsVersion, invalidateEvents } from '../../lib/eventsBus';
import { toast } from '../../lib/toast';
import { Badge, Card, EmptyState, PageHeader, PageSpinner } from '../../components/ui/Feedback';
import { Button, IconButton } from '../../components/ui/Button';
import { Checkbox, SearchInput } from '../../components/ui/Field';
import { ConfirmDialog } from '../../components/ui/Dialog';
import { EventFormDialog } from '../events/EventForm';
import { DateTile } from '../events/EventList';
import { useEventDialog } from '../events/useEventDialog';
import { BackLink } from './AdminHome';

export function filterEvents(events: EventItem[], query: string, showPast: boolean, today = todayISO()) {
	const q = query.trim().toLowerCase();
	return events
		.filter((e) => showPast || e.end >= today)
		.filter((e) => !q || e.name.toLowerCase().includes(q) || e.location.toLowerCase().includes(q))
		.sort((a, b) => (showPast ? b.start.localeCompare(a.start) : a.start.localeCompare(b.start)));
}

export const EventsAdmin: Component = () => {
	const [events] = createResource(eventsVersion, () => api.events.list());
	const [query, setQuery] = createSignal('');
	const [showPast, setShowPast] = createSignal(false);
	const [editing, setEditing] = createSignal<EventItem | 'new'>();
	const [toDelete, setToDelete] = createSignal<EventItem>();
	const dialog = useEventDialog();

	const filtered = createMemo(() => filterEvents(events() ?? [], query(), showPast()));

	async function remove(event: EventItem) {
		try {
			await api.events.remove(event.id);
			invalidateEvents();
			toast.success('Evento apagado.');
		} catch (err) {
			toast.error(
				err instanceof ApiError && err.status === 409
					? 'O evento tem pagamentos associados e não pode ser apagado.'
					: 'Falha ao apagar evento.'
			);
		}
	}

	return (
		<>
			<BackLink />
			<PageHeader title='Eventos'>
				<Button variant='primary' icon='plus' onClick={() => setEditing('new')}>
					Novo evento
				</Button>
			</PageHeader>

			<div class='mb-4 flex flex-col gap-3 sm:flex-row sm:items-center'>
				<div class='flex-1'>
					<SearchInput value={query()} onInput={setQuery} placeholder='Pesquisar por nome ou local…' />
				</div>
				<Checkbox checked={showPast()} onChange={setShowPast} label='Mostrar eventos passados' />
			</div>

			<Card>
				<Show when={!events.loading || events()} fallback={<PageSpinner />}>
					<Show when={filtered().length > 0} fallback={<EmptyState icon='calendar' title='Sem eventos.' />}>
						<ul class='divide-y divide-border'>
							<For each={filtered()}>
								{(event) => (
									<li class='flex items-center gap-3 px-4 py-3 sm:px-5'>
										<button
											class='flex min-w-0 flex-1 cursor-pointer items-center gap-3.5 text-left'
											onClick={() => dialog.open(event.id)}
										>
											<DateTile iso={event.start} color={EVENT_TYPES[event.type]?.color} />
											<div class='min-w-0 flex-1'>
												<p class='truncate font-medium'>{event.name}</p>
												<p class='truncate text-sm text-fg-muted'>
													{event.location} · {formatRange(event.start, event.end)}
												</p>
												<Badge dot={EVENT_TYPES[event.type]?.color} class='mt-1.5'>
													{EVENT_TYPES[event.type]?.label}
												</Badge>
											</div>
										</button>
										<IconButton icon='pencil' label='Editar' onClick={() => setEditing(event)} />
										<IconButton
											icon='trash'
											label='Apagar'
											variant='danger'
											onClick={() => setToDelete(event)}
										/>
									</li>
								)}
							</For>
						</ul>
					</Show>
				</Show>
			</Card>

			<Show when={editing()} keyed>
				{(e) => <EventFormDialog event={e === 'new' ? undefined : e} onClose={() => setEditing(undefined)} />}
			</Show>

			<ConfirmDialog
				open={!!toDelete()}
				title='Apagar evento?'
				confirmLabel='Apagar'
				danger
				onConfirm={() => remove(toDelete()!)}
				onClose={() => setToDelete(undefined)}
			>
				"{toDelete()?.name}" e as respostas e anexos associados serão apagados. Esta ação não pode ser desfeita.
			</ConfirmDialog>
		</>
	);
};
