/** "João Pedro Gonçalves" -> "j.goncalves" */
export function autoUsername(fullName: string) {
	const names = fullName.trim().split(/\s+/).filter(Boolean);
	if (names.length < 2) return '';
	const strip = (s: string) =>
		s
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase()
			.replace(/[^a-z0-9-]/g, '');
	return `${strip(names[0][0])}.${strip(names[names.length - 1])}`;
}
