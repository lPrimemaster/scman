import 'dotenv/config';

export const DEV_SECRET = 'dev-secret';

export function loadConfig(env = process.env) {
	return {
		dbPath: env.DB_PATH || 'database.db',
		secret: env.JWT_SECRET || DEV_SECRET,
		port: Number(env.PORT || 4200),
		uploadDir: env.UPLOAD_DIR || 'uploads/',
		vapid: {
			publicKey: env.VAPID_PUBLIC_KEY,
			privateKey: env.VAPID_PRIVATE_KEY,
			subject: env.VAPID_SUBJECT || 'mailto:admin@sc1925.pt'
		},
		paypal: {
			base: env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com',
			clientId: env.PAYPAL_CLIENT_ID,
			clientSecret: env.PAYPAL_CLIENT_SECRET
		}
	};
}

export function logConfig(config) {
	console.log('Setting environment:');
	console.log(`DB_PATH: ${config.dbPath}`);
	console.log(`SECRET_PROD: ${config.secret !== DEV_SECRET}`);
	console.log(`PORT: ${config.port}`);
	console.log(`UPLOAD_DIR: ${config.uploadDir}`);

	if (config.secret === DEV_SECRET) {
		console.warn('WARNING: JWT_SECRET is not set. Using the insecure development secret.');
	}
}
