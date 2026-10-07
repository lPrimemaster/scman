import { describe, expect, it } from 'vitest';
import { DISMISS_DAYS, isAndroid, isDismissalActive, isFirefox, isIOS, resolveInstallMode } from './pwa';

const UA = {
	iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
	ipadOS: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
	androidChrome:
		'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
	androidFirefox: 'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0'
};

describe('platform detection', () => {
	it('recognises iPhone and iPadOS (which looks like a Mac with touch)', () => {
		expect(isIOS(UA.iphone, 'iPhone', 5)).toBe(true);
		expect(isIOS(UA.ipadOS, 'MacIntel', 5)).toBe(true);
		expect(isIOS(UA.ipadOS, 'MacIntel', 0)).toBe(false); // a real Mac
		expect(isIOS(UA.androidChrome, 'Linux armv8l', 5)).toBe(false);
	});

	it('recognises Android and Firefox', () => {
		expect(isAndroid(UA.androidChrome)).toBe(true);
		expect(isAndroid(UA.iphone)).toBe(false);
		expect(isFirefox(UA.androidFirefox)).toBe(true);
		expect(isFirefox(UA.androidChrome)).toBe(false);
	});
});

describe('resolveInstallMode', () => {
	const env = { standalone: false, ios: false, android: false, hasPrompt: false };

	it('is installed when running standalone, whatever else is true', () => {
		expect(resolveInstallMode({ ...env, standalone: true, hasPrompt: true, ios: true })).toBe('installed');
	});

	it('prefers the browser prompt, then iOS steps, then the Android menu', () => {
		expect(resolveInstallMode({ ...env, hasPrompt: true, android: true })).toBe('prompt');
		expect(resolveInstallMode({ ...env, ios: true })).toBe('ios');
		expect(resolveInstallMode({ ...env, android: true })).toBe('manual');
		expect(resolveInstallMode(env)).toBe('unsupported');
	});
});

describe('install card dismissal', () => {
	const now = Date.UTC(2026, 9, 7);
	const day = 86_400_000;

	it(`hides the card for ${DISMISS_DAYS} days`, () => {
		expect(isDismissalActive(null, now)).toBe(false);
		expect(isDismissalActive(now - 29 * day, now)).toBe(true);
		expect(isDismissalActive(now - 31 * day, now)).toBe(false);
	});
});
