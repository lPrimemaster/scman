import { describe, expect, it } from 'vitest';
import { defaultRaceDeadline } from './RaceForm';

describe('defaultRaceDeadline', () => {
	it('is 10 days before the start', () => {
		expect(defaultRaceDeadline('2026-11-20', '2026-10-07')).toBe('2026-11-10');
	});

	it('is never before today', () => {
		expect(defaultRaceDeadline('2026-10-12', '2026-10-07')).toBe('2026-10-07');
	});
});
