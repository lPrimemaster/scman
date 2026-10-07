import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, setAuthFailureHandler, tokenStore } from './api';

function mockFetch(status: number, body: unknown) {
	return vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

describe('api client', () => {
	beforeEach(() => localStorage.clear());
	afterEach(() => vi.unstubAllGlobals());

	it('sends the bearer token and JSON body', async () => {
		tokenStore.set('abc');
		const fetch = mockFetch(200, { ok: true });
		vi.stubGlobal('fetch', fetch);
		await api.events.respond(4, 1);
		const [url, init] = fetch.mock.calls[0];
		expect(url).toBe('/api/events/4/response');
		expect(init.method).toBe('PUT');
		expect(init.headers.Authorization).toBe('Bearer abc');
		expect(JSON.parse(init.body)).toEqual({ status: 1 });
	});

	it('builds query strings without undefined values', async () => {
		const fetch = mockFetch(200, []);
		vi.stubGlobal('fetch', fetch);
		await api.events.list({ upcoming: true, type: 2 });
		expect(fetch.mock.calls[0][0]).toBe('/api/events?upcoming=true&type=2');
	});

	it('throws ApiError and reports auth failures', async () => {
		tokenStore.set('abc');
		const handler = vi.fn();
		setAuthFailureHandler(handler);

		vi.stubGlobal('fetch', mockFetch(401, { error: 'Unauthorized.' }));
		await expect(api.auth.me()).rejects.toBeInstanceOf(ApiError);
		expect(handler).toHaveBeenCalledWith('unauthorized');

		vi.stubGlobal('fetch', mockFetch(403, { error: 'Account disabled' }));
		await expect(api.auth.me()).rejects.toMatchObject({ status: 403 });
		expect(handler).toHaveBeenCalledWith('disabled');
	});

	it('does not report auth failures when logged out (e.g. wrong password)', async () => {
		const handler = vi.fn();
		setAuthFailureHandler(handler);
		vi.stubGlobal('fetch', mockFetch(401, { error: 'Invalid credentials.' }));
		await expect(api.auth.login('a', 'b')).rejects.toMatchObject({ status: 401, message: 'Invalid credentials.' });
		expect(handler).not.toHaveBeenCalled();
	});
});
