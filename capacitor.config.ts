import type { CapacitorConfig } from '@capacitor/cli';

// Set CAP_SERVER_URL (e.g. http://192.168.0.100:3000) to live-reload the native app from a dev server.
const serverUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
	appId: 'pt.sc1925.scman',
	appName: 'ScMan1925',
	webDir: 'dist',
	...(serverUrl ? { server: { url: serverUrl, cleartext: true } } : {})
};

export default config;
