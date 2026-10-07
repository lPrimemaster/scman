import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSameName, nameSimilarity, normalizeText, raceMatchScore, tokens } from '../src/lib/similarity.js';

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

test('isSameName ignores case, accents, punctuation and spacing', () => {
	assert.ok(isSameName('Prova do Seixal', ' prova  do SEIXAL!'));
	assert.ok(isSameName('Taça Évora', 'taca evora'));
	assert.ok(!isSameName('Prova do Seixal', 'Prova do Seixal 2'));
	assert.ok(!isSameName('', ''));
});

test('names made only of generic words still match', () => {
	// "cpt" and "prova" are generic words, so these used to have nothing to compare
	assert.equal(nameSimilarity('cpt', 'CPT'), 1);
	assert.ok(nameSimilarity('Prova 1', 'prova 1') === 1);
	assert.ok(nameSimilarity('Prova CPT', 'Prova CPT Moita') < THRESHOLD, 'generic words alone are not a match');
});

test('partial input and typos match', () => {
	assert.ok(nameSimilarity('Prova CPT Seixal', 'Sei') >= THRESHOLD);
	assert.ok(nameSimilarity('Prova CPT Seixal', 'Seixl') >= THRESHOLD);
	assert.ok(nameSimilarity('Prova CPT Moita', 'Prova CPT Barreiro') < THRESHOLD);
});
