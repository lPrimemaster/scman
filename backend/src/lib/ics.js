import { DAY_MS, isoDateToEpoch } from './dates.js';

const TYPE_LABELS = ['Prova CPT', 'Estágio Aberto', 'Prova Federada', 'Estágio Federado'];
const STATUS_LABELS = { 0: 'Indisponível', 1: 'Disponível', 2: 'Talvez' };

// RFC 5545 text escaping
export function escapeText(text = '') {
	return String(text)
		.replace(/\\/g, '\\\\')
		.replace(/\r?\n/g, '\\n')
		.replace(/;/g, String.raw`\;`)
		.replace(/,/g, '\\,');
}

// Lines longer than 75 octets continue on the next line after a space, without splitting characters
export function foldLine(line) {
	const encoder = new TextEncoder();
	if (encoder.encode(line).length <= 75) return line;
	const parts = [];
	let current = '';
	let size = 0;
	for (const char of line) {
		const bytes = encoder.encode(char).length;
		const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
		if (size + bytes > limit) {
			parts.push(current);
			current = '';
			size = 0;
		}
		current += char;
		size += bytes;
	}
	parts.push(current);
	return parts.join('\r\n ');
}

const compactDate = (iso) => iso.replaceAll('-', '');
const nextDay = (iso) => new Date(isoDateToEpoch(iso) + DAY_MS).toISOString().slice(0, 10);
const stamp = (now) =>
	new Date(now)
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}/, '');

/**
 * A subscribable calendar of club events. All-day events; the end date is exclusive.
 * UIDs are stable per event, so calendar apps update events in place when they change.
 * @param {{ events: object[], statuses: Map<number, {status: number}>, name: string, now: number }} input
 */
export function buildCalendar({ events, statuses, name, now }) {
	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//SC1925//SCMan//PT',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		`X-WR-CALNAME:${escapeText(name)}`,
		'X-WR-TIMEZONE:Europe/Lisbon',
		'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
		'X-PUBLISHED-TTL:PT6H'
	];
	for (const e of events) {
		const status = statuses.get(e.id)?.status;
		const description = [
			TYPE_LABELS[e.type],
			`Inscrições até ${e.sub_limit_date.split('-').reverse().join('/')}`,
			status !== undefined ? `A tua resposta: ${STATUS_LABELS[status]}` : 'Ainda não respondeste.'
		].join('\n');
		lines.push(
			'BEGIN:VEVENT',
			`UID:event-${e.id}@sc1925`,
			`DTSTAMP:${stamp(now)}`,
			`DTSTART;VALUE=DATE:${compactDate(e.start)}`,
			`DTEND;VALUE=DATE:${compactDate(nextDay(e.end || e.start))}`,
			`SUMMARY:${escapeText(`[SC1925] ${e.name}`)}`,
			`LOCATION:${escapeText(e.location)}`,
			`DESCRIPTION:${escapeText(description)}`,
			'TRANSP:TRANSPARENT',
			'END:VEVENT'
		);
	}
	lines.push('END:VCALENDAR');
	return lines.map(foldLine).join('\r\n') + '\r\n';
}
