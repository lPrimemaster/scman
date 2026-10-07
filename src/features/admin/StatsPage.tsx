import { createMemo, createResource, createSignal, For, Show, type Component, type JSX } from 'solid-js';
import { createStore } from 'solid-js/store';
import type { EventType } from '../../lib/types';
import { api } from '../../lib/api';
import { formatDate, monthShortOf, todayISO } from '../../lib/dates';
import { ALL_EVENT_TYPES, EVENT_TYPES, ROLE_LABELS } from '../../lib/events';
import {
	periodRange,
	summarize,
	typesForGroup,
	type AthleteGroup,
	type AthleteRow,
	type Counts,
	type EventRow
} from '../../lib/stats';
import { useEventDialog } from '../events/useEventDialog';
import { cx } from '../../components/ui/cx';
import { Icon } from '../../components/ui/Icon';
import { Badge, Card, EmptyState, PageHeader, PageSpinner, SectionHeader } from '../../components/ui/Feedback';
import { Checkbox, Input, SearchInput, Select } from '../../components/ui/Field';
import { Legend, type LegendItem } from '../../components/charts/Legend';
import { Meter } from '../../components/charts/Meter';
import { StatTile } from '../../components/charts/StatTile';
import { StackedBars, type BarRow, type BarSegment } from '../../components/charts/StackedBars';
import { StackedColumns, type Column } from '../../components/charts/StackedColumns';
import { BackLink } from './AdminHome';

type Preset = 'year' | '12m' | 'lastYear' | 'all' | 'custom';

const PRESETS: Array<{ value: Preset; label: string }> = [
	{ value: 'year', label: 'Este ano' },
	{ value: '12m', label: 'Últimos 12 meses' },
	{ value: 'lastYear', label: 'Ano passado' },
	{ value: 'all', label: 'Tudo' },
	{ value: 'custom', label: 'Personalizado' }
];

const GROUPS: Array<{ value: AthleteGroup; label: string }> = [
	{ value: 'all', label: 'Todos' },
	{ value: 'federado', label: 'Federados' },
	{ value: 'cpt', label: 'CPT' },
	{ value: 'admin', label: 'Admins' }
];

// Answers as a diverging scale; "Sem resposta" is the unfilled track
const ANSWERS = {
	going: { label: 'Disponível', color: 'var(--viz-going)', ink: 'light' },
	maybe: { label: 'Talvez', color: 'var(--viz-maybe)', ink: 'dark' },
	notGoing: { label: 'Indisponível', color: 'var(--viz-not-going)', ink: 'light' },
	noAnswer: { label: 'Sem resposta', color: 'var(--viz-track)', ink: 'dark' }
} as const;
type AnswerKey = keyof typeof ANSWERS;

const pct = (value: number | null) => (value === null ? '—' : `${Math.round(value * 100)}%`);

const monthTitle = (month: string) =>
	new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' }).format(new Date(`${month}-01T12:00:00`));

/** A compact segmented control, like the attendance tabs. */
function Segmented<T extends string>(props: {
	label: string;
	value: T;
	options: Array<{ value: T; label: string }>;
	onChange: (v: T) => void;
}) {
	return (
		<div class='flex gap-1 rounded-xl bg-surface-2 p-1' role='radiogroup' aria-label={props.label}>
			<For each={props.options}>
				{(o) => (
					<button
						type='button'
						role='radio'
						aria-checked={props.value === o.value}
						class={cx(
							'flex-1 cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition',
							props.value === o.value ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted hover:text-fg'
						)}
						onClick={() => props.onChange(o.value)}
					>
						{o.label}
					</button>
				)}
			</For>
		</div>
	);
}

const TypeDot: Component<{ type: EventType }> = (props) => (
	<span class='inline-block size-2 shrink-0 rounded-full' style={{ background: EVENT_TYPES[props.type].color }} />
);

/** Counts in the fixed answer order, for charts and tables. */
function segments(counts: Counts, withMaybe: boolean): BarSegment[] {
	const keys: AnswerKey[] = withMaybe
		? ['going', 'maybe', 'notGoing', 'noAnswer']
		: ['going', 'notGoing', 'noAnswer'];
	return keys.map((key) => ({ key, value: counts[key], ...ANSWERS[key] }));
}

type SortKey = 'name' | 'expected' | 'going' | 'notGoing' | 'noAnswer' | 'availability' | 'lastAnswer';

export const StatsPage: Component = () => {
	const today = todayISO();
	const eventDialog = useEventDialog();

	const [preset, setPreset] = createSignal<Preset>('year');
	const [custom, setCustom] = createStore({ from: `${today.slice(0, 4)}-01-01`, to: today });
	const range = createMemo(
		() =>
			preset() === 'custom'
				? { from: custom.from, to: custom.to }
				: periodRange(preset() as Exclude<Preset, 'custom'>, today),
		undefined,
		{ equals: (a, b) => a.from === b.from && a.to === b.to }
	);
	const [data] = createResource(range, (r) => api.stats.attendance(r));

	const [group, setGroup] = createSignal<AthleteGroup>('all');
	const [types, setTypes] = createSignal<EventType[]>([...ALL_EVENT_TYPES]);
	const [includeFuture, setIncludeFuture] = createSignal(false);

	// Refetching keeps the previous render (dimmed) instead of flashing a spinner
	const summary = createMemo(() => {
		const d = data.latest;
		return d && summarize(d, { types: types(), group: group(), includeFuture: includeFuture(), today });
	});
	const hasMaybe = () => (summary()?.byType ?? []).some((t) => t.counts.maybe > 0);
	const groupTypes = () => typesForGroup(group());
	const shownTypes = () => groupTypes().filter((t) => types().includes(t));

	function toggleType(type: EventType) {
		setTypes((list) => (list.includes(type) ? list.filter((t) => t !== type) : [...list, type].sort()));
	}

	const answerLegend = (): LegendItem[] =>
		(hasMaybe()
			? (['going', 'maybe', 'notGoing', 'noAnswer'] as AnswerKey[])
			: (['going', 'notGoing', 'noAnswer'] as AnswerKey[])
		).map((key) => ({ label: ANSWERS[key].label, color: ANSWERS[key].color, track: key === 'noAnswer' }));

	const typeRows = (): BarRow[] =>
		(summary()?.byType ?? []).map(({ type, counts }) => {
			const events = summary()!.events.filter((r) => r.event.type === type).length;
			return {
				key: String(type),
				name: EVENT_TYPES[type].label,
				label: (
					<span class='inline-flex items-center gap-2'>
						<TypeDot type={type} />
						{EVENT_TYPES[type].label}
					</span>
				),
				caption: `${events} ${events === 1 ? 'evento' : 'eventos'} · ${counts.expected} esperados`,
				segments: segments(counts, hasMaybe())
			};
		});

	const monthColumns = (): Column[] =>
		(summary()?.byMonth ?? []).map((m) => ({
			key: m.month,
			label:
				m.month.endsWith('-01') || m === summary()!.byMonth[0]
					? `${monthShortOf(`${m.month}-01`)} ${m.month.slice(2, 4)}`
					: monthShortOf(`${m.month}-01`),
			title: monthTitle(m.month),
			segments: shownTypes().map((t) => ({
				key: String(t),
				label: EVENT_TYPES[t].label,
				value: m.going[t],
				color: EVENT_TYPES[t].color
			})),
			footer: `${m.events} ${m.events === 1 ? 'evento' : 'eventos'}`
		}));

	return (
		<>
			<BackLink />
			<PageHeader title='Estatísticas' subtitle='Respostas dos atletas aos eventos do clube.' />

			{/* Filters: one row above everything they scope */}
			<div class='mb-5 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center'>
				<div class='flex flex-wrap items-center gap-2'>
					<Select aria-label='Período' value={preset()} options={PRESETS} onChange={setPreset} class='w-48' />
					<Show when={preset() === 'custom'}>
						<Input
							type='date'
							aria-label='De'
							class='w-40'
							value={custom.from}
							max={custom.to}
							onChange={(e) => e.currentTarget.value && setCustom('from', e.currentTarget.value)}
						/>
						<Input
							type='date'
							aria-label='Até'
							class='w-40'
							value={custom.to}
							min={custom.from}
							onChange={(e) => e.currentTarget.value && setCustom('to', e.currentTarget.value)}
						/>
					</Show>
				</div>
				<Segmented label='Grupo' value={group()} options={GROUPS} onChange={setGroup} />
				<div class='flex flex-wrap items-center gap-2' role='group' aria-label='Tipos de evento'>
					<For each={ALL_EVENT_TYPES}>
						{(type) => {
							const allowed = () => groupTypes().includes(type);
							const on = () => allowed() && types().includes(type);
							return (
								<button
									type='button'
									aria-pressed={on()}
									disabled={!allowed()}
									title={allowed() ? undefined : 'Não visível para CPT'}
									class={cx(
										'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition disabled:cursor-not-allowed disabled:opacity-40',
										on()
											? 'border-border bg-surface text-fg shadow-sm'
											: 'border-dashed border-border text-fg-muted'
									)}
									onClick={() => toggleType(type)}
								>
									<TypeDot type={type} />
									{EVENT_TYPES[type].label}
								</button>
							);
						}}
					</For>
				</div>
				<Checkbox label='Incluir eventos futuros' checked={includeFuture()} onChange={setIncludeFuture} />
			</div>

			<Show
				when={data.state !== 'errored'}
				fallback={<EmptyState icon='chart' title='Erro ao carregar estatísticas.' />}
			>
				<Show when={summary()} fallback={<PageSpinner />}>
					{(s) => (
						<div class={cx('flex flex-col gap-5 transition-opacity', data.loading && 'opacity-60')}>
							<div class='grid grid-cols-2 gap-3 lg:grid-cols-4'>
								<StatTile
									label='Eventos'
									value={String(s().kpis.events)}
									caption={`${s().kpis.expected} respostas esperadas`}
								/>
								<StatTile
									label='Taxa de resposta'
									value={pct(s().kpis.responseRate)}
									meter={s().kpis.responseRate}
									caption={`${s().kpis.answered} de ${s().kpis.expected}`}
								/>
								<StatTile
									label='Disponibilidade'
									value={pct(s().kpis.availability)}
									meter={s().kpis.availability}
									caption={`${s().kpis.going} respostas "Disponível"`}
								/>
								<StatTile
									label='Atletas com resposta'
									value={String(s().kpis.athletesAnswered)}
									caption={`de ${s().athletes.length} atletas esperados`}
								/>
							</div>

							<Show
								when={s().kpis.events > 0}
								fallback={
									<Card>
										<EmptyState icon='chart' title='Sem eventos neste período.'>
											Experimenta outro período ou inclui os eventos futuros.
										</EmptyState>
									</Card>
								}
							>
								<div class='grid grid-cols-1 gap-5 lg:grid-cols-2'>
									<Card>
										<SectionHeader title='Respostas por tipo de evento' />
										<div class='px-4 pb-5 sm:px-5'>
											<Legend items={answerLegend()} class='mb-4' />
											<StackedBars rows={typeRows()} ariaLabel='Respostas por tipo de evento' />
										</div>
									</Card>
									<Card>
										<SectionHeader title='Disponíveis por mês' />
										<div class='px-4 pb-5 sm:px-5'>
											<Legend
												items={shownTypes().map((t) => ({
													label: EVENT_TYPES[t].label,
													color: EVENT_TYPES[t].color
												}))}
												class='mb-4'
											/>
											<StackedColumns
												columns={monthColumns()}
												showTotals={monthColumns().length <= 12}
												ariaLabel='Respostas "Disponível" por mês e tipo de evento'
											/>
										</div>
									</Card>
								</div>

								<AthletesTable rows={s().athletes} withMaybe={hasMaybe()} />
								<EventsTable
									rows={s().events}
									withMaybe={hasMaybe()}
									onOpen={(id) => eventDialog.open(id)}
								/>
							</Show>

							<p class='text-xs leading-relaxed text-fg-muted'>
								Cada atleta conta apenas nos eventos que pode ver (CPT: provas CPT e estágios abertos),
								com conta ativa e já criada na data do evento. Quem respondeu conta sempre. Os grupos
								usam a permissão atual de cada atleta.
							</p>
						</div>
					)}
				</Show>
			</Show>
		</>
	);
};

// ---------- Tables ----------

const Num: Component<{ value: number; muted?: boolean }> = (props) => (
	<span class={cx('tabular-nums', props.muted || props.value === 0 ? 'text-fg-muted' : 'text-fg')}>
		{props.value}
	</span>
);

const RateCell: Component<{ value: number | null; label: string }> = (props) => (
	<div class='flex items-center gap-2'>
		<Meter value={props.value} label={props.label} class='w-16' />
		<span class='w-9 text-right text-sm tabular-nums'>{pct(props.value)}</span>
	</div>
);

const SortHeader: Component<{
	label: string;
	key: SortKey;
	sort: { key: SortKey; desc: boolean };
	onSort: (key: SortKey) => void;
	class?: string;
}> = (props) => (
	<th
		class={cx('px-3 py-2 font-medium', props.class)}
		aria-sort={props.sort.key === props.key ? (props.sort.desc ? 'descending' : 'ascending') : undefined}
	>
		<button
			type='button'
			class='inline-flex cursor-pointer items-center gap-1 hover:text-fg'
			onClick={() => props.onSort(props.key)}
		>
			{props.label}
			<Show when={props.sort.key === props.key}>
				<Icon name='chevron-down' class={cx('size-3.5 transition', !props.sort.desc && 'rotate-180')} />
			</Show>
		</button>
	</th>
);

function sortValue(row: AthleteRow, key: SortKey): string | number {
	switch (key) {
		case 'name':
			return row.athlete.full_name.toLocaleLowerCase('pt');
		case 'availability':
			return row.availability ?? -1;
		case 'lastAnswer':
			return row.lastAnswer ?? '';
		default:
			return row.counts[key];
	}
}

const TypeBreakdown: Component<{ row: AthleteRow }> = (props) => (
	<ul class='grid grid-cols-1 gap-2 sm:grid-cols-2'>
		<For each={ALL_EVENT_TYPES.filter((t) => props.row.byType[t])}>
			{(type) => {
				const c = () => props.row.byType[type]!;
				return (
					<li class='flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-2 text-sm'>
						<TypeDot type={type} />
						<span class='min-w-0 flex-1 truncate'>{EVENT_TYPES[type].label}</span>
						<span class='text-xs text-fg-muted tabular-nums'>
							{c().going}/{c().expected}
						</span>
						<RateCell
							value={c().expected ? c().going / c().expected : null}
							label={EVENT_TYPES[type].label}
						/>
					</li>
				);
			}}
		</For>
	</ul>
);

const AthletesTable: Component<{ rows: AthleteRow[]; withMaybe: boolean }> = (props) => {
	const [query, setQuery] = createSignal('');
	const [sort, setSort] = createStore<{ key: SortKey; desc: boolean }>({ key: 'availability', desc: true });
	const [open, setOpen] = createSignal<number>();

	const rows = () => {
		const q = query().trim().toLocaleLowerCase('pt');
		const list = props.rows.filter(
			(r) => !q || `${r.athlete.full_name} ${r.athlete.username}`.toLocaleLowerCase('pt').includes(q)
		);
		const dir = sort.desc ? -1 : 1;
		return list.sort((a, b) => {
			const x = sortValue(a, sort.key);
			const y = sortValue(b, sort.key);
			return x < y ? -dir : x > y ? dir : a.athlete.full_name.localeCompare(b.athlete.full_name, 'pt');
		});
	};

	function onSort(key: SortKey) {
		setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== 'name' }));
	}
	const toggle = (id: number) => setOpen((cur) => (cur === id ? undefined : id));
	const header = (label: string, key: SortKey, cls = 'text-right') => (
		<SortHeader label={label} key={key} sort={sort} onSort={onSort} class={cls} />
	);

	return (
		<Card>
			<SectionHeader title='Atletas' subtitle={`${props.rows.length} atletas esperados`} />
			<div class='px-4 pb-3 sm:px-5'>
				<SearchInput value={query()} onInput={setQuery} placeholder='Pesquisar atleta…' />
			</div>
			<Show when={rows().length > 0} fallback={<EmptyState icon='users' title='Sem resultados.' />}>
				{/* Desktop: table */}
				<div class='hidden overflow-x-auto md:block'>
					<table class='w-full text-sm'>
						<thead class='border-y border-border text-left text-xs text-fg-muted'>
							<tr>
								{header('Atleta', 'name', 'pl-5 text-left')}
								<th class='px-3 py-2 font-medium'>Grupo</th>
								{header('Esperados', 'expected')}
								{header('Disponível', 'going')}
								{header('Indisponível', 'notGoing')}
								<Show when={props.withMaybe}>
									<th class='px-3 py-2 text-right font-medium'>Talvez</th>
								</Show>
								{header('Sem resposta', 'noAnswer')}
								{header('Disponibilidade', 'availability', 'text-left')}
								{header('Última resposta', 'lastAnswer', 'pr-5 text-left')}
							</tr>
						</thead>
						<tbody>
							<For each={rows()}>
								{(row) => (
									<>
										<tr
											class='cursor-pointer border-b border-border transition last:border-0 hover:bg-surface-2'
											onClick={() => toggle(row.athlete.id)}
										>
											<td class='py-2.5 pr-3 pl-5'>
												<button
													type='button'
													class='flex cursor-pointer items-center gap-2 text-left'
													aria-expanded={open() === row.athlete.id}
													aria-label={`${row.athlete.full_name}: detalhe por tipo`}
													onClick={(e) => {
														e.stopPropagation();
														toggle(row.athlete.id);
													}}
												>
													<Icon
														name='chevron-right'
														class={cx(
															'size-4 text-fg-muted transition',
															open() === row.athlete.id && 'rotate-90'
														)}
													/>
													<span>
														<span class='font-medium text-fg'>{row.athlete.full_name}</span>{' '}
														<span class='text-fg-muted'>({row.athlete.username})</span>
													</span>
												</button>
											</td>
											<td class='px-3'>
												<Badge>{ROLE_LABELS[row.athlete.role]}</Badge>
											</td>
											<td class='px-3 text-right'>
												<Num value={row.counts.expected} />
											</td>
											<td class='px-3 text-right'>
												<Num value={row.counts.going} />
											</td>
											<td class='px-3 text-right'>
												<Num value={row.counts.notGoing} />
											</td>
											<Show when={props.withMaybe}>
												<td class='px-3 text-right'>
													<Num value={row.counts.maybe} />
												</td>
											</Show>
											<td class='px-3 text-right'>
												<Num value={row.counts.noAnswer} />
											</td>
											<td class='px-3'>
												<RateCell value={row.availability} label='Disponibilidade' />
											</td>
											<td class='pr-5 pl-3 text-fg-muted whitespace-nowrap'>
												{row.lastAnswer ? formatDate(row.lastAnswer.slice(0, 10)) : '—'}
											</td>
										</tr>
										<Show when={open() === row.athlete.id}>
											<tr class='border-b border-border'>
												<td colSpan={props.withMaybe ? 9 : 8} class='px-5 py-3'>
													<TypeBreakdown row={row} />
												</td>
											</tr>
										</Show>
									</>
								)}
							</For>
						</tbody>
					</table>
				</div>

				{/* Mobile: cards */}
				<ul class='divide-y divide-border border-t border-border md:hidden'>
					<For each={rows()}>
						{(row) => (
							<li>
								<button
									type='button'
									class='flex w-full cursor-pointer flex-col gap-2 px-4 py-3 text-left'
									aria-expanded={open() === row.athlete.id}
									onClick={() => toggle(row.athlete.id)}
								>
									<div class='flex w-full items-center gap-2'>
										<p class='min-w-0 flex-1 truncate text-sm'>
											<span class='font-medium text-fg'>{row.athlete.full_name}</span>{' '}
											<span class='text-fg-muted'>({row.athlete.username})</span>
										</p>
										<Badge>{ROLE_LABELS[row.athlete.role]}</Badge>
									</div>
									<div class='flex w-full items-center gap-3'>
										<Meter value={row.availability} label='Disponibilidade' class='flex-1' />
										<span class='text-sm font-medium tabular-nums'>{pct(row.availability)}</span>
									</div>
									<p class='text-xs text-fg-muted tabular-nums'>
										{row.counts.going} disp. · {row.counts.notGoing} indisp.
										{props.withMaybe && row.counts.maybe
											? ` · ${row.counts.maybe} talvez`
											: ''} · {row.counts.noAnswer} sem resp. · {row.counts.expected} esperados
									</p>
								</button>
								<Show when={open() === row.athlete.id}>
									<div class='px-4 pb-3'>
										<TypeBreakdown row={row} />
									</div>
								</Show>
							</li>
						)}
					</For>
				</ul>
			</Show>
		</Card>
	);
};

const EventsTable: Component<{ rows: EventRow[]; withMaybe: boolean; onOpen: (id: number) => void }> = (props) => {
	const rows = () => [...props.rows].sort((a, b) => (a.event.start < b.event.start ? 1 : -1));
	const cells = (row: EventRow): JSX.Element => (
		<>
			<td class='px-3 text-right'>
				<Num value={row.counts.going} />
			</td>
			<td class='px-3 text-right'>
				<Num value={row.counts.notGoing} />
			</td>
			<Show when={props.withMaybe}>
				<td class='px-3 text-right'>
					<Num value={row.counts.maybe} />
				</td>
			</Show>
			<td class='px-3 text-right'>
				<Num value={row.counts.noAnswer} />
			</td>
		</>
	);

	return (
		<Card>
			<SectionHeader title='Eventos' subtitle={`${props.rows.length} eventos no período`} />
			{/* Desktop: table */}
			<div class='hidden overflow-x-auto md:block'>
				<table class='w-full text-sm'>
					<thead class='border-y border-border text-left text-xs text-fg-muted'>
						<tr>
							<th class='py-2 pr-3 pl-5 font-medium'>Data</th>
							<th class='px-3 py-2 font-medium'>Evento</th>
							<th class='px-3 py-2 text-right font-medium'>Disponível</th>
							<th class='px-3 py-2 text-right font-medium'>Indisponível</th>
							<Show when={props.withMaybe}>
								<th class='px-3 py-2 text-right font-medium'>Talvez</th>
							</Show>
							<th class='px-3 py-2 text-right font-medium'>Sem resposta</th>
							<th class='py-2 pr-5 pl-3 font-medium'>Taxa de resposta</th>
						</tr>
					</thead>
					<tbody>
						<For each={rows()}>
							{(row) => (
								<tr
									class='cursor-pointer border-b border-border transition last:border-0 hover:bg-surface-2'
									onClick={() => props.onOpen(row.event.id)}
								>
									<td class='py-2.5 pr-3 pl-5 text-fg-muted whitespace-nowrap'>
										{formatDate(row.event.start)}
									</td>
									<td class='max-w-72 px-3'>
										<button
											type='button'
											class='flex max-w-full cursor-pointer items-center gap-2 text-left'
											onClick={(e) => {
												e.stopPropagation();
												props.onOpen(row.event.id);
											}}
										>
											<TypeDot type={row.event.type} />
											<span class='truncate font-medium text-fg'>{row.event.name}</span>
										</button>
									</td>
									{cells(row)}
									<td class='pr-5 pl-3'>
										<RateCell value={row.responseRate} label='Taxa de resposta' />
									</td>
								</tr>
							)}
						</For>
					</tbody>
				</table>
			</div>

			{/* Mobile: cards */}
			<ul class='divide-y divide-border border-t border-border md:hidden'>
				<For each={rows()}>
					{(row) => (
						<li>
							<button
								type='button'
								class='flex w-full cursor-pointer flex-col gap-2 px-4 py-3 text-left'
								onClick={() => props.onOpen(row.event.id)}
							>
								<div class='flex w-full items-center gap-2'>
									<TypeDot type={row.event.type} />
									<span class='min-w-0 flex-1 truncate text-sm font-medium'>{row.event.name}</span>
									<span class='shrink-0 text-xs text-fg-muted'>{formatDate(row.event.start)}</span>
								</div>
								<div class='flex w-full items-center gap-3'>
									<Meter value={row.responseRate} label='Taxa de resposta' class='flex-1' />
									<span class='text-sm font-medium tabular-nums'>{pct(row.responseRate)}</span>
								</div>
								<p class='text-xs text-fg-muted tabular-nums'>
									{row.counts.going} disp. · {row.counts.notGoing} indisp.
									{props.withMaybe && row.counts.maybe ? ` · ${row.counts.maybe} talvez` : ''} ·{' '}
									{row.counts.noAnswer} sem resp.
								</p>
							</button>
						</li>
					)}
				</For>
			</ul>
		</Card>
	);
};
