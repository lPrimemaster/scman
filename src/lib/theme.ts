import { createSignal } from 'solid-js';

export type Theme = 'light' | 'dark';

// Keep in sync with the inline script in index.html, which applies the theme before first paint
const STORAGE_KEY = 'theme';
const THEME_COLORS: Record<Theme, string> = { light: '#f7f7f8', dark: '#0c0c0e' };
const systemQuery = window.matchMedia('(prefers-color-scheme: dark)');

function readSaved(): Theme | null {
	try {
		const v = localStorage.getItem(STORAGE_KEY);
		return v === 'light' || v === 'dark' ? v : null;
	} catch {
		return null;
	}
}

const systemTheme = (): Theme => (systemQuery.matches ? 'dark' : 'light');

/** The explicit choice, or null to follow the system. */
const [saved, setSaved] = createSignal<Theme | null>(readSaved());
const [system, setSystem] = createSignal<Theme>(systemTheme());
systemQuery.addEventListener('change', () => {
	setSystem(systemTheme());
	apply();
});

export const theme = () => saved() ?? system();

function apply() {
	const t = theme();
	document.documentElement.dataset.theme = t;
	// Browser chrome (mobile address bar) follows the chosen theme
	for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
		meta.content = THEME_COLORS[t];
	}
}

export function setTheme(t: Theme) {
	setSaved(t);
	try {
		localStorage.setItem(STORAGE_KEY, t);
	} catch {
		// Private mode: the choice lasts for this session only
	}
	apply();
}

export const toggleTheme = () => setTheme(theme() === 'dark' ? 'light' : 'dark');

apply();
