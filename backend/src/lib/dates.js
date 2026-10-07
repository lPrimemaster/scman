export const DAY_MS = 86400000;

// Event dates are ISO `YYYY-MM-DD` strings, interpreted as UTC midnight.
export function isoDateToEpoch(date) {
	return new Date(date).getTime();
}

// Answers are accepted until the end of the limit day.
export function isDeadlinePassed(subLimitDate, now = Date.now()) {
	return isoDateToEpoch(subLimitDate) + DAY_MS < now;
}

export function utcMidnight(now = Date.now()) {
	const d = new Date(now);
	return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// Whole days from today (UTC) until the given ISO date
export function daysUntil(date, now = Date.now()) {
	return Math.round((isoDateToEpoch(date) - utcMidnight(now)) / DAY_MS);
}

export function todayISO(now = Date.now()) {
	return new Date(now).toISOString().slice(0, 10);
}

export function addDaysISO(date, days) {
	return new Date(isoDateToEpoch(date) + days * DAY_MS).toISOString().slice(0, 10);
}
