import { expect, test, type Page } from '@playwright/test';
import { createActiveUser, login, logout, PASSWORD, unique, USERS } from './helpers';

const card = (page: Page, title: string) => page.getByRole('region', { name: title });

test('pending events can be answered straight from the home page', async ({ page, request }, info) => {
	const username = unique(info, 'pending');
	await createActiveUser(request, username);
	await login(page, username);

	const pending = card(page, 'Por responder');
	await expect(pending.getByText('Volta ao Alentejo')).toBeVisible();
	await pending
		.getByRole('group', { name: 'Responder a Volta ao Alentejo' })
		.getByRole('button', { name: 'Disponível', exact: true })
		.click();
	await expect(page.getByText('Resposta registada.')).toBeVisible();

	// It leaves the to-do card and the list row shows the answer
	await expect(pending.getByText('Volta ao Alentejo')).toHaveCount(0);
	const row = card(page, 'Próximas provas federadas').getByRole('group', { name: 'Responder a Volta ao Alentejo' });
	await expect(row.getByRole('button', { name: 'Disponível', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('the event location opens in maps and the forecast shows', async ({ page }) => {
	// Keep the test offline: answer Open-Meteo with fixed data
	const today = new Date().toISOString().slice(0, 10);
	await page.route('https://geocoding-api.open-meteo.com/**', (route) =>
		route.fulfill({ json: { results: [{ latitude: 38.64, longitude: -9.1, name: 'Seixal' }] } })
	);
	await page.route('https://api.open-meteo.com/**', (route) => {
		const url = new URL(route.request().url());
		const from = url.searchParams.get('start_date') ?? today;
		return route.fulfill({
			json: {
				daily: {
					time: [from],
					weather_code: [63],
					temperature_2m_max: [19],
					temperature_2m_min: [12],
					precipitation_probability_max: [80],
					wind_speed_10m_max: [25]
				}
			}
		});
	});

	await login(page, USERS.cpt);
	await card(page, 'Próximas provas CPT')
		.getByRole('button', { name: /Prova CPT Seixal/ })
		.click();
	const dialog = page.getByRole('dialog', { name: 'Prova CPT Seixal' });

	const map = dialog.getByRole('link', { name: /Seixal \(abrir no mapa\)/ });
	await expect(map).toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=Seixal');
	await expect(map).toHaveAttribute('target', '_blank');

	const weather = dialog.getByRole('region', { name: 'Previsão do tempo' });
	await expect(weather).toContainText('Chuva');
	await expect(weather).toContainText('19°');
	await expect(weather).toContainText('80%');
	await expect(weather.getByRole('link', { name: 'Open-Meteo' })).toBeVisible();
});

test('athletes change their own password', async ({ page, request }, info) => {
	const username = unique(info, 'pwd');
	await createActiveUser(request, username);
	await login(page, username);

	await page.getByRole('button', { name: 'Conta' }).click();
	await page.getByRole('button', { name: 'Alterar password' }).click();
	const dialog = page.getByRole('dialog', { name: 'Alterar password' });
	await dialog.getByLabel('Password atual').fill('wrong-one');
	await dialog.getByLabel('Nova password', { exact: true }).fill('nova-pass-1');
	await dialog.getByLabel('Confirmar nova password').fill('nova-pass-1');
	await dialog.getByRole('button', { name: 'Guardar' }).click();
	await expect(dialog.getByText('Password atual incorreta.')).toBeVisible();
	await expect(page).not.toHaveURL(/login/); // a wrong password must not sign the user out

	await dialog.getByLabel('Password atual').fill(PASSWORD);
	await dialog.getByRole('button', { name: 'Guardar' }).click();
	await expect(page.getByText('Password alterada.')).toBeVisible();

	await logout(page);
	await login(page, username, 'nova-pass-1');
});

test('the calendar can be subscribed with a personal feed', async ({ page, request }) => {
	await login(page, USERS.fed);
	await page.goto('/calendar');
	await page.getByRole('button', { name: 'Subscrever' }).click();
	const dialog = page.getByRole('dialog', { name: 'Subscrever calendário' });

	const link = dialog.getByRole('textbox', { name: 'Link do calendário' });
	await expect(link).toHaveValue(/\/api\/calendar\/[a-f0-9]{48}\.ics$/);
	const url = await link.inputValue();
	await expect(dialog.getByRole('link', { name: 'Abrir no calendário' })).toHaveAttribute('href', /^webcal:\/\//);
	await expect(dialog.getByRole('link', { name: 'Google Calendar' })).toHaveAttribute(
		'href',
		/^https:\/\/calendar\.google\.com\/calendar\/r\?cid=webcal/
	);

	const feed = await request.get(new URL(url).pathname);
	expect(feed.headers()['content-type']).toContain('text/calendar');
	const ics = await feed.text();
	expect(ics).toContain('BEGIN:VCALENDAR');
	expect(ics).toContain('Volta ao Alentejo');

	await dialog.getByText('Só eventos em que estou disponível').click();
	await expect(link).toHaveValue(/\?only=going$/);
});
