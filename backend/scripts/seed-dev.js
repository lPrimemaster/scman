// Seeds a fresh development / e2e database. Refuses to touch an existing file.
// Usage: yarn seed-dev /tmp/dev.db
import fs from 'node:fs';
import bcrypt from 'bcrypt';
import { openDb, createRepo } from '../src/db.js';
import { serializeEventFiles } from '../src/lib/eventFiles.js';

export const SEED_PASSWORD = 'password123';

export async function seed(repo) {
	const hash = await bcrypt.hash(SEED_PASSWORD, 4);
	const users = [
		['admin', 'Ana Admin', 'admin'],
		['f.rider', 'Filipe Federado', 'federado'],
		['c.rider', 'Carla Cpt', 'cpt']
	];
	for (const [username, full_name, role] of users) {
		const id = repo.users.create({ username, full_name, role });
		repo.users.activate(id, hash);
	}

	const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
	const events = [
		['Prova CPT Seixal', 'Seixal', 10, 11, 5, 0, '0'],
		['Estágio Aberto Serra', 'Serra da Estrela', 20, 22, 12, 1, '15.00'],
		['Volta ao Alentejo', 'Évora', 14, 15, 7, 2, '10.00'],
		['Taça de Portugal', 'Anadia', 30, 30, 25, 2, '0'],
		['Estágio Federado Algarve', 'Lagos', 40, 44, 30, 3, '120.00'],
		['Prova Antiga', 'Lisboa', -30, -30, -35, 2, '0']
	];
	for (const [name, location, s, e, l, type, price] of events) {
		repo.events.create({
			name,
			location,
			start: day(s),
			end: day(e),
			sub_limit_date: day(l),
			change_limit: 3,
			type,
			price,
			description: `Descrição de ${name}.`,
			files: serializeEventFiles([])
		});
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const file = process.argv[2] || process.env.DB_PATH;
	if (!file) {
		console.error('Usage: yarn seed-dev <new-db-path>');
		process.exit(1);
	}
	if (fs.existsSync(file)) {
		console.error(`${file} already exists. Refusing to seed an existing database.`);
		process.exit(1);
	}
	await seed(createRepo(openDb(file)));
	console.log(`Seeded ${file}. Users: admin, f.rider, c.rider — password '${SEED_PASSWORD}'.`);
}
