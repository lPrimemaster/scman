import { DAY_MS, isoDateToEpoch } from './dates.js';

// Words that appear in most race names and say nothing about which race it is
const STOPWORDS = new Set(
	'de da do das dos e a o em na no prova provas corrida gp grande premio taca circuito cpt'.split(' ')
);

export function normalizeText(s = '') {
	return s
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

export function tokens(s) {
	return normalizeText(s)
		.split(' ')
		.filter((w) => w.length >= 2 && !/^\d{4}$/.test(w) && !STOPWORDS.has(w));
}

// Same word, or one starts with the other (min. 4 chars): "seixal" ~ "seixalense"
const wordsMatch = (a, b) => a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)));

/** Dice coefficient over meaningful words, from 0 to 1. */
export function nameSimilarity(a, b) {
	const ta = [...new Set(tokens(a))];
	const tb = [...new Set(tokens(b))];
	if (ta.length === 0 || tb.length === 0) return 0;
	const common = ta.filter((x) => tb.some((y) => wordsMatch(x, y))).length;
	return (2 * common) / (ta.length + tb.length);
}

const DATE_WINDOW_DAYS = 7;

function dateProximity(a, b) {
	const days = Math.abs(isoDateToEpoch(a) - isoDateToEpoch(b)) / DAY_MS;
	return Math.max(0, 1 - days / DATE_WINDOW_DAYS);
}

/**
 * How likely `candidate` is the race described by `query`, from 0 to 1.
 * Only the fields given in the query count, so typing just a name still matches.
 */
export function raceMatchScore(candidate, { name, location, start }) {
	const parts = [[0.6, nameSimilarity(candidate.name, name)]];
	if (location?.trim()) parts.push([0.2, nameSimilarity(candidate.location, location)]);
	if (start) parts.push([0.2, dateProximity(candidate.start, start)]);
	const total = parts.reduce((sum, [w]) => sum + w, 0);
	return parts.reduce((sum, [w, v]) => sum + w * v, 0) / total;
}

export function isSameRace(a, b) {
	return a.start === b.start && normalizeText(a.name) === normalizeText(b.name);
}
