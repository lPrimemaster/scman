import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setup, iso } from './helpers.js';
import { escapeText, foldLine } from '../src/lib/ics.js';

let t, fed, cpt;
beforeEach(async () => {
	t = await setup();
	fed = t.addUser('fed', 'federado');
	cpt = t.addUser('cpt', 'cpt');
});
afterEach(() => t.cleanup());

const feedOf = async (user) => (await t.request(user, 'GET', '/api/calendar/feed')).body.path;
const fetchFeed = (path) => t.app.inject({ method: 'GET', url: path });

test('the feed URL is stable until regenerated', async () => {
	const first = await feedOf(fed);
	assert.match(first, /^\/api\/calendar\/[a-f0-9]{48}\.ics$/);
	assert.equal(await feedOf(fed), first);
	assert.notEqual(await feedOf(cpt), first);

	const { path } = (await t.request(fed, 'POST', '/api/calendar/feed/regenerate')).body;
	assert.notEqual(path, first);
	assert.equal((await fetchFeed(first)).statusCode, 404, 'old link stops working');
	assert.equal((await fetchFeed(path)).statusCode, 200);
	assert.equal((await t.request(null, 'GET', '/api/calendar/feed')).status, 401);
});

test('the feed lists the events the user can see as all-day iCalendar events', async () => {
	const race = t.addEvent({ name: 'Volta, a Évora; 2026', type: 2, start: iso(10), end: iso(11) });
	t.addEvent({ name: 'CPT race', type: 0, start: iso(5), end: iso(5) });
	t.addEvent({ name: 'Old race', type: 0, start: iso(-200), end: iso(-200) });
	t.repo.responses.upsert(fed.id, race, 1);

	const res = await fetchFeed(await feedOf(fed));
	assert.equal(res.headers['content-type'], 'text/calendar; charset=utf-8');
	// Long lines are folded (CRLF + space); unfold before matching content
	const ics = res.body.replace(/\r\n /g, '');
	assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
	assert.match(ics, new RegExp(`UID:event-${race}@sc1925`));
	assert.ok(ics.includes(String.raw`SUMMARY:[SC1925] Volta\, a Évora\; 2026`), 'commas and semicolons escaped');
	assert.match(ics, new RegExp(`DTSTART;VALUE=DATE:${iso(10).replaceAll('-', '')}`));
	assert.match(ics, new RegExp(`DTEND;VALUE=DATE:${iso(12).replaceAll('-', '')}`), 'end is exclusive');
	assert.match(ics, /A tua resposta: Disponível/);
	assert.match(ics, /CPT race/);
	assert.doesNotMatch(ics, /Old race/, 'events older than 90 days are left out');

	const cptIcs = (await fetchFeed(await feedOf(cpt))).body;
	assert.doesNotMatch(cptIcs, /Volta/, 'cpt athletes do not get federated events');

	const going = (await fetchFeed(`${await feedOf(fed)}?only=going`)).body;
	assert.match(going, /Volta/);
	assert.doesNotMatch(going, /CPT race/);
});

test('feeds of disabled accounts and unknown tokens are 404', async () => {
	const path = await feedOf(fed);
	t.repo.users.setDisabled(fed.id, true);
	assert.equal((await fetchFeed(path)).statusCode, 404);
	assert.equal((await fetchFeed(`/api/calendar/${'0'.repeat(48)}.ics`)).statusCode, 404);
	assert.equal((await fetchFeed('/api/calendar/nope.ics')).statusCode, 400);
});

test('iCalendar text escaping and line folding', () => {
	assert.equal(escapeText('a,b;c\\d\ne'), String.raw`a\,b\;c\\d\ne`);
	const long = `DESCRIPTION:${'é'.repeat(60)}`;
	const folded = foldLine(long);
	for (const line of folded.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75);
	assert.equal(folded.replace(/\r\n /g, ''), long, 'unfolds back to the original');
});
