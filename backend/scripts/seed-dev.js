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
		['c.rider', 'Carla Cpt', 'cpt'],
		['j.silva', 'João Silva', 'federado'],
		['m.costa', 'Marta Costa', 'federado'],
		['r.pinto', 'Rui Pinto', 'cpt'],
		['s.alves', 'Sofia Alves', 'cpt']
	];
	const ids = {};
	for (const [username, full_name, role] of users) {
		const id = repo.users.create({ username, full_name, role });
		repo.users.activate(id, hash);
		ids[username] = { id, role };
	}

	const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
	const events = [
		['Prova CPT Seixal', 'Seixal', 10, 11, 5, 0, '0'],
		['Estágio Aberto Serra', 'Serra da Estrela', 20, 22, 12, 1, '15.00'],
		['Volta ao Alentejo', 'Évora', 14, 15, 7, 2, '10.00'],
		['Taça de Portugal', 'Anadia', 30, 30, 25, 2, '0'],
		['Estágio Federado Algarve', 'Lagos', 40, 44, 30, 3, '120.00'],
		['Prova Antiga', 'Lisboa', -30, -30, -35, 2, '0'],
		// Past events with answers, for the statistics page
		['Prova CPT Almada', 'Almada', -200, -200, -205, 0, '0'],
		['Clássica da Primavera', 'Torres Vedras', -170, -170, -175, 2, '0'],
		['Estágio Aberto Sintra', 'Sintra', -140, -138, -150, 1, '20.00'],
		['Volta ao Algarve Júnior', 'Tavira', -110, -108, -120, 2, '0'],
		['Prova CPT Barreiro', 'Barreiro', -80, -80, -85, 0, '0'],
		['Estágio Federado Gerês', 'Gerês', -50, -46, -60, 3, '90.00'],
		['Prova CPT Moita', 'Moita', -12, -12, -17, 0, '0']
	];
	const past = [];
	for (const [name, location, s, e, l, type, price] of events) {
		const id = repo.events.create({
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
		if (s < 0) past.push({ id, type });
	}

	// Deterministic answers: Disponível, Indisponível, no answer, and a legacy "Talvez"
	const pattern = [1, 1, 0, null, 1, 2, 1, 0, null, 1, 1];
	let k = 0;
	for (const event of past) {
		for (const { id, role } of Object.values(ids)) {
			if (role === 'cpt' && event.type >= 2) continue;
			const status = pattern[k++ % pattern.length];
			if (status !== null) repo.responses.upsert(id, event.id, status);
		}
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
