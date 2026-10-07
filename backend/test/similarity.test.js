import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSameRace, nameSimilarity, normalizeText, raceMatchScore, tokens } from '../src/lib/similarity.js';

const THRESHOLD = 0.45;

test('normalizeText ignores accents, case and punctuation', () => {
	assert.equal(normalizeText('  Taça  Évora-Já! '), 'taca evora ja');
});

test('tokens drop stopwords, generic race words and years', () => {
	assert.deepEqual(tokens('Prova do Seixal 2026'), ['seixal']);
	assert.deepEqual(tokens('GP Cidade de Almada'), ['cidade', 'almada']);
});

test('variants of the same race name match', () => {
	for (const [a, b] of [
		['Prova do Seixal', 'GP Seixal 2026'],
		['Prova do Seixal', 'seixal'],
		['Circuito Seixalense', 'Seixal']
	]) {
		assert.ok(nameSimilarity(a, b) >= THRESHOLD, `${a} ~ ${b}`);
	}
	assert.ok(nameSimilarity('Prova do Seixal', 'Prova de Évora') < THRESHOLD);
	assert.equal(nameSimilarity('Prova', 'GP'), 0, 'only generic words never match');
});

test('race score: only given fields count, a close date raises it', () => {
	const race = { name: 'Prova CPT Seixal', location: 'Seixal', start: '2026-10-17' };
	assert.equal(raceMatchScore(race, { name: 'Seixal' }), 1);
	assert.ok(raceMatchScore(race, { name: 'Évora' }) < THRESHOLD);

	const far = raceMatchScore(race, { name: 'Seixal Amora', start: '2026-12-01' });
	const near = raceMatchScore(race, { name: 'Seixal Amora', start: '2026-10-18' });
	assert.ok(near > far);
});

test('isSameRace compares the normalized name and the start date', () => {
	const a = { name: 'Prova do Seixal', start: '2026-10-17' };
	assert.ok(isSameRace(a, { name: 'prova do seixal ', start: '2026-10-17' }));
	assert.ok(!isSameRace(a, { name: 'Prova do Seixal', start: '2026-10-18' }));
});
