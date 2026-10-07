import type { IconName } from '../components/ui/Icon';
import { addDays, todayISO } from './dates';

/** Open-Meteo forecasts reach 16 days ahead (today + 15). */
export const FORECAST_DAYS = 16;

export interface DayForecast {
	date: string;
	code: number;
	max: number;
	min: number;
	rain: number | null;
	wind: number | null;
}

export interface Forecast {
	place: string;
	days: DayForecast[];
}

interface WeatherLabel {
	label: string;
	icon: IconName;
}

/** WMO weather interpretation codes (as used by Open-Meteo) to Portuguese labels. */
export function describeWeather(code: number): WeatherLabel {
	if (code === 0) return { label: 'Céu limpo', icon: 'sun' };
	if (code <= 2) return { label: 'Pouco nublado', icon: 'cloud-sun' };
	if (code === 3) return { label: 'Nublado', icon: 'cloud' };
	if (code === 45 || code === 48) return { label: 'Nevoeiro', icon: 'cloud-fog' };
	if (code >= 51 && code <= 57) return { label: 'Chuvisco', icon: 'cloud-rain' };
	if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { label: 'Chuva', icon: 'cloud-rain' };
	if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: 'Neve', icon: 'cloud-snow' };
	if (code >= 95) return { label: 'Trovoada', icon: 'cloud-lightning' };
	return { label: 'Variável', icon: 'cloud' };
}

/** The part of an event inside the forecast horizon, or null when none of it is. */
export function forecastWindow(start: string, end: string, today = todayISO()) {
	const last = addDays(today, FORECAST_DAYS - 1);
	const from = start > today ? start : today;
	const to = (end || start) < last ? end || start : last;
	return from <= to ? { from, to } : null;
}

const cache = new Map<string, Promise<Forecast | null>>();

async function geocode(location: string) {
	// Prefer Portuguese places (most events), then anywhere
	for (const country of ['&countryCode=PT', '']) {
		const res = await fetch(
			`https://geocoding-api.open-meteo.com/v1/search?count=1&language=pt&format=json&name=${encodeURIComponent(location)}${country}`
		);
		if (!res.ok) continue;
		const place = (await res.json()).results?.[0];
		if (place) return place as { latitude: number; longitude: number; name: string };
	}
	return null;
}

async function load(location: string, from: string, to: string): Promise<Forecast | null> {
	const place = await geocode(location);
	if (!place) return null;
	const params = new URLSearchParams({
		latitude: String(place.latitude),
		longitude: String(place.longitude),
		daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max',
		timezone: 'Europe/Lisbon',
		start_date: from,
		end_date: to
	});
	const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
	if (!res.ok) return null;
	const d = (await res.json()).daily;
	if (!d?.time?.length) return null;
	return {
		place: place.name,
		days: d.time.map((date: string, i: number) => ({
			date,
			code: d.weather_code[i],
			max: Math.round(d.temperature_2m_max[i]),
			min: Math.round(d.temperature_2m_min[i]),
			rain: d.precipitation_probability_max?.[i] ?? null,
			wind: d.wind_speed_10m_max?.[i] != null ? Math.round(d.wind_speed_10m_max[i]) : null
		}))
	};
}

/** Daily forecast for an event, or null (out of range, unknown place, offline). Cached per page load. */
export function eventForecast(location: string, start: string, end: string): Promise<Forecast | null> {
	const window = forecastWindow(start, end);
	if (!window || !location.trim()) return Promise.resolve(null);
	const key = `${location.trim().toLowerCase()}|${window.from}|${window.to}`;
	if (!cache.has(key)) {
		const request = load(location.trim(), window.from, window.to).catch(() => null);
		cache.set(key, request);
		request.then((r) => r === null && cache.delete(key)); // retry failures on the next open
	}
	return cache.get(key)!;
}
