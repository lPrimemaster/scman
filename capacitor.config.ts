import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
	appId: 'pt.sc1925.scman',
	appName: 'scman',
	webDir: 'dist',

	server: {
		url: 'http://192.168.0.100:3000',
		cleartext: true
	}
};

export default config;
