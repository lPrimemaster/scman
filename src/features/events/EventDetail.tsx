import { createResource, createSignal, Show, type Component, type JSX } from 'solid-js';
import { api, ApiError } from '../../lib/api';
import type { EventDetail as Detail, ResponseStatus } from '../../lib/types';
import { formatDate, formatRange, relativeDays } from '../../lib/dates';
import { EVENT_TYPES, formatPrice } from '../../lib/events';
import { downloadICS, openGoogleCalendar } from '../../lib/calendarExport';
import { invalidateEvents } from '../../lib/eventsBus';
import { toast } from '../../lib/toast';
import { Dialog } from '../../components/ui/Dialog';
import { Badge, PageSpinner, EmptyState } from '../../components/ui/Feedback';
import { Button } from '../../components/ui/Button';
import { Icon, type IconName } from '../../components/ui/Icon';
import { AttendanceTabs } from './Attendance';
import { ResponseControls } from './ResponseControls';
import { Attachments } from './Attachments';
import { useEventDialog } from './useEventDialog';
import { PaymentSection } from '../payments/PaymentSection';

const InfoItem: Component<{ icon: IconName; label: string; children: JSX.Element }> = (props) => (
	<div class='flex items-start gap-3'>
		<div class='flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-fg-muted'>
			<Icon name={props.icon} class='size-4' />
		</div>
		<div class='min-w-0'>
			<p class='text-xs text-fg-muted'>{props.label}</p>
			<p class='text-sm font-medium'>{props.children}</p>
		</div>
	</div>
);

const Section: Component<{ title: string; children: JSX.Element }> = (props) => (
	<section class='flex flex-col gap-3'>
		<h3 class='text-xs font-semibold tracking-wider text-fg-muted uppercase'>{props.title}</h3>
		{props.children}
	</section>
);

export const EventDetailContent: Component<{
	detail: Detail;
	busy: boolean;
	onRespond: (status: ResponseStatus) => void;
	onPaid: () => void;
}> = (props) => {
	const event = () => props.detail.event;
	const me = () => props.detail.me;

	return (
		<div class='flex flex-col gap-6'>
			<div class='grid grid-cols-1 gap-3 sm:grid-cols-2'>
				<InfoItem icon='calendar' label='Datas'>
					{formatRange(event().start, event().end)}
				</InfoItem>
				<InfoItem icon='map-pin' label='Local'>
					{event().location}
				</InfoItem>
				<InfoItem icon='clock' label='Inscrições até'>
					{formatDate(event().sub_limit_date)}{' '}
					<span class='font-normal text-fg-muted'>({relativeDays(event().sub_limit_date)})</span>
				</InfoItem>
				<InfoItem icon='euro' label='Custo'>
					{formatPrice(event().price)}
				</InfoItem>
			</div>

			<Show when={event().description}>
				<p class='text-sm leading-relaxed whitespace-pre-line text-fg'>{event().description}</p>
			</Show>

			<Show when={event().files.length > 0}>
				<Section title='Anexos'>
					<Attachments files={event().files} />
				</Section>
			</Show>

			<Section title='A tua disponibilidade'>
				<ResponseControls me={me()} busy={props.busy} onRespond={props.onRespond} />
				<Show when={me().status === 1 || me().status === 2}>
					<div class='flex flex-wrap gap-2'>
						<Button size='sm' icon='calendar-plus' onClick={() => openGoogleCalendar(event())}>
							Google Calendar
						</Button>
						<Button size='sm' icon='download' onClick={() => downloadICS(event())}>
							Outlook / Apple (.ics)
						</Button>
					</div>
				</Show>
				<PaymentSection event={event()} me={me()} onPaid={props.onPaid} />
			</Section>

			<Section title='Participantes'>
				<AttendanceTabs attendance={props.detail.attendance} />
			</Section>
		</div>
	);
};

export const EventDetailDialog: Component<{ id: number; onClose: () => void }> = (props) => {
	const [detail, { mutate, refetch }] = createResource(
		() => props.id,
		(id) =>
			api.events.get(id).catch((err) => {
				if (err instanceof ApiError && err.status === 404) return null;
				throw err;
			})
	);
	const [busy, setBusy] = createSignal(false);

	async function respond(status: ResponseStatus) {
		setBusy(true);
		try {
			mutate(await api.events.respond(props.id, status));
			invalidateEvents();
			toast.success('Resposta registada.');
		} catch (err) {
			toast.error(err instanceof ApiError ? 'Não foi possível alterar a resposta.' : 'Erro de rede.');
			refetch();
		} finally {
			setBusy(false);
		}
	}

	const event = () => detail()?.event;

	return (
		<Dialog
			open
			onClose={props.onClose}
			size='lg'
			label={event()?.name ?? 'Evento'}
			title={
				<Show when={event()} fallback='Evento'>
					{(e) => (
						<div class='flex flex-col gap-1.5'>
							<Badge dot={EVENT_TYPES[e().type]?.color} class='self-start'>
								{EVENT_TYPES[e().type]?.label}
							</Badge>
							<span class='leading-snug'>{e().name}</span>
						</div>
					)}
				</Show>
			}
		>
			<Show when={!detail.loading || detail()} fallback={<PageSpinner />}>
				<Show
					when={detail()}
					fallback={
						<EmptyState icon='calendar' title='Evento não encontrado'>
							Pode ter sido apagado ou não tens acesso.
						</EmptyState>
					}
				>
					{(d) => (
						<EventDetailContent
							detail={d()}
							busy={busy()}
							onRespond={respond}
							onPaid={() => {
								refetch();
								invalidateEvents();
							}}
						/>
					)}
				</Show>
			</Show>
		</Dialog>
	);
};

/** Renders the detail dialog for `?event=<id>` anywhere in the signed-in app. */
export const EventDetailRoute: Component = () => {
	const dialog = useEventDialog();
	return (
		<Show when={dialog.openId()} keyed>
			{(id) => <EventDetailDialog id={id} onClose={dialog.close} />}
		</Show>
	);
};
