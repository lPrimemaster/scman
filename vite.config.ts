/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import devtools from 'solid-devtools/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

const useHttps = process.env.VITE_DEV_HTTPS === '1';
const isTest = process.env.VITEST === 'true';

export default defineConfig({
	plugins: [...(isTest ? [] : [devtools()]), solidPlugin(), tailwindcss(), ...(useHttps ? [basicSsl()] : [])],
	server: {
		port: 3000,
		host: true,
		proxy: {
			'/api': {
				target: process.env.VITE_API_TARGET ?? 'http://localhost:4200',
				changeOrigin: true
			}
		}
	},
	build: {
		target: 'esnext'
	},
	resolve: {
		conditions: isTest ? ['development', 'browser'] : []
	},
	test: {
		environment: 'jsdom',
		globals: true,
		include: ['src/**/*.test.{ts,tsx}'],
		server: { deps: { inline: [/solid-js/, /@solidjs/] } }
	}
});
