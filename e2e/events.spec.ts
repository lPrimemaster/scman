import { expect, test } from '@playwright/test';
import { createActiveUser, login, unique, USERS } from './helpers';

test('federated users see federated and open events, not past ones', async ({ page }) => {
	await login(page, USERS.fed);
	await expect(page.getByRole('heading', { name: 'Próximas provas federadas' })).toBeVisible();
	await expect(page.getByRole('button', { name: /Volta ao Alentejo/ })).toBeVisible();
	await expect(page.getByRole('button', { name: /Estágio Federado Algarve/ })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Próximas provas CPT' })).toBeVisible();
	await expect(page.getByRole('button', { name: /Prova CPT Seixal/ })).toBeVisible();
	await expect(page.getByRole('button', { name: /Estágio Aberto Serra/ })).toBeVisible();
	await expect(page.getByText('Prova Antiga')).toHaveCount(0);
});

test('cpt users see open events but no federated lists on the home page', async ({ page }) => {
	await login(page, USERS.cpt);
	await expect(page.getByRole('heading', { name: 'Próximas provas CPT' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Próximos estágios abertos' })).toBeVisible();
	await expect(page.getByRole('button', { name: /Prova CPT Seixal/ })).toBeVisible();
	await expect(page.getByRole('button', { name: /Estágio Aberto Serra/ })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Próximas provas federadas' })).toHaveCount(0);
	await expect(page.getByText('Volta ao Alentejo')).toHaveCount(0);
});

test('answering an event updates the participants list', async ({ page, request }, info) => {
	// A fresh user so both projects start from "no answer"
	const username = unique(info, 'rsvp');
	await createActiveUser(request, username);
	await login(page, username);

	await page.getByRole('button', { name: /Volta ao Alentejo/ }).click();
	const dialog = page.getByRole('dialog', { name: 'Volta ao Alentejo' });
	await expect(dialog).toBeVisible();
	await expect(dialog.getByText('Évora').first()).toBeVisible();

	await dialog.getByRole('button', { name: /^Disponível$/ }).click();
	await expect(page.getByText('Resposta registada.')).toBeVisible();
	await expect(dialog.getByRole('button', { name: /^Disponível$/ })).toHaveAttribute('aria-pressed', 'true');
	await expect(dialog.getByRole('tabpanel')).toContainText(`Teste ${username}`);
	await expect(dialog.getByRole('button', { name: 'Google Calendar' })).toBeVisible();

	// Back button closes the dialog; the list shows the new status
	await page.goBack();
	await expect(dialog).toBeHidden();
	await expect(page.getByRole('button', { name: /Volta ao Alentejo/ })).toContainText('Disponível');
});

test('calendar shows events and opens the detail', async ({ page }) => {
	await login(page, USERS.cpt);
	await page.goto('/calendar');
	await expect(page.getByRole('heading', { name: 'Calendário' })).toBeVisible();
	// Navigate forward until the open CPT event (in ~10 days) is visible
	const event = page.locator('.fc-event', { hasText: 'Prova CPT Seixal' }).first();
	for (let i = 0; i < 2 && !(await event.isVisible()); i++) {
		await page.getByRole('button', { name: /seguinte|next/i }).click();
	}
	await event.click();
	await expect(page.getByRole('dialog', { name: 'Prova CPT Seixal' })).toBeVisible();
	await expect(page.locator('.fc-event', { hasText: 'Volta ao Alentejo' })).toHaveCount(0);
});

test('a cpt athlete creates a CPT race without price or change limit fields', async ({ page }, info) => {
	const isoIn = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
	const name = unique(info, 'Prova Atleta');
	await login(page, USERS.cpt);

	await page.getByRole('button', { name: 'Nova prova' }).click();
	const form = page.getByRole('dialog', { name: 'Nova prova CPT' });
	await expect(form.getByLabel('Custo (€)')).toHaveCount(0);
	await expect(form.getByLabel('Máximo de alterações')).toHaveCount(0);

	await form.getByLabel('Nome').fill(name);
	await form.getByLabel('Local').fill('Amora');
	await expect(form.getByLabel('Fim')).toHaveCount(0);
	await form.getByLabel('Data').fill(isoIn(25));
	await expect(form.getByLabel('Limite de inscrição')).toHaveValue(isoIn(15));
	await form.getByRole('button', { name: 'Criar prova' }).click();

	const detail = page.getByRole('dialog', { name });
	await expect(detail).toBeVisible();
	await expect(detail.getByText('Prova CPT').first()).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
});

test('creating a race suggests an existing one with a similar name', async ({ page }) => {
	await login(page, USERS.cpt);
	await page.getByRole('button', { name: 'Nova prova' }).click();
	const form = page.getByRole('dialog', { name: 'Nova prova CPT' });

	await form.getByLabel('Nome').fill('GP do Seixal');
	await expect(form.getByText('Esta prova já existe?')).toBeVisible();
	await form.getByRole('button', { name: 'Ver Prova CPT Seixal' }).click();

	await expect(page.getByRole('dialog', { name: 'Prova CPT Seixal' })).toBeVisible();
	await expect(form).toHaveCount(0);
});
