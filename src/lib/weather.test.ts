import { afterEach, describe, expect, it, vi } from 'vitest';
import { describeWeather, eventForecast, forecastWindow } from './weather';

describe('describeWeather', () => {
	it('maps WMO codes to Portuguese labels and icons', () => {
		expect(describeWeather(0)).toEqual({ label: 'Céu limpo', icon: 'sun' });
		expect(describeWeather(2).label).toBe('Pouco nublado');
		expect(describeWeather(45).label).toBe('Nevoeiro');
		expect(describeWeather(53).label).toBe('Chuvisco');
		expect(describeWeather(63).label).toBe('Chuva');
		expect(describeWeather(81).icon).toBe('cloud-rain');
		expect(describeWeather(95).label).toBe('Trovoada');
		expect(describeWeather(42).label).toBe('Variável');
	});
});

describe('forecastWindow', () => {
	const today = '2026-10-07';
	it('keeps the event days inside the 16-day horizon', () => {
		expect(forecastWindow('2026-10-10', '2026-10-11', today)).toEqual({ from: '2026-10-10', to: '2026-10-11' });
		expect(forecastWindow('2026-10-20', '2026-10-25', today)).toEqual({ from: '2026-10-20', to: '2026-10-22' });
		expect(forecastWindow('2026-10-05', '2026-10-08', today)).toEqual({ from: '2026-10-07', to: '2026-10-08' });
	});
	it('is null for past or far-away events', () => {
		expect(forecastWindow('2026-10-01', '2026-10-02', today)).toBeNull();
		expect(forecastWindow('2026-11-01', '2026-11-01', today)).toBeNull();
	});
});

describe('eventForecast', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('geocodes the location, then reads the daily forecast', async () => {
		const today = new Date().toISOString().slice(0, 10);
		const fetchMock = vi.fn(async (url: string) => {
			if (url.includes('geocoding')) {
				return new Response(JSON.stringify({ results: [{ latitude: 38.6, longitude: -9.1, name: 'Seixal' }] }));
			}
			return new Response(
				JSON.stringify({
					daily: {
						time: [today],
						weather_code: [61],
						temperature_2m_max: [21.4],
						temperature_2m_min: [14.6],
						precipitation_probability_max: [70],
						wind_speed_10m_max: [18.2]
					}
				})
			);
		});
		vi.stubGlobal('fetch', fetchMock);

		const f = await eventForecast('Seixal-test', today, today);
		expect(f).toEqual({ place: 'Seixal', days: [{ date: today, code: 61, max: 21, min: 15, rain: 70, wind: 18 }] });
		expect(fetchMock.mock.calls[0][0]).toContain('countryCode=PT');
		expect(fetchMock.mock.calls[1][0]).toContain('latitude=38.6');

		await eventForecast('Seixal-test', today, today);
		expect(fetchMock).toHaveBeenCalledTimes(2); // cached
	});

	it('returns null for unknown places', async () => {
		const today = new Date().toISOString().slice(0, 10);
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(JSON.stringify({})))
		);
		expect(await eventForecast('Nowhere-xyz', today, today)).toBeNull();
	});
});
