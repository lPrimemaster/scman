import { describe, expect, it } from 'vitest';
import { addDays, daysUntil, formatDate, formatRange, relativeDays, todayISO } from './dates';

const NOW = new Date(2026, 0, 30, 15, 0); // 30 Jan 2026, local afternoon

describe('dates', () => {
	it('adds days across months and years', () => {
		expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
		expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
		expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
	});

	it('counts whole days regardless of the time of day', () => {
		expect(todayISO(NOW)).toBe('2026-01-30');
		expect(daysUntil('2026-01-30', NOW)).toBe(0);
		expect(daysUntil('2026-01-31', NOW)).toBe(1);
		expect(daysUntil('2026-01-20', NOW)).toBe(-10);
	});

	it('formats dates and ranges in pt-PT', () => {
		expect(formatDate('2026-02-07')).toMatch(/^7 fev 2026$/);
		expect(formatRange('2026-02-07', '2026-02-07')).toBe(formatDate('2026-02-07'));
		expect(formatRange('2026-02-07', '2026-02-08')).toMatch(/^7–8 fev 2026$/);
		expect(formatRange('2026-01-30', '2026-02-02')).toMatch(/^30 jan – 2 fev 2026$/);
		expect(formatRange('2025-12-30', '2026-01-02')).toMatch(/^30 dez 2025 – 2 jan 2026$/);
	});

	it('describes relative days', () => {
		expect(relativeDays('2026-01-30', NOW)).toBe('hoje');
		expect(relativeDays('2026-01-31', NOW)).toBe('amanhã');
		expect(relativeDays('2026-02-04', NOW)).toBe('daqui a 5 dias');
		expect(relativeDays('2026-01-27', NOW)).toBe('há 3 dias');
	});
});
