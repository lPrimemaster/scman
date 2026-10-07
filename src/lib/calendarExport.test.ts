import { describe, expect, it } from 'vitest';
import { buildICS, googleCalendarUrl, safeFileName } from './calendarExport';

const event = {
	name: 'Volta, ao; Alentejo',
	start: '2026-02-07',
	end: '2026-02-08',
	location: 'Évora',
	type: 2 as const
};

describe('calendar export', () => {
	it('builds an all-day ICS with exclusive end and escaped text', () => {
		const ics = buildICS(event, 'uid-1@sc1925', new Date(Date.UTC(2026, 0, 1, 12, 30, 0)));
		const lines = ics.split('\r\n');
		expect(lines).toContain('DTSTART;VALUE=DATE:20260207');
		expect(lines).toContain('DTEND;VALUE=DATE:20260209');
		expect(lines).toContain('SUMMARY:[SC1925] Volta\\, ao\\; Alentejo');
		expect(lines).toContain('DTSTAMP:20260101T123000Z');
		expect(lines).toContain('DESCRIPTION:Prova Federada');
		expect(lines[0]).toBe('BEGIN:VCALENDAR');
	});

	it('builds a Google Calendar template link', () => {
		const url = new URL(googleCalendarUrl({ ...event, end: '2026-02-28' }));
		expect(url.searchParams.get('dates')).toBe('20260207/20260301');
		expect(url.searchParams.get('text')).toBe('[SC1925] Volta, ao; Alentejo');
		expect(url.searchParams.get('location')).toBe('Évora');
	});

	it('sanitizes file names', () => {
		expect(safeFileName('a/b:c?.ics')).toBe('a_b_c_.ics');
	});
});
