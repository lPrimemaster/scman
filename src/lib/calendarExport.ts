import type { EventItem } from './types';
import { addDays } from './dates';
import { EVENT_TYPES } from './events';

type ExportableEvent = Pick<EventItem, 'name' | 'start' | 'end' | 'location' | 'type'>;

const compact = (iso: string) => iso.replaceAll('-', '');
const title = (e: ExportableEvent) => `[SC1925] ${e.name}`;

/** All-day events: the end date is exclusive in both Google Calendar and iCalendar. */
export function googleCalendarUrl(event: ExportableEvent) {
	const params = new URLSearchParams({
		action: 'TEMPLATE',
		text: title(event),
		dates: `${compact(event.start)}/${compact(addDays(event.end || event.start, 1))}`,
		details: EVENT_TYPES[event.type]?.label ?? '',
		location: event.location
	});
	return `https://calendar.google.com/calendar/render?${params}`;
}

function escapeICS(text = '') {
	return text.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
}

function icsTimestamp(date: Date) {
	return date
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}/, '');
}

export function buildICS(event: ExportableEvent, uid: string, now = new Date()) {
	const stamp = icsTimestamp(now);
	return [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//SC1925//SCMan//PT',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		'BEGIN:VEVENT',
		`UID:${uid}`,
		`DTSTAMP:${stamp}`,
		`CREATED:${stamp}`,
		`LAST-MODIFIED:${stamp}`,
		`SUMMARY:${escapeICS(title(event))}`,
		`DTSTART;VALUE=DATE:${compact(event.start)}`,
		`DTEND;VALUE=DATE:${compact(addDays(event.end || event.start, 1))}`,
		`LOCATION:${escapeICS(event.location)}`,
		`DESCRIPTION:${escapeICS(EVENT_TYPES[event.type]?.label)}`,
		'END:VEVENT',
		'END:VCALENDAR'
	].join('\r\n');
}

export function safeFileName(name: string) {
	// eslint-disable-next-line no-control-regex
	return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 80);
}

export function downloadICS(event: ExportableEvent) {
	const blob = new Blob([buildICS(event, `${crypto.randomUUID()}@sc1925`)], { type: 'text/calendar;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `${safeFileName(event.name)}.ics`;
	a.click();
	URL.revokeObjectURL(url);
}

export function openGoogleCalendar(event: ExportableEvent) {
	window.open(googleCalendarUrl(event), '_blank', 'noopener');
}
