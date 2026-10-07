import { createSignal, onCleanup } from 'solid-js';

export function useMediaQuery(query: string) {
	const media = window.matchMedia(query);
	const [matches, setMatches] = createSignal(media.matches);
	const listener = () => setMatches(media.matches);
	media.addEventListener('change', listener);
	onCleanup(() => media.removeEventListener('change', listener));
	return matches;
}

export const MOBILE_QUERY = '(max-width: 767px)';

export async function copyToClipboard(text: string) {
	await navigator.clipboard.writeText(text);
}

export const absoluteUrl = (path: string) => window.location.origin + path;
