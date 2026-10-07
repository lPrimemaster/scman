import { For, Show, type Component } from 'solid-js';
import type { EventItem } from '../../lib/types';
import { formatRange, monthShortOf, parseISODate, formatDayMonth } from '../../lib/dates';
import { canQuickAnswer, deadlineState, EVENT_TYPES, RESPONSE_LABELS } from '../../lib/events';
import { Badge, EmptyState } from '../../components/ui/Feedback';
import { Icon } from '../../components/ui/Icon';
import { useEventDialog } from './useEventDialog';
import { QuickAnswer } from './QuickAnswer';

export const DateTile: Component<{ iso: string; color?: string }> = (props) => (
	<div
		class='flex size-12 shrink-0 flex-col items-center justify-center rounded-xl border border-border bg-surface-2'
		style={props.color ? { 'border-left': `3px solid ${props.color}` } : undefined}
	>
		<span class='text-base leading-none font-semibold'>{parseISODate(props.iso).getDate()}</span>
		<span class='mt-0.5 text-[10px] font-medium tracking-wide text-fg-muted uppercase'>
			{monthShortOf(props.iso)}
		</span>
	</div>
);

export const DeadlineBadge: Component<{ event: EventItem }> = (props) => {
	const state = () => deadlineState(props.event);
	return (
		<Badge
			tone={state() === 'closed' ? 'neutral' : state() === 'soon' ? 'warning' : 'neutral'}
			title='Data limite de inscrição'
		>
			<Icon name='clock' class='size-3' />
			{state() === 'closed' ? 'Inscrições fechadas' : `Até ${formatDayMonth(props.event.sub_limit_date)}`}
		</Badge>
	);
};

export const StatusBadge: Component<{ status?: number }> = (props) => (
	<Show when={props.status !== undefined && props.status !== -1}>
		<Badge tone={props.status === 1 ? 'success' : props.status === 0 ? 'danger' : 'warning'}>
			<Icon name={props.status === 0 ? 'x' : 'check'} class='size-3' />
			{RESPONSE_LABELS[props.status as 0 | 1 | 2]}
		</Badge>
	</Show>
);

export const EventRow: Component<{ event: EventItem; onClick: () => void }> = (props) => (
	<li class='flex items-center gap-2 pr-3 transition-colors hover:bg-surface-2 sm:pr-4'>
		<button
			class='flex min-w-0 flex-1 cursor-pointer items-center gap-3.5 py-3 pl-4 text-left sm:pl-5'
			onClick={() => props.onClick()}
		>
			<DateTile iso={props.event.start} color={EVENT_TYPES[props.event.type]?.color} />
			<div class='min-w-0 flex-1'>
				<p class='truncate font-medium'>{props.event.name}</p>
				<p class='mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-fg-muted'>
					<span class='inline-flex min-w-0 items-center gap-1'>
						<Icon name='map-pin' class='size-3.5 shrink-0' />
						<span class='truncate'>{props.event.location}</span>
					</span>
					<span class='hidden sm:inline'>{formatRange(props.event.start, props.event.end)}</span>
				</p>
				<div class='mt-1.5 flex flex-wrap gap-1.5'>
					<DeadlineBadge event={props.event} />
					<StatusBadge status={props.event.my_status} />
				</div>
			</div>
		</button>
		<Show
			when={canQuickAnswer(props.event)}
			fallback={<Icon name='chevron-right' class='size-4 shrink-0 text-fg-muted' />}
		>
			<QuickAnswer event={props.event} />
		</Show>
	</li>
);

export const EventList: Component<{ events: EventItem[]; emptyText?: string }> = (props) => {
	const dialog = useEventDialog();
	return (
		<Show
			when={props.events.length > 0}
			fallback={<EmptyState icon='calendar' title={props.emptyText ?? 'Sem eventos'} />}
		>
			<ul class='divide-y divide-border'>
				<For each={props.events}>
					{(event) => <EventRow event={event} onClick={() => dialog.open(event.id)} />}
				</For>
			</ul>
		</Show>
	);
};
