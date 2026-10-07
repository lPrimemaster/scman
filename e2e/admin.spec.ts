import { expect, test } from '@playwright/test';
import { login, logout, unique, USERS, PASSWORD } from './helpers';

const isoIn = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

test('admin creates, edits and deletes an event with an attachment', async ({ page }, info) => {
	const name = unique(info, 'Evento');
	await login(page, USERS.admin);
	await page.goto('/admin/events');
	await page.getByRole('button', { name: 'Novo evento' }).click();

	const form = page.getByRole('dialog', { name: 'Novo evento' });
	await form.getByLabel('Nome').fill(name);
	await form.getByLabel('Local').fill('Sesimbra');
	await form.getByLabel('Tipo').selectOption({ label: 'Prova Federada' });
	await form.getByLabel('Início').fill(isoIn(20));
	await form.getByLabel('Fim').fill(isoIn(21));
	await form.getByLabel('Limite de inscrição').fill(isoIn(15));
	await form.getByLabel('Custo (€)').fill('7,5');
	await form.getByLabel('Descrição').fill('Uma descrição.');
	await form.getByTestId('file-input').setInputFiles({
		name: 'regulamento.pdf',
		mimeType: 'application/pdf',
		buffer: Buffer.from('%PDF-1.4 test')
	});
	await expect(form.getByText('regulamento.pdf')).toBeVisible();
	await expect(form.getByText(/A enviar/)).toHaveCount(0);
	await page.getByRole('button', { name: 'Criar evento' }).click();
	await expect(page.getByText('Evento criado.')).toBeVisible();

	// Detail shows price and attachment
	await page
		.getByRole('button', { name: new RegExp(name) })
		.first()
		.click();
	const detail = page.getByRole('dialog', { name });
	await expect(detail.getByText('7,50 €')).toBeVisible();
	await expect(detail.getByRole('button', { name: 'regulamento.pdf' })).toBeVisible();
	await detail.getByRole('button', { name: 'Fechar' }).click();

	// Edit
	const row = page.getByRole('listitem').filter({ hasText: name });
	await row.getByRole('button', { name: 'Editar' }).click();
	const edit = page.getByRole('dialog', { name: 'Editar evento' });
	await edit.getByLabel('Nome').fill(`${name} v2`);
	await page.getByRole('button', { name: 'Guardar alterações' }).click();
	await expect(page.getByText('Evento editado.')).toBeVisible();
	await expect(page.getByText(`${name} v2`)).toBeVisible();

	// Delete
	await page
		.getByRole('listitem')
		.filter({ hasText: `${name} v2` })
		.getByRole('button', { name: 'Apagar' })
		.click();
	await page.getByRole('dialog', { name: 'Apagar evento?' }).getByRole('button', { name: 'Apagar' }).click();
	await expect(page.getByText('Evento apagado.')).toBeVisible();
	await expect(page.getByText(`${name} v2`)).toHaveCount(0);
});

test('invite → activate → signed in', async ({ page }, info) => {
	const username = unique(info, 'novo');
	await login(page, USERS.admin);
	await page.goto('/admin/register');
	await page.getByLabel('Nome completo').fill('Novo Atleta');
	await page.getByLabel('Utilizador').fill(username);
	await page.getByLabel('Permissão').selectOption({ label: 'Federado' });
	await page.getByRole('button', { name: 'Criar convite' }).click();

	const link = await page.getByLabel('Link de ativação').inputValue();
	expect(link).toMatch(/\/activate\?token=[0-9a-f]{64}$/);
	await expect(page.getByRole('listitem').filter({ hasText: username })).toContainText('Espera ativação');
	await logout(page);

	await page.goto(link);
	await expect(page.getByLabel('Utilizador')).toHaveValue(username);
	await page.getByLabel('Password', { exact: true }).fill('novapass1');
	await page.getByLabel('Confirmar password').fill('outra');
	await page.getByRole('button', { name: 'Ativar conta' }).click();
	await expect(page.getByText('As passwords não coincidem.')).toBeVisible();
	await page.getByLabel('Confirmar password').fill('novapass1');
	await page.getByRole('button', { name: 'Ativar conta' }).click();
	await expect(page).toHaveURL('/');
	await expect(page.getByRole('heading', { name: /Olá, Novo/ })).toBeVisible();

	// The link cannot be reused
	await logout(page);
	await page.goto(link);
	await expect(page.getByText('Este link já foi utilizado.')).toBeVisible();
});

test('admin generates a password reset link', async ({ page, browser }, info) => {
	const username = unique(info, 'reset');
	await login(page, USERS.admin);
	await page.goto('/admin/register');
	await page.getByLabel('Nome completo').fill('Reset Atleta');
	await page.getByLabel('Utilizador').fill(username);
	await page.getByLabel('Permissão').selectOption({ label: 'CPT' });
	await page.getByRole('button', { name: 'Criar convite' }).click();
	const invite = await page.getByLabel('Link de ativação').inputValue();

	const other = await browser.newPage();
	await other.goto(invite);
	await other.getByLabel('Password', { exact: true }).fill(PASSWORD);
	await other.getByLabel('Confirmar password').fill(PASSWORD);
	await other.getByRole('button', { name: 'Ativar conta' }).click();
	await expect(other).toHaveURL('/');
	await other.close();

	await page.goto('/admin/manage');
	await page.getByPlaceholder(/Pesquisar/).fill(username);
	await page.getByRole('button', { name: new RegExp(username) }).click();
	await page.getByRole('button', { name: 'Gerar link de reset' }).click();
	const reset = await page.getByLabel('Link de reset').inputValue();
	expect(reset).toMatch(/\/reset_password\?token=/);

	const user = await browser.newPage();
	await user.goto(reset);
	await user.getByLabel('Password', { exact: true }).fill('resetada1');
	await user.getByLabel('Confirmar password').fill('resetada1');
	await user.getByRole('button', { name: 'Definir password' }).click();
	await expect(user).toHaveURL('/');
	await user.close();
});

test('admin sees attendance statistics', async ({ page }) => {
	await login(page, USERS.admin);
	await page.goto('/admin');
	await page.getByRole('link', { name: /Estatísticas/ }).click();
	await expect(page).toHaveURL(/\/admin\/stats$/);

	// The seed has answers spread over the last ~7 months
	await page.getByLabel('Período').selectOption({ label: 'Últimos 12 meses' });
	await expect(page.getByRole('meter', { name: 'Taxa de resposta' }).first()).toBeVisible();
	await expect(page.getByRole('group', { name: 'Respostas por tipo de evento' })).toBeVisible();
	await expect(page.getByRole('group', { name: /por mês/ })).toBeVisible();

	// CPT athletes cannot see federated events: those filters are disabled
	await page.getByRole('radio', { name: 'CPT' }).click();
	const types = page.getByRole('group', { name: 'Tipos de evento' });
	await expect(types.getByRole('button', { name: 'Prova Federada' })).toBeDisabled();
	await expect(types.getByRole('button', { name: 'Prova CPT' })).toBeEnabled();

	// Athlete rows expand into a per-type breakdown (cards on mobile, table on desktop)
	const athlete = page
		.getByRole('button', { name: /Rui Pinto/ })
		.filter({ visible: true })
		.first();
	await athlete.click();
	await expect(athlete).toHaveAttribute('aria-expanded', 'true');
	await expect(page.getByText('Estágio Aberto', { exact: true }).filter({ visible: true }).last()).toBeVisible();

	// Event rows open the event dialog
	await page.getByRole('radio', { name: 'Todos' }).click();
	await page
		.getByRole('button', { name: /Prova CPT Almada/ })
		.filter({ visible: true })
		.first()
		.click();
	await expect(page.getByRole('dialog', { name: 'Prova CPT Almada' })).toBeVisible();
});
