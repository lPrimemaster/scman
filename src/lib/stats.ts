import type { AttendanceStats, EventType, Role, StatsAthlete, StatsEvent } from './types';
import { ALL_EVENT_TYPES, canSeeEventType, OPEN_EVENT_TYPES } from './events';

export type AthleteGroup = 'all' | Role;

export interface StatsFilters {
	types: EventType[];
	group: AthleteGroup;
	/** Future events have mostly no answers yet, so they are left out by default */
	includeFuture: boolean;
	today: string;
}

export interface Counts {
	going: number;
	maybe: number;
	notGoing: number;
	noAnswer: number;
	/** Athletes expected to answer: the sum of the four above */
	expected: number;
}

export interface EventRow {
	event: StatsEvent;
	counts: Counts;
	responseRate: number | null;
}

export interface AthleteRow {
	athlete: StatsAthlete;
	counts: Counts;
	availability: number | null;
	lastAnswer: string | null;
	byType: Partial<Record<EventType, Counts>>;
}

export interface MonthBucket {
	/** YYYY-MM */
	month: string;
	going: Record<EventType, number>;
	events: number;
}

export interface StatsSummary {
	kpis: {
		events: number;
		expected: number;
		answered: number;
		going: number;
		responseRate: number | null;
		availability: number | null;
		athletesAnswered: number;
	};
	byType: Array<{ type: EventType; counts: Counts }>;
	byMonth: MonthBucket[];
	events: EventRow[];
	athletes: AthleteRow[];
}

export const emptyCounts = (): Counts => ({ going: 0, maybe: 0, notGoing: 0, noAnswer: 0, expected: 0 });

/** `part / total`, or null when there is nothing to divide. */
export const ratio = (part: number, total: number) => (total > 0 ? part / total : null);

export const answered = (c: Counts) => c.going + c.maybe + c.notGoing;

/** Event types that matter for an athlete group. */
export function typesForGroup(group: AthleteGroup): EventType[] {
	return group === 'cpt' ? OPEN_EVENT_TYPES : ALL_EVENT_TYPES;
}

/**
 * Whether an athlete was expected to answer an event: they could see it, the account
 * was usable and they had already joined. Anyone who answered counts regardless.
 */
export function isExpected(athlete: StatsAthlete, event: StatsEvent, hasAnswer: boolean) {
	if (hasAnswer) return true;
	return (
		canSeeEventType(athlete.role, event.type) &&
		athlete.active &&
		!athlete.disabled &&
		(!athlete.joined || athlete.joined <= event.start)
	);
}

function tally(counts: Counts, status: number | undefined) {
	counts.expected++;
	if (status === 1) counts.going++;
	else if (status === 2) counts.maybe++;
	else if (status === 0) counts.notGoing++;
	else counts.noAnswer++;
}

const monthOf = (iso: string) => iso.slice(0, 7);

/** Every month from `first` to `last` (YYYY-MM), so empty months still show. */
export function monthsBetween(first: string, last: string): string[] {
	const months: string[] = [];
	let [y, m] = first.split('-').map(Number);
	const [ly, lm] = last.split('-').map(Number);
	while (y < ly || (y === ly && m <= lm)) {
		months.push(`${y}-${String(m).padStart(2, '0')}`);
		if (++m > 12) {
			m = 1;
			y++;
		}
	}
	return months;
}

const zeroByType = (): Record<EventType, number> => ({ 0: 0, 1: 0, 2: 0, 3: 0 });

export function summarize(data: AttendanceStats, filters: StatsFilters): StatsSummary {
	const allowedTypes = typesForGroup(filters.group).filter((t) => filters.types.includes(t));
	const events = data.events.filter(
		(e) => allowedTypes.includes(e.type) && (filters.includeFuture || e.start <= filters.today)
	);
	const athletes = data.athletes.filter((a) => filters.group === 'all' || a.role === filters.group);

	const answers = new Map<string, { status: number; updated_at: string }>();
	for (const r of data.responses) answers.set(`${r.user_id}:${r.event_id}`, r);

	const eventRows = new Map<number, EventRow>(
		events.map((event) => [event.id, { event, counts: emptyCounts(), responseRate: null }])
	);
	const athleteRows = new Map<number, AthleteRow>(
		athletes.map((athlete) => [
			athlete.id,
			{ athlete, counts: emptyCounts(), availability: null, lastAnswer: null, byType: {} }
		])
	);
	const typeCounts = new Map<EventType, Counts>(allowedTypes.map((t) => [t, emptyCounts()]));

	// Month axis: the selected range, narrowed to the events when the range is open-ended
	const starts = events.map((e) => e.start).sort();
	const lastDay = filters.includeFuture ? data.to : data.to < filters.today ? data.to : filters.today;
	const firstMonth = data.from > '0001-01-01' ? monthOf(data.from) : starts.length ? monthOf(starts[0]) : null;
	const lastMonth = lastDay < '9999-12-31' ? monthOf(lastDay) : starts.length ? monthOf(starts.at(-1)!) : null;
	const months = new Map<string, MonthBucket>(
		(firstMonth && lastMonth ? monthsBetween(firstMonth, lastMonth) : []).map((month) => [
			month,
			{ month, going: zeroByType(), events: 0 }
		])
	);

	for (const event of events) {
		const eventRow = eventRows.get(event.id)!;
		const bucket = months.get(monthOf(event.start));
		if (bucket) bucket.events++;

		for (const athlete of athletes) {
			const answer = answers.get(`${athlete.id}:${event.id}`);
			if (!isExpected(athlete, event, !!answer)) continue;

			const row = athleteRows.get(athlete.id)!;
			tally(eventRow.counts, answer?.status);
			tally(row.counts, answer?.status);
			tally((row.byType[event.type] ??= emptyCounts()), answer?.status);
			tally(typeCounts.get(event.type)!, answer?.status);
			if (answer?.status === 1 && bucket) bucket.going[event.type]++;
			if (answer && (!row.lastAnswer || answer.updated_at > row.lastAnswer)) row.lastAnswer = answer.updated_at;
		}
		eventRow.responseRate = ratio(answered(eventRow.counts), eventRow.counts.expected);
	}

	const athleteList = [...athleteRows.values()].filter((r) => r.counts.expected > 0);
	for (const row of athleteList) row.availability = ratio(row.counts.going, row.counts.expected);

	const total = emptyCounts();
	for (const c of typeCounts.values()) {
		total.going += c.going;
		total.maybe += c.maybe;
		total.notGoing += c.notGoing;
		total.noAnswer += c.noAnswer;
		total.expected += c.expected;
	}

	return {
		kpis: {
			events: events.length,
			expected: total.expected,
			answered: answered(total),
			going: total.going,
			responseRate: ratio(answered(total), total.expected),
			availability: ratio(total.going, total.expected),
			athletesAnswered: athleteList.filter((r) => answered(r.counts) > 0).length
		},
		byType: allowedTypes.map((type) => ({ type, counts: typeCounts.get(type)! })),
		byMonth: [...months.values()],
		events: [...eventRows.values()],
		athletes: athleteList
	};
}

/** Presets for the period filter. `to` is inclusive. */
export function periodRange(preset: 'year' | '12m' | 'lastYear' | 'all', today: string) {
	const year = Number(today.slice(0, 4));
	switch (preset) {
		case 'year':
			return { from: `${year}-01-01`, to: `${year}-12-31` };
		case 'lastYear':
			return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` };
		case '12m': {
			const [, m, d] = today.split('-');
			return { from: `${year - 1}-${m}-${d === '29' && m === '02' ? '28' : d}`, to: today };
		}
		case 'all':
			return {};
	}
}
