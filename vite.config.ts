import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import devtools from 'solid-devtools/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [devtools(), solidPlugin(), tailwindcss(), basicSsl()],
  server: {
    port: 3000,
	// https: true,
	host: true,
	proxy: {
		'/api': {
			target: 'http://localhost:4200',
			changeOrigin: true
		}
	}
  },
  build: {
    target: 'esnext',
  },
});
