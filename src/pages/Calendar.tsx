import { createEffect, createResource, createSignal, For, on, onCleanup, onMount, type Component } from 'solid-js';
import { Calendar as FullCalendar, type EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import ptLocale from '@fullcalendar/core/locales/pt';
import { api } from '../lib/api';
import type { EventItem } from '../lib/types';
import { addDays } from '../lib/dates';
import { EVENT_TYPES } from '../lib/events';
import { eventsVersion } from '../lib/eventsBus';
import { MOBILE_QUERY, useMediaQuery } from '../lib/media';
import { toastError } from '../lib/toast';
import { Card, PageHeader } from '../components/ui/Feedback';
import { useEventDialog } from '../features/events/useEventDialog';
import { CalendarSubscribeDialog } from '../features/events/CalendarSubscribe';
import { Button } from '../components/ui/Button';

export function toCalendarEvents(events: EventItem[]): EventInput[] {
	return events.flatMap((e) => {
		const color = EVENT_TYPES[e.type]?.color;
		return [
			{
				id: String(e.id),
				title: e.name,
				start: e.start,
				end: addDays(e.end || e.start, 1), // exclusive end
				allDay: true,
				backgroundColor: color,
				borderColor: color,
				extendedProps: { eventId: e.id }
			},
			{
				id: `limit-${e.id}`,
				title: `Limite: ${e.name}`,
				start: e.sub_limit_date,
				allDay: true,
				classNames: ['fc-deadline'],
				extendedProps: { eventId: e.id }
			}
		];
	});
}

export const CalendarPage: Component = () => {
	const [subscribeOpen, setSubscribeOpen] = createSignal(false);
	const isMobile = useMediaQuery(MOBILE_QUERY);
	const dialog = useEventDialog();
	const [events] = createResource(eventsVersion, () =>
		api.events.list().catch(toastError('Erro ao carregar eventos.'))
	);
	let element!: HTMLDivElement;
	let calendar: FullCalendar | undefined;

	onMount(() => {
		calendar = new FullCalendar(element, {
			plugins: [dayGridPlugin, listPlugin],
			initialView: isMobile() ? 'listMonth' : 'dayGridMonth',
			headerToolbar: { left: 'title', center: '', right: 'today prev,next' },
			locale: ptLocale,
			height: 'auto',
			dayMaxEventRows: 4,
			noEventsContent: 'Sem eventos este mês.',
			listDayFormat: { weekday: 'long', day: 'numeric', month: 'short' },
			listDaySideFormat: false,
			eventClick: (info) => {
				info.jsEvent.preventDefault();
				dialog.open(info.event.extendedProps.eventId);
			}
		});
		calendar.render();
		onCleanup(() => calendar?.destroy());
	});

	createEffect(
		on(events, (list) => {
			if (!calendar || !list) return;
			calendar.removeAllEventSources();
			calendar.addEventSource(toCalendarEvents(list));
		})
	);

	createEffect(
		on(isMobile, (mobile) => calendar?.changeView(mobile ? 'listMonth' : 'dayGridMonth'), { defer: true })
	);

	return (
		<>
			<PageHeader title='Calendário'>
				<Button size='sm' icon='rss' onClick={() => setSubscribeOpen(true)}>
					Subscrever
				</Button>
			</PageHeader>
			<CalendarSubscribeDialog open={subscribeOpen()} onClose={() => setSubscribeOpen(false)} />
			<Card class='p-3 sm:p-5'>
				<div ref={element} />
				<div class='mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-fg-muted'>
					<For each={Object.values(EVENT_TYPES)}>
						{(t) => (
							<span class='inline-flex items-center gap-1.5'>
								<span class='size-2 rounded-full' style={{ background: t.color }} />
								{t.label}
							</span>
						)}
					</For>
					<span class='inline-flex items-center gap-1.5'>
						<span class='size-2 rounded-full border border-dashed border-danger' />
						Limite de inscrição
					</span>
				</div>
			</Card>
		</>
	);
};
