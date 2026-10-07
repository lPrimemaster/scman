import { describe, expect, it } from 'vitest';
import {
	canQuickAnswer,
	changesLeftLabel,
	deadlineState,
	formatPrice,
	mapsUrl,
	pendingEvents,
	responseBlockReason
} from './events';
import { autoUsername } from './username';
import type { EventItem, MyEventState } from './types';

const me = (o: Partial<MyEventState> = {}): MyEventState => ({
	status: -1,
	changesLeft: 3,
	locked: false,
	paid: false,
	deadlinePassed: false,
	canRespond: true,
	...o
});

describe('event helpers', () => {
	it('explains why answers are blocked, payment first', () => {
		expect(responseBlockReason(me())).toBeNull();
		expect(responseBlockReason(me({ paid: true, deadlinePassed: true }))).toMatch(/pago/);
		expect(responseBlockReason(me({ deadlinePassed: true, locked: true }))).toMatch(/Data limite/);
		expect(responseBlockReason(me({ locked: true }))).toMatch(/alterações/);
	});

	it('counts changes left, the first answer is free', () => {
		expect(changesLeftLabel(me({ status: -1, changesLeft: 3 }))).toBe('Podes alterar a resposta mais 2 vezes.');
		expect(changesLeftLabel(me({ status: 1, changesLeft: 1 }))).toBe('Podes alterar a resposta mais 1 vez.');
		expect(changesLeftLabel(me({ status: -1, changesLeft: 1 }))).toBe('Não poderás alterar a resposta.');
		expect(changesLeftLabel(me({ canRespond: false }))).toBeNull();
	});

	it('formats prices', () => {
		expect(formatPrice('0')).toBe('Gratuito');
		expect(formatPrice('10')).toBe('10,00 €');
		expect(formatPrice('2.5')).toBe('2,50 €');
	});

	it('classifies deadlines', () => {
		const now = new Date(2026, 0, 30);
		expect(deadlineState({ sub_limit_date: '2026-01-29' }, now)).toBe('closed');
		expect(deadlineState({ sub_limit_date: '2026-01-30' }, now)).toBe('soon');
		expect(deadlineState({ sub_limit_date: '2026-02-10' }, now)).toBe('open');
	});

	it('suggests usernames from full names', () => {
		expect(autoUsername('João Pedro Gonçalves')).toBe('j.goncalves');
		expect(autoUsername('  Ana   Sá ')).toBe('a.sa');
		expect(autoUsername('Madonna')).toBe('');
	});
});

describe('pending events and quick answers', () => {
	const now = new Date('2026-10-07T12:00:00Z');
	const ev = (o: Partial<EventItem>): EventItem => ({
		id: 1,
		name: 'E',
		location: 'L',
		start: '2026-10-20',
		end: '2026-10-20',
		sub_limit_date: '2026-10-15',
		change_limit: 2,
		type: 0,
		price: '0',
		description: '',
		files: [],
		my_status: -1,
		my_changes_left: 3,
		...o
	});

	it('lists unanswered events with an open deadline, closest deadline first', () => {
		const list = pendingEvents(
			[
				ev({ id: 1, sub_limit_date: '2026-10-20' }),
				ev({ id: 2, sub_limit_date: '2026-10-09' }),
				ev({ id: 3, my_status: 1 }),
				ev({ id: 4, sub_limit_date: '2026-10-01' })
			],
			now
		);
		expect(list.map((e) => e.id)).toEqual([2, 1]);
	});

	it('offers quick answers only while the deadline is open and changes are left', () => {
		expect(canQuickAnswer(ev({}), now)).toBe(true);
		expect(canQuickAnswer(ev({ my_changes_left: 0 }), now)).toBe(false);
		expect(canQuickAnswer(ev({ sub_limit_date: '2026-10-06' }), now)).toBe(false);
	});

	it('builds a maps link for the location', () => {
		expect(mapsUrl('Serra da Estrela')).toBe(
			'https://www.google.com/maps/search/?api=1&query=Serra%20da%20Estrela'
		);
	});
});
