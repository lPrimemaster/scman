import { loadConfig, logConfig } from './src/config.js';
import { openDb, createRepo } from './src/db.js';
import { buildApp } from './src/app.js';
import { createPushService, createWebPushSender } from './src/services/push.js';
import { createPaypalClient } from './src/services/paypal.js';
import { createStorage } from './src/services/storage.js';
import { startScheduler } from './src/services/scheduler.js';

const config = loadConfig();
logConfig(config);

const repo = createRepo(openDb(config.dbPath));
const push = createPushService({ repo, sender: createWebPushSender(config.vapid) });

const app = await buildApp({
	repo,
	push,
	paypal: createPaypalClient(config.paypal),
	storage: createStorage(config.uploadDir),
	secret: config.secret,
	vapidPublicKey: config.vapid.publicKey
});

startScheduler(repo, push);

await app.listen({ port: config.port, host: process.env.HOST || 'localhost' });
console.log(`Service running on port ${config.port}!`);
