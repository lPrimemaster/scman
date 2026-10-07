import { describe, expect, it } from 'vitest';
import { changesLeftLabel, deadlineState, formatPrice, responseBlockReason } from './events';
import { autoUsername } from './username';
import type { MyEventState } from './types';

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
