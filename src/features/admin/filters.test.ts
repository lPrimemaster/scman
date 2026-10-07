import { describe, expect, it } from 'vitest';
import { filterUsers } from './UsersPage';
import { filterEvents } from './EventsAdmin';
import { normalizePrice } from '../events/EventForm';
import type { EventItem, ManagedUser } from '../../lib/types';

describe('admin filters', () => {
	const users: ManagedUser[] = [
		{ id: 1, username: 'j.goncalves', full_name: 'João Gonçalves', role: 'federado', status: 'active' },
		{ id: 2, username: 'a.sa', full_name: 'Ana Sá', role: 'cpt', status: 'disabled' }
	];

	it('filters users ignoring accents and case', () => {
		expect(filterUsers(users, 'goncalves').map((u) => u.id)).toEqual([1]);
		expect(filterUsers(users, 'SÁ').map((u) => u.id)).toEqual([2]);
		expect(filterUsers(users, 'desativada').map((u) => u.id)).toEqual([2]);
		expect(filterUsers(users, '').length).toBe(2);
	});

	const ev = (id: number, start: string, end = start): EventItem => ({
		id,
		name: `E${id}`,
		location: id === 2 ? 'Évora' : 'Seixal',
		start,
		end,
		sub_limit_date: start,
		change_limit: 1,
		type: 2,
		price: '0',
		description: '',
		files: []
	});

	it('filters past events and sorts by date', () => {
		const list = [ev(1, '2026-03-01'), ev(2, '2026-02-01'), ev(3, '2025-01-01')];
		expect(filterEvents(list, '', false, '2026-01-15').map((e) => e.id)).toEqual([2, 1]);
		expect(filterEvents(list, '', true, '2026-01-15').map((e) => e.id)).toEqual([1, 2, 3]);
		expect(filterEvents(list, 'évora', true, '2026-01-15').map((e) => e.id)).toEqual([2]);
	});

	it('keeps ongoing events visible', () => {
		expect(filterEvents([ev(1, '2026-01-10', '2026-01-20')], '', false, '2026-01-15')).toHaveLength(1);
	});

	it('normalizes prices', () => {
		expect(normalizePrice('12')).toBe('12.00');
		expect(normalizePrice('12,5')).toBe('12.50');
		expect(normalizePrice('')).toBe('0.00');
		expect(normalizePrice('abc')).toBeNull();
		expect(normalizePrice('1.234')).toBeNull();
	});
});
