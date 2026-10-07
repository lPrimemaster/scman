import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeEventChanges, formatDayRange } from '../src/lib/eventChanges.js';

const base = {
	name: 'Volta',
	start: '2026-10-12',
	end: '2026-10-13',
	location: 'Évora',
	sub_limit_date: '2026-10-05',
	price: '10.00',
	description: 'x',
	files: 'h1[a.pdf]'
};

test('day ranges in Portuguese', () => {
	assert.equal(formatDayRange('2026-10-12', '2026-10-12'), '12 out');
	assert.equal(formatDayRange('2026-10-12', '2026-10-13'), '12–13 out');
	assert.equal(formatDayRange('2026-09-30', '2026-10-02'), '30 set – 2 out');
});

test('describes what athletes care about', () => {
	assert.deepEqual(describeEventChanges(base, { ...base }), []);
	assert.deepEqual(
		describeEventChanges(base, { ...base, start: '2026-10-14', end: '2026-10-14', location: 'Beja' }),
		['Data: 12–13 out → 14 out', 'Local: Évora → Beja']
	);
	assert.deepEqual(
		describeEventChanges(base, { ...base, price: '0', sub_limit_date: '2026-10-08', description: 'y', files: '' }),
		['Inscrições até: 5 out → 8 out', 'Custo: 10.00 € → gratuito', 'Descrição atualizada', 'Anexos atualizados']
	);
	assert.deepEqual(describeEventChanges(base, { ...base, price: '10' }), [], '10 and 10.00 are the same price');
});
