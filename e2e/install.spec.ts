import { devices, expect, test, type Page } from '@playwright/test';
import { login, USERS } from './helpers';

const installCard = (page: Page) => page.getByRole('region', { name: 'Instalar a app' });

/** Fires the event Chrome sends when the app can be installed, with a stubbed native dialog. */
async function offerInstall(page: Page, outcome: 'accepted' | 'dismissed' = 'accepted') {
	await page.evaluate((outcome) => {
		const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
			prompt: () => Promise<void>;
			userChoice: Promise<{ outcome: string }>;
		};
		event.prompt = async () => {
			(window as unknown as { __prompted: boolean }).__prompted = true;
		};
		event.userChoice = Promise.resolve({ outcome });
		window.dispatchEvent(event);
	}, outcome);
}

test.describe('Android', () => {
	// eslint-disable-next-line no-empty-pattern -- Playwright needs the fixtures pattern to reach testInfo
	test.beforeEach(({}, info) => test.skip(info.project.name !== 'mobile', 'Pixel 7 project only'));

	test('shows the menu steps, then the native install button once the browser offers it', async ({ page }) => {
		await login(page, USERS.fed);
		const card = installCard(page);
		await expect(card.getByRole('list', { name: 'Como instalar no Android' })).toContainText('Instalar app');
		// Only one invitation at a time: notifications wait until the app is installed
		await expect(page.getByRole('button', { name: 'Ativar notificações' })).toHaveCount(0);

		await offerInstall(page);
		await card.getByRole('button', { name: 'Instalar' }).click();
		expect(await page.evaluate(() => (window as unknown as { __prompted?: boolean }).__prompted)).toBe(true);
		await expect(page.getByText('App instalada.', { exact: false })).toBeVisible();
		await expect(card).toHaveCount(0);
	});

	test('dismissing hides the card across reloads; the account menu still offers it', async ({ page }) => {
		await login(page, USERS.cpt);
		await installCard(page).getByRole('button', { name: 'Agora não' }).click();
		await expect(installCard(page)).toHaveCount(0);
		await page.reload();
		await expect(page.getByRole('heading', { name: /Olá/ })).toBeVisible();
		await expect(installCard(page)).toHaveCount(0);

		await page.getByRole('button', { name: 'Conta' }).click();
		await page.getByRole('dialog', { name: 'Conta' }).getByRole('button', { name: 'Instalar app' }).click();
		await expect(page.getByRole('dialog', { name: 'Instalar a app' })).toContainText('menu ⋮');
	});

	test('nothing to install when already running as the installed app', async ({ page }) => {
		await page.addInitScript(() => {
			const original = window.matchMedia.bind(window);
			window.matchMedia = (query: string) =>
				query.includes('display-mode: standalone')
					? ({ ...original(query), matches: true, media: query } as MediaQueryList)
					: original(query);
		});
		await login(page, USERS.fed);
		await expect(page.getByRole('heading', { name: /Olá/ })).toBeVisible();
		await expect(installCard(page)).toHaveCount(0);
		await page.getByRole('button', { name: 'Conta' }).click();
		await expect(
			page.getByRole('dialog', { name: 'Conta' }).getByRole('button', { name: 'Instalar app' })
		).toHaveCount(0);
	});
});

test.describe('iPhone', () => {
	const { userAgent, viewport, deviceScaleFactor, isMobile, hasTouch } = devices['iPhone 14'];
	test.use({ userAgent, viewport, deviceScaleFactor, isMobile, hasTouch });
	// eslint-disable-next-line no-empty-pattern -- Playwright needs the fixtures pattern to reach testInfo
	test.beforeEach(({}, info) => test.skip(info.project.name !== 'mobile', 'runs once'));

	test('explains Share → Adicionar ao ecrã principal, with no install button', async ({ page }) => {
		await login(page, USERS.cpt);
		const card = installCard(page);
		await expect(card).toContainText('No iPhone, as notificações só funcionam na app instalada.');
		const steps = card.getByRole('list', { name: 'Como instalar no iPhone' });
		await expect(steps).toContainText('Partilhar');
		await expect(steps).toContainText('Adicionar ao ecrã principal');
		await expect(card.getByRole('button', { name: 'Instalar' })).toHaveCount(0);
	});
});

test('desktop browsers get no install card', async ({ page }, info) => {
	test.skip(info.project.name !== 'desktop', 'desktop project only');
	await login(page, USERS.fed);
	await expect(page.getByRole('heading', { name: /Olá/ })).toBeVisible();
	await offerInstall(page);
	await expect(installCard(page)).toHaveCount(0);
});
