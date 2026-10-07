// Event dates are ISO calendar dates (YYYY-MM-DD) without time or zone.
// They are only ever turned into local Date objects for display.

const DAY_MS = 86400000;
const LOCALE = 'pt-PT';

export function parseISODate(iso: string): Date {
	const [y, m, d] = iso.split('-').map(Number);
	return new Date(y, m - 1, d);
}

export function toISODate(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayISO(now = new Date()): string {
	return toISODate(now);
}

export function addDays(iso: string, days: number): string {
	const d = parseISODate(iso);
	d.setDate(d.getDate() + days);
	return toISODate(d);
}

/** Whole days from today until `iso` (negative when in the past). */
export function daysUntil(iso: string, now = new Date()): number {
	const today = parseISODate(todayISO(now));
	return Math.round((parseISODate(iso).getTime() - today.getTime()) / DAY_MS);
}

function monthShort(date: Date) {
	return new Intl.DateTimeFormat(LOCALE, { month: 'short' }).format(date).replace('.', '');
}

/** "7 fev" */
export function formatDayMonth(iso: string) {
	const d = parseISODate(iso);
	return `${d.getDate()} ${monthShort(d)}`;
}

/** "7 fev 2026" */
export function formatDate(iso: string) {
	const d = parseISODate(iso);
	return `${d.getDate()} ${monthShort(d)} ${d.getFullYear()}`;
}

/** "7 fev 2026", "7–8 fev 2026", "30 jan – 2 fev 2026", "30 dez 2025 – 2 jan 2026" */
export function formatRange(start: string, end: string) {
	if (!end || start === end) return formatDate(start);
	const s = parseISODate(start);
	const e = parseISODate(end);
	if (s.getFullYear() !== e.getFullYear()) return `${formatDate(start)} – ${formatDate(end)}`;
	if (s.getMonth() !== e.getMonth()) return `${formatDayMonth(start)} – ${formatDate(end)}`;
	return `${s.getDate()}–${e.getDate()} ${monthShort(e)} ${e.getFullYear()}`;
}

export function weekdayShort(iso: string) {
	return new Intl.DateTimeFormat(LOCALE, { weekday: 'short' }).format(parseISODate(iso)).replace('.', '');
}

export function monthShortOf(iso: string) {
	return monthShort(parseISODate(iso));
}

/** Human description of how far away a date is. */
export function relativeDays(iso: string, now = new Date()) {
	const days = daysUntil(iso, now);
	if (days === 0) return 'hoje';
	if (days === 1) return 'amanhã';
	if (days === -1) return 'ontem';
	if (days > 1) return `daqui a ${days} dias`;
	return `há ${-days} dias`;
}
