// Creates an active user directly in the database (bootstrap the first admin).
// Usage: DB_PATH=database.db yarn create-user
import readline from 'node:readline/promises';
import bcrypt from 'bcrypt';
import { loadConfig } from '../src/config.js';
import { openDb, createRepo } from '../src/db.js';
import { ROLES } from '../src/lib/roles.js';

export function autoUsername(fullName) {
	const names = fullName.trim().split(/\s+/);
	if (names.length < 2) return '';
	const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
	return `${strip(names[0][0])}.${strip(names[names.length - 1])}`;
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const fullName = (await rl.question('Name: ')).trim();
const suggested = autoUsername(fullName);
const username = (await rl.question(`Username${suggested ? ` (blank for '${suggested}')` : ''}: `)).trim() || suggested;
const role = (await rl.question(`Role (${ROLES.join(', ')}): `)).trim();
const password = await rl.question('Password: ');
rl.close();

if (!fullName || !username || !ROLES.includes(role) || password.length < 6) {
	console.error('Invalid input. Name, username, a valid role and a password (6+ chars) are required.');
	process.exit(1);
}

const { dbPath } = loadConfig();
const repo = createRepo(openDb(dbPath));
if (repo.users.byUsername(username)) {
	console.error(`Username '${username}' already exists.`);
	process.exit(1);
}

const id = repo.users.create({ username, full_name: fullName, role });
repo.users.activate(id, await bcrypt.hash(password, 10));
console.log(`Created user ${username} (#${id}) in ${dbPath}.`);
