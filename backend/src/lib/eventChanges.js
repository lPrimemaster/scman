import { parseEventFiles } from './eventFiles.js';

const monthShort = (date) =>
	new Intl.DateTimeFormat('pt-PT', { month: 'short', timeZone: 'UTC' }).format(date).replace('.', '');

const parse = (iso) => new Date(`${iso}T00:00:00Z`);

/** "12 out", "12–13 out", "30 set – 2 out" (event dates are ISO, read as UTC). */
export function formatDayRange(start, end) {
	const s = parse(start);
	const e = parse(end || start);
	if (!end || start === end) return `${s.getUTCDate()} ${monthShort(s)}`;
	if (s.getUTCMonth() === e.getUTCMonth() && s.getUTCFullYear() === e.getUTCFullYear()) {
		return `${s.getUTCDate()}–${e.getUTCDate()} ${monthShort(e)}`;
	}
	return `${s.getUTCDate()} ${monthShort(s)} – ${e.getUTCDate()} ${monthShort(e)}`;
}

const price = (p) => (Number(p) > 0 ? `${Number(p).toFixed(2)} €` : 'gratuito');

/**
 * Human summary of what an edit changed, for the notification body. Empty when nothing
 * athletes care about changed.
 * @param {object} before event row before the edit
 * @param {object} after event row after the edit
 * @returns {string[]}
 */
export function describeEventChanges(before, after) {
	const changes = [];
	if (before.name !== after.name) changes.push(`Nome: ${before.name} → ${after.name}`);
	if (before.start !== after.start || before.end !== after.end) {
		changes.push(`Data: ${formatDayRange(before.start, before.end)} → ${formatDayRange(after.start, after.end)}`);
	}
	if (before.location !== after.location) changes.push(`Local: ${before.location} → ${after.location}`);
	if (before.sub_limit_date !== after.sub_limit_date) {
		changes.push(
			`Inscrições até: ${formatDayRange(before.sub_limit_date)} → ${formatDayRange(after.sub_limit_date)}`
		);
	}
	if (Number(before.price) !== Number(after.price))
		changes.push(`Custo: ${price(before.price)} → ${price(after.price)}`);
	if ((before.description ?? '') !== (after.description ?? '')) changes.push('Descrição atualizada');
	const files = (row) =>
		parseEventFiles(row.files)
			.map((f) => f.handle)
			.sort()
			.join(',');
	if (files(before) !== files(after)) changes.push('Anexos atualizados');
	return changes;
}
