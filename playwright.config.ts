import { defineConfig, devices } from '@playwright/test';

const BACKEND_PORT = 4310;
const FRONTEND_PORT = 3100;

export default defineConfig({
	testDir: 'e2e',
	fullyParallel: false,
	workers: 1, // tests share one seeded database
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL: `http://localhost:${FRONTEND_PORT}`,
		locale: 'pt-PT',
		timezoneId: 'Europe/Lisbon',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	projects: [
		{ name: 'desktop', use: { ...devices['Desktop Chrome'] } },
		{ name: 'mobile', use: { ...devices['Pixel 7'] } }
	],
	webServer: [
		{
			command: 'node e2e/start-backend.mjs',
			url: `http://localhost:${BACKEND_PORT}/api/auth/me`,
			env: { E2E_PORT: String(BACKEND_PORT) },
			reuseExistingServer: false,
			stdout: 'pipe'
		},
		{
			command: `vite --port ${FRONTEND_PORT} --strictPort`,
			url: `http://localhost:${FRONTEND_PORT}`,
			env: { VITE_API_TARGET: `http://localhost:${BACKEND_PORT}` },
			reuseExistingServer: !process.env.CI
		}
	]
});
