import { describe, expect, it } from 'vitest';
import type { AttendanceStats, StatsAthlete, StatsEvent } from './types';
import { isExpected, monthsBetween, periodRange, summarize, type StatsFilters } from './stats';

const athlete = (id: number, role: StatsAthlete['role'], extra: Partial<StatsAthlete> = {}): StatsAthlete => ({
	id,
	full_name: `A${id}`,
	username: `a${id}`,
	role,
	active: true,
	disabled: false,
	joined: null,
	...extra
});
const event = (id: number, type: StatsEvent['type'], start: string): StatsEvent => ({
	id,
	name: `E${id}`,
	start,
	end: start,
	type
});

const fed = athlete(1, 'federado');
const cpt = athlete(2, 'cpt');
const late = athlete(3, 'federado', { joined: '2026-03-01' });
const disabled = athlete(4, 'cpt', { disabled: true });
const admin = athlete(5, 'admin');

const data: AttendanceStats = {
	from: '2026-01-01',
	to: '2026-12-31',
	events: [
		event(10, 0, '2026-01-10'),
		event(11, 2, '2026-02-10'),
		event(12, 1, '2026-04-05'),
		event(13, 0, '2026-11-01')
	],
	athletes: [fed, cpt, late, disabled, admin],
	responses: [
		{ user_id: 1, event_id: 10, status: 1, updated_at: '2026-01-05 10:00:00' },
		{ user_id: 2, event_id: 10, status: 0, updated_at: '2026-01-06 10:00:00' },
		{ user_id: 4, event_id: 10, status: 1, updated_at: '2026-01-07 10:00:00' },
		{ user_id: 1, event_id: 11, status: 2, updated_at: '2026-02-01 10:00:00' },
		{ user_id: 3, event_id: 12, status: 1, updated_at: '2026-04-01 10:00:00' },
		{ user_id: 1, event_id: 12, status: 1, updated_at: '2026-04-02 10:00:00' }
	]
};

const filters = (f: Partial<StatsFilters> = {}): StatsFilters => ({
	types: [0, 1, 2, 3],
	group: 'all',
	includeFuture: false,
	today: '2026-10-07',
	...f
});

describe('isExpected', () => {
	it('follows role visibility, account state and join date', () => {
		expect(isExpected(cpt, event(1, 2, '2026-05-01'), false)).toBe(false);
		expect(isExpected(cpt, event(1, 1, '2026-05-01'), false)).toBe(true);
		expect(isExpected(late, event(1, 2, '2026-02-01'), false)).toBe(false);
		expect(isExpected(late, event(1, 2, '2026-03-01'), false)).toBe(true);
		expect(isExpected(disabled, event(1, 0, '2026-05-01'), false)).toBe(false);
		expect(isExpected(athlete(9, 'cpt', { active: false }), event(1, 0, '2026-05-01'), false)).toBe(false);
	});

	it('always counts someone who answered', () => {
		expect(isExpected(disabled, event(1, 0, '2026-05-01'), true)).toBe(true);
	});
});

describe('summarize', () => {
	it('counts answers per event over the expected athletes', () => {
		const s = summarize(data, filters());
		expect(s.kpis.events).toBe(3); // the November event is in the future
		const byId = Object.fromEntries(s.events.map((r) => [r.event.id, r.counts]));
		// fed going, cpt not going, disabled answered going, admin no answer; late had not joined
		expect(byId[10]).toEqual({ going: 2, maybe: 0, notGoing: 1, noAnswer: 1, expected: 4 });
		// type 2: only fed (maybe) and admin; cpt athletes are not expected
		expect(byId[11]).toEqual({ going: 0, maybe: 1, notGoing: 0, noAnswer: 1, expected: 2 });
		// type 1: late joined by then; disabled cpt without answer is not expected
		expect(byId[12]).toEqual({ going: 2, maybe: 0, notGoing: 0, noAnswer: 2, expected: 4 });
		expect(s.kpis.expected).toBe(10);
		expect(s.kpis.responseRate).toBeCloseTo(6 / 10);
		expect(s.kpis.availability).toBeCloseTo(4 / 10);
	});

	it('builds per-athlete rows with a per-type breakdown', () => {
		const s = summarize(data, filters());
		const f = s.athletes.find((r) => r.athlete.id === 1)!;
		expect(f.counts).toEqual({ going: 2, maybe: 1, notGoing: 0, noAnswer: 0, expected: 3 });
		expect(f.availability).toBeCloseTo(2 / 3);
		expect(f.lastAnswer).toBe('2026-04-02 10:00:00');
		expect(Object.keys(f.byType).sort()).toEqual(['0', '1', '2']);
		const c = s.athletes.find((r) => r.athlete.id === 2)!;
		// No federated types for cpt athletes
		expect(Object.keys(c.byType).sort()).toEqual(['0', '1']);
	});

	it('filters by group and event type', () => {
		const cptOnly = summarize(data, filters({ group: 'cpt' }));
		expect(cptOnly.byType.map((t) => t.type)).toEqual([0, 1]);
		expect(cptOnly.athletes.map((r) => r.athlete.id).sort()).toEqual([2, 4]);

		const races = summarize(data, filters({ types: [2] }));
		expect(races.events.map((r) => r.event.id)).toEqual([11]);
		expect(races.byType).toHaveLength(1);
	});

	it('includes future events on request', () => {
		expect(summarize(data, filters({ includeFuture: true })).kpis.events).toBe(4);
	});

	it('buckets Disponível answers by month and type, keeping empty months', () => {
		const s = summarize(data, filters());
		expect(s.byMonth.map((m) => m.month)).toEqual(monthsBetween('2026-01', '2026-10'));
		const jan = s.byMonth[0];
		expect(jan.going[0]).toBe(2);
		expect(jan.events).toBe(1);
		expect(s.byMonth[2]).toMatchObject({ month: '2026-03', events: 0 });
		expect(s.byMonth[3].going[1]).toBe(2);
	});

	it('has no rates when nothing is expected', () => {
		const s = summarize({ ...data, events: [] }, filters());
		expect(s.kpis.responseRate).toBeNull();
		expect(s.athletes).toEqual([]);
	});
});

describe('periods', () => {
	it('builds ranges from presets', () => {
		expect(periodRange('year', '2026-10-07')).toEqual({ from: '2026-01-01', to: '2026-12-31' });
		expect(periodRange('lastYear', '2026-10-07')).toEqual({ from: '2025-01-01', to: '2025-12-31' });
		expect(periodRange('12m', '2026-10-07')).toEqual({ from: '2025-10-07', to: '2026-10-07' });
		expect(monthsBetween('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
	});
});
