import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import solid from 'eslint-plugin-solid/configs/typescript';
import globals from 'globals';

export default tseslint.config(
	{
		ignores: ['dist/', 'android/', 'ios/', 'icons/', 'resources/', '**/node_modules/', 'backend/uploads/', 'playwright-report/', 'test-results/']
	},
	js.configs.recommended,
	{
		files: ['src/**/*.{ts,tsx}', 'e2e/**/*.ts', '*.ts'],
		extends: [...tseslint.configs.recommended],
		...solid,
		languageOptions: {
			...solid.languageOptions,
			globals: { ...globals.browser }
		},
		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
		}
	},
	{
		files: ['backend/**/*.js', '*.js', 'e2e/**/*.mjs'],
		languageOptions: {
			globals: { ...globals.node }
		},
		rules: {
			'no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
		}
	}
);
