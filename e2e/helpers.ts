import { expect, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';

export const PASSWORD = 'password123';
export const USERS = { admin: 'admin', fed: 'f.rider', cpt: 'c.rider' } as const;

export async function login(page: Page, username: string, password = PASSWORD) {
	await page.goto('/login');
	await page.getByLabel('Utilizador').fill(username);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Entrar' }).click();
	await expect(page).toHaveURL('/');
}

export async function logout(page: Page) {
	await page.getByRole('button', { name: 'Conta' }).click();
	await page.getByRole('button', { name: 'Terminar sessão' }).click();
	await expect(page).toHaveURL(/\/login$/);
}

/** A name that is unique per test run and project (both projects share the database). */
export function unique(info: TestInfo, base: string) {
	return `${base}-${info.project.name}-${Date.now().toString(36)}`;
}

export async function apiToken(request: APIRequestContext, username: string, password = PASSWORD) {
	const res = await request.post('/api/auth/login', { data: { username, password } });
	expect(res.ok()).toBeTruthy();
	return (await res.json()).token as string;
}

/** Creates and activates a user through the API, returns its id. */
export async function createActiveUser(request: APIRequestContext, username: string, role = 'federado') {
	const token = await apiToken(request, USERS.admin);
	const res = await request.post('/api/users', {
		data: { username, full_name: `Teste ${username}`, role },
		headers: { Authorization: `Bearer ${token}` }
	});
	expect(res.ok()).toBeTruthy();
	const created = await res.json();
	const act = await request.post(`/api/invites/${created.token}/activate`, { data: { password: PASSWORD } });
	expect(act.ok()).toBeTruthy();
	return created.id as number;
}
