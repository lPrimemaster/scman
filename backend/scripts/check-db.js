// Read-only sanity check of a database (use a COPY of production).
// Usage: yarn check-db /path/to/copy.db
import Database from 'better-sqlite3';
import { NEW_TABLES, SCHEMA } from '../src/db.js';
import { parseEventFiles } from '../src/lib/eventFiles.js';

const file = process.argv[2];
if (!file) {
	console.error('Usage: yarn check-db <path-to-db-copy>');
	process.exit(1);
}

const expected = new Database(':memory:');
expected.exec(SCHEMA);
const actual = new Database(file, { readonly: true, fileMustExist: true });

const columns = (db, table) =>
	db
		.prepare(`pragma table_info(${table})`)
		.all()
		.map((c) => `${c.name}:${c.type}`);
const tables = (db) =>
	db
		.prepare("select name from sqlite_master where type = 'table' and name not like 'sqlite_%'")
		.all()
		.map((t) => t.name);

let problems = 0;
const fail = (msg) => {
	problems++;
	console.error(`✗ ${msg}`);
};

for (const table of tables(expected)) {
	if (!tables(actual).includes(table)) {
		// Tables added by newer releases are created on the next start; nothing else changes
		if (NEW_TABLES.includes(table)) console.log(`+ ${table} (new, will be created on start)`);
		else fail(`missing table ${table}`);
		continue;
	}
	// Column order is irrelevant: all queries use named columns
	const exp = columns(expected, table).sort().join(', ');
	const act = columns(actual, table).sort().join(', ');
	if (exp !== act) fail(`table ${table} differs:\n    expected ${exp}\n    actual   ${act}`);
	else console.log(`✓ ${table} (${actual.prepare(`select count(*) as n from ${table}`).get().n} rows)`);
}

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
for (const e of actual.prepare('select * from events').all()) {
	for (const key of ['start', 'end', 'sub_limit_date']) {
		if (!isoDate.test(e[key])) fail(`event #${e.id} has non ISO ${key}: ${e[key]}`);
	}
	if (Number.isNaN(Number(e.price))) fail(`event #${e.id} has a non numeric price: ${e.price}`);
	if (e.files && parseEventFiles(e.files).length !== e.files.split(':').length) {
		fail(`event #${e.id} has unparsable files: ${e.files}`);
	}
}

const roles = actual.prepare('select role, count(*) as n from users group by role').all();
console.log(`Users by role: ${roles.map((r) => `${r.role}=${r.n}`).join(', ')}`);
for (const r of roles) {
	if (!['admin', 'federado', 'cpt'].includes(r.role)) fail(`${r.n} user(s) with unknown role '${r.role}'`);
}

console.log(problems === 0 ? 'Database is compatible.' : `${problems} problem(s) found.`);
process.exit(problems === 0 ? 0 : 1);
