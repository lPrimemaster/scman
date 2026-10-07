import { expect, test, type Page } from '@playwright/test';
import { createActiveUser, login, unique, USERS } from './helpers';

/** A home page card (event lists repeat: "Por responder" plus one card per type). */
const card = (page: Page, title: string) => page.getByRole('region', { name: title });

test('federated users see federated and open events, not past ones', async ({ page }) => {
	await login(page, USERS.fed);
	await expect(page.getByRole('heading', { name: 'Próximas provas federadas' })).toBeVisible();
	await expect(
		card(page, 'Próximas provas federadas').getByRole('button', { name: /Volta ao Alentejo/ })
	).toBeVisible();
	await expect(
		card(page, 'Próximos estágios federados').getByRole('button', { name: /Estágio Federado Algarve/ })
	).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Próximas provas CPT' })).toBeVisible();
	await expect(card(page, 'Próximas provas CPT').getByRole('button', { name: /Prova CPT Seixal/ })).toBeVisible();
	await expect(
		card(page, 'Próximos estágios abertos').getByRole('button', { name: /Estágio Aberto Serra/ })
	).toBeVisible();
	await expect(page.getByText('Prova Antiga')).toHaveCount(0);
});

test('cpt users see open events but no federated lists on the home page', async ({ page }) => {
	await login(page, USERS.cpt);
	await expect(page.getByRole('heading', { name: 'Próximas provas CPT' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Próximos estágios abertos' })).toBeVisible();
	await expect(card(page, 'Próximas provas CPT').getByRole('button', { name: /Prova CPT Seixal/ })).toBeVisible();
	await expect(
		card(page, 'Próximos estágios abertos').getByRole('button', { name: /Estágio Aberto Serra/ })
	).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Próximas provas federadas' })).toHaveCount(0);
	await expect(page.getByText('Volta ao Alentejo')).toHaveCount(0);
});

test('answering an event updates the participants list', async ({ page, request }, info) => {
	// A fresh user so both projects start from "no answer"
	const username = unique(info, 'rsvp');
	await createActiveUser(request, username);
	await login(page, username);

	const races = card(page, 'Próximas provas federadas');
	await races.getByRole('button', { name: /Volta ao Alentejo/ }).click();
	const dialog = page.getByRole('dialog', { name: 'Volta ao Alentejo' });
	await expect(dialog).toBeVisible();
	await expect(dialog.getByText('Évora').first()).toBeVisible();

	await dialog.getByRole('button', { name: /^Disponível$/ }).click();
	await expect(page.getByText('Resposta registada.')).toBeVisible();
	await expect(dialog.getByRole('button', { name: /^Disponível$/ })).toHaveAttribute('aria-pressed', 'true');
	await expect(dialog.getByRole('tabpanel')).toContainText(`Teste ${username} (${username})`);
	await expect(dialog.getByRole('button', { name: 'Google Calendar' })).toBeVisible();

	// Back button closes the dialog; the list shows the new status
	await page.goBack();
	await expect(dialog).toBeHidden();
	await expect(races.getByRole('button', { name: /Volta ao Alentejo/ })).toContainText('Disponível');
	await expect(card(page, 'Por responder').getByText('Volta ao Alentejo')).toHaveCount(0, { timeout: 5000 });
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

	// The footer keeps its bottom padding (it used to collapse to the safe-area inset, 0).
	// 8, not 12: the dialog may still be finishing its scale-in animation
	const formBox = (await form.boundingBox())!;
	const submitBox = (await form.getByRole('button', { name: 'Criar prova' }).boundingBox())!;
	expect(formBox.y + formBox.height - (submitBox.y + submitBox.height)).toBeGreaterThanOrEqual(8);

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
	await expect(card(page, 'Próximas provas CPT').getByRole('button', { name: new RegExp(name) })).toBeVisible();
});

test('creating a race suggests an existing one with a similar name', async ({ page }) => {
	await login(page, USERS.cpt);
	await page.getByRole('button', { name: 'Nova prova' }).click();
	const form = page.getByRole('dialog', { name: 'Nova prova CPT' });

	const name = form.getByRole('combobox', { name: 'Nome' });
	await name.fill('GP do Seixal');
	const list = form.getByRole('listbox', { name: 'Provas existentes' });
	await expect(list.getByRole('option', { name: /Prova CPT Seixal/ })).toBeVisible();

	// Escape only closes the list; typing brings it back
	await name.press('Escape');
	await expect(list).toHaveCount(0);
	await expect(form).toBeVisible();
	await name.pressSequentially(' ');
	await expect(list).toBeVisible();

	// Arrow down + Enter opens the existing race
	await name.press('ArrowDown');
	await name.press('Enter');

	await expect(page.getByRole('dialog', { name: 'Prova CPT Seixal' })).toBeVisible();
	await expect(form).toHaveCount(0);
});

test('exact race names are blocked, similar ones can still be created', async ({ page }, info) => {
	const isoIn = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
	await login(page, USERS.cpt);
	await page.getByRole('button', { name: 'Nova prova' }).click();
	const form = page.getByRole('dialog', { name: 'Nova prova CPT' });
	const name = form.getByRole('combobox', { name: 'Nome' });
	const submit = form.getByRole('button', { name: 'Criar prova' });

	// Partial input already suggests the existing race
	await name.fill('Sei');
	await expect(form.getByRole('option', { name: /Prova CPT Seixal/ })).toBeVisible();

	// Same name (ignoring case and accents): blocked, with a link to the existing race
	await name.fill('prova cpt SEIXAL');
	await expect(form.getByRole('alert')).toContainText('Já existe uma prova com este nome');
	await expect(submit).toBeDisabled();

	// A similar name is only a suggestion: it can be ignored
	const similar = unique(info, 'Noturna do Seixal');
	await name.fill(similar);
	await expect(form.getByRole('option', { name: /Prova CPT Seixal/ })).toBeVisible();
	await expect(submit).toBeEnabled();
	await form.getByLabel('Local').fill('Seixal');
	await form.getByLabel('Data').fill(isoIn(26));
	await submit.click();
	await expect(page.getByRole('dialog', { name: similar })).toBeVisible();
});
