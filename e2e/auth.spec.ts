import { expect, test } from '@playwright/test';
import { createActiveUser, login, logout, unique, USERS, PASSWORD } from './helpers';

test('wrong credentials show an error', async ({ page }) => {
	await page.goto('/login');
	await page.getByLabel('Utilizador').fill(USERS.fed);
	await page.getByLabel('Password').fill('wrong-password');
	await page.getByRole('button', { name: 'Entrar' }).click();
	await expect(page.getByText('Credenciais inválidas.')).toBeVisible();
});

test('signed-out users are sent to login', async ({ page }) => {
	await page.goto('/calendar');
	await expect(page).toHaveURL(/\/login$/);
});

test('login, session persists across reloads, logout', async ({ page }) => {
	await login(page, USERS.fed);
	await expect(page.getByRole('heading', { name: /Olá, Filipe/ })).toBeVisible();
	await page.reload();
	await expect(page.getByRole('heading', { name: /Olá, Filipe/ })).toBeVisible();
	await logout(page);
	await page.goto('/');
	await expect(page).toHaveURL(/\/login$/);
});

test('non admins cannot open admin pages', async ({ page }) => {
	await login(page, USERS.fed);
	await page.goto('/admin/manage');
	await expect(page).toHaveURL('/');
});

test('a disabled user is signed out and cannot log in', async ({ page, request }, info) => {
	const username = unique(info, 'dis');
	const id = await createActiveUser(request, username);
	await login(page, username);

	// Admin disables the account through the UI in another page
	const admin = await page.context().browser()!.newPage();
	await login(admin, USERS.admin);
	await admin.goto('/admin/manage');
	await admin.getByPlaceholder(/Pesquisar/).fill(username);
	await admin.getByRole('button', { name: new RegExp(username) }).click();
	await admin.getByRole('button', { name: 'Desativar conta' }).click();
	await admin.getByRole('dialog', { name: 'Desativar conta?' }).getByRole('button', { name: 'Desativar' }).click();
	await expect(admin.getByText('Conta desativada.')).toBeVisible();
	await admin.close();

	await page.reload();
	await expect(page).toHaveURL(/\/login$/);
	await page.getByLabel('Utilizador').fill(username);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Entrar' }).click();
	await expect(page.getByText('Conta desativada por um administrador.')).toBeVisible();
	expect(id).toBeGreaterThan(0);
});
