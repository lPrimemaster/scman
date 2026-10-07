import crypto from 'node:crypto';
import { expect, test } from '@playwright/test';
import { apiToken, createActiveUser, login, unique } from './helpers';

// Playwright's default headless shell has no notification support; the full Chromium build does
test.use({ channel: 'chromium' });

test.describe('installable web app', () => {
	test('manifest, service worker and installability', async ({ page, request }) => {
		const manifest = await (await request.get('/manifest.webmanifest')).json();
		expect(manifest).toMatchObject({ name: 'Seixal Clube 1925', start_url: '/', display: 'standalone' });
		for (const icon of manifest.icons) {
			const res = await request.get(icon.src);
			expect(res.ok(), icon.src).toBeTruthy();
			expect(res.headers()['content-type']).toBe('image/png');
		}

		await page.goto('/login');
		const state = await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state);
		expect(state).toBe('activated');

		// Chrome's own install checks (manifest, icons, service worker, secure context)
		const cdp = await page.context().newCDPSession(page);
		const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
		// Playwright contexts are incognito-like, which Chrome never offers to install from; anything else is ours
		expect(installabilityErrors.filter((e) => e.errorId !== 'in-incognito')).toEqual([]);
	});

	test('the service worker shows pushed messages as notifications', async ({ page, context }) => {
		await context.grantPermissions(['notifications']);
		await page.goto('/login');
		await page.evaluate(() => navigator.serviceWorker.ready);

		// Deliver a push message straight to the worker, as the browser's push service would
		const cdp = await context.newCDPSession(page);
		const registrationId = await new Promise<string>((resolve) => {
			cdp.on('ServiceWorker.workerRegistrationUpdated', ({ registrations }) => {
				const reg = registrations.find((r) => r.scopeURL.endsWith('/') && !r.isDeleted);
				if (reg) resolve(reg.registrationId);
			});
			void cdp.send('ServiceWorker.enable');
		});
		const deliver = () =>
			cdp.send('ServiceWorker.deliverPushMessage', {
				origin: new URL(page.url()).origin,
				registrationId,
				data: JSON.stringify({
					title: 'Evento alterado: Volta',
					body: 'Local: Évora → Beja',
					url: '/?event=3',
					tag: 'e2e'
				})
			});
		const shown = () =>
			page.evaluate(async () => {
				const reg = await navigator.serviceWorker.ready;
				return (await reg.getNotifications()).map((n) => ({ title: n.title, body: n.body, data: n.data }));
			});

		// The worker may still be starting when the first message arrives; re-deliver until it shows.
		// The tag makes a repeat replace the earlier notification instead of adding another.
		await expect
			.poll(async () => {
				const list = await shown();
				if (list.length === 0) await deliver();
				return list;
			})
			.toEqual([{ title: 'Evento alterado: Volta', body: 'Local: Évora → Beja', data: { url: '/?event=3' } }]);
	});

	test('enabling notifications registers this device on the server', async ({ page, context, request }, info) => {
		const username = unique(info, 'push');
		await createActiveUser(request, username);

		// Headless Chromium has no push service: stand in for it with a subscription carrying real
		// encryption keys, so the server can encrypt and attempt delivery (which then fails: no such host)
		const ecdh = crypto.createECDH('prime256v1');
		ecdh.generateKeys();
		const keys = {
			p256dh: ecdh.getPublicKey().toString('base64url'),
			auth: crypto.randomBytes(16).toString('base64url')
		};
		const endpoint = `https://push.invalid/e2e/${username}`;
		await context.grantPermissions(['notifications']);
		await page.addInitScript(
			({ endpoint, keys }) => {
				let current: PushSubscription | null = null;
				const make = () =>
					({
						endpoint,
						options: { applicationServerKey: null },
						toJSON: () => ({ endpoint, keys }),
						unsubscribe: async () => {
							current = null;
							return true;
						}
					}) as unknown as PushSubscription;
				PushManager.prototype.subscribe = async () => (current = make());
				PushManager.prototype.getSubscription = async () => current;
			},
			{ endpoint, keys }
		);

		await login(page, username);
		await page.getByRole('button', { name: 'Conta' }).click();
		const account = page.getByRole('dialog', { name: 'Conta' });
		await account.getByRole('button', { name: 'Ativar' }).click();
		await expect(page.getByText('Notificações ativadas neste dispositivo.')).toBeVisible();
		await expect(account.getByText('Ativas neste dispositivo.')).toBeVisible();

		// The server has the subscription and tries to deliver to it
		const token = await apiToken(request, username);
		const res = await request.post('/api/push/test', { headers: { Authorization: `Bearer ${token}` } });
		expect(await res.json()).toMatchObject({ sent: 0, failed: 1 });

		// Turning it off removes it from the server
		await account.getByRole('button', { name: 'Desativar' }).click();
		await expect(account.getByRole('button', { name: 'Ativar' })).toBeVisible();
		const after = await request.post('/api/push/test', { headers: { Authorization: `Bearer ${token}` } });
		expect(await after.json()).toMatchObject({ sent: 0, failed: 0 });
	});
});
