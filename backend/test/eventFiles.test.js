import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEventFiles, serializeEventFiles } from '../src/lib/eventFiles.js';

test('parses the legacy files format', () => {
	assert.deepEqual(parseEventFiles('a-1[Regulamento.pdf]:b-2[Mapa (v2).png]'), [
		{ handle: 'a-1', name: 'Regulamento.pdf' },
		{ handle: 'b-2', name: 'Mapa (v2).png' }
	]);
	assert.deepEqual(parseEventFiles(''), []);
	assert.deepEqual(parseEventFiles(null), []);
});

test('tolerates bare handles found in older rows', () => {
	assert.deepEqual(parseEventFiles('019d95f7-1f3f-738a-8e8f-d6303f10a0fd'), [
		{ handle: '019d95f7-1f3f-738a-8e8f-d6303f10a0fd', name: 'Anexo' }
	]);
});

test('round trips and sanitizes separators in names', () => {
	const files = [{ handle: 'h', name: 'a:b[c].pdf' }];
	const str = serializeEventFiles(files);
	assert.equal(str, 'h[a_b_c_.pdf]');
	assert.deepEqual(parseEventFiles(str), [{ handle: 'h', name: 'a_b_c_.pdf' }]);
	assert.equal(serializeEventFiles([]), '');
});
