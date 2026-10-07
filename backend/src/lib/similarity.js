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

// Same word, or one starts with the other (min. 3 chars): "sei" ~ "seixal" ~ "seixalense"
const wordsMatch = (a, b) => a === b || (Math.min(a.length, b.length) >= 3 && (a.startsWith(b) || b.startsWith(a)));

function wordSimilarity(ta, tb) {
	if (ta.length === 0 || tb.length === 0) return 0;
	const common = ta.filter((x) => tb.some((y) => wordsMatch(x, y))).length;
	return (2 * common) / (ta.length + tb.length);
}

function trigrams(text) {
	const padded = `  ${text} `;
	const grams = new Set();
	for (let i = 0; i < padded.length - 2; i++) grams.add(padded.slice(i, i + 3));
	return grams;
}

// Character trigrams catch typos and partial input ("Seixl", "Sei")
function trigramSimilarity(a, b) {
	if (!a || !b) return 0;
	const ga = trigrams(a);
	const gb = trigrams(b);
	let common = 0;
	for (const g of ga) if (gb.has(g)) common++;
	return (2 * common) / (ga.size + gb.size);
}

// The distinctive part of a name; when it only has generic words ("Prova CPT"), the whole name
const essence = (s) => tokens(s).join(' ') || normalizeText(s);

/** How alike two names are, from 0 to 1. */
export function nameSimilarity(a, b) {
	if (isSameName(a, b)) return 1;
	const ta = [...new Set(tokens(a))];
	const tb = [...new Set(tokens(b))];
	return Math.max(wordSimilarity(ta, tb), trigramSimilarity(essence(a), essence(b)));
}

/** Names that only differ in case, accents, punctuation or spacing. */
export function isSameName(a, b) {
	const na = normalizeText(a);
	return na !== '' && na === normalizeText(b);
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
