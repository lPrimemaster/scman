// Starts the backend on a freshly seeded throwaway database for end-to-end tests.
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const dir = path.join(root, '.e2e');
const db = path.join(dir, 'e2e.db');

fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
execFileSync(process.execPath, ['scripts/seed-dev.js', db], { cwd: path.join(root, 'backend'), stdio: 'inherit' });

// Fresh Web Push keys per run, so push can be exercised for real
const webpush = createRequire(path.join(root, 'backend', 'package.json'))('web-push');
const vapid = webpush.generateVAPIDKeys();

const child = spawn(process.execPath, ['index.js'], {
	cwd: path.join(root, 'backend'),
	stdio: 'inherit',
	env: {
		...process.env,
		DB_PATH: db,
		PORT: process.env.E2E_PORT ?? '4310',
		UPLOAD_DIR: path.join(dir, 'uploads'),
		JWT_SECRET: 'e2e-secret',
		VAPID_PUBLIC_KEY: vapid.publicKey,
		VAPID_PRIVATE_KEY: vapid.privateKey,
		VAPID_SUBJECT: 'mailto:e2e@sc1925.test'
	}
});

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
child.on('exit', (code) => process.exit(code ?? 0));
