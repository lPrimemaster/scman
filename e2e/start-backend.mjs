// Starts the backend on a freshly seeded throwaway database for end-to-end tests.
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dir = path.join(root, '.e2e');
const db = path.join(dir, 'e2e.db');

fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
execFileSync(process.execPath, ['scripts/seed-dev.js', db], { cwd: path.join(root, 'backend'), stdio: 'inherit' });

const child = spawn(process.execPath, ['index.js'], {
	cwd: path.join(root, 'backend'),
	stdio: 'inherit',
	env: {
		...process.env,
		DB_PATH: db,
		PORT: process.env.E2E_PORT ?? '4310',
		UPLOAD_DIR: path.join(dir, 'uploads'),
		JWT_SECRET: 'e2e-secret',
		FIREBASE_SERVICE_ACCOUNT: path.join(dir, 'no-firebase.json')
	}
});

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
child.on('exit', (code) => process.exit(code ?? 0));
