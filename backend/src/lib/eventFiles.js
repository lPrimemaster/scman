// Event attachments are stored in `events.files` as `handle[name]:handle[name]`.
// This format is kept for compatibility with the production database.
// Some older rows contain a bare `handle` without a name.

const ENTRY = /^([^[\]:]+)(?:\[(.*)\])?$/;
const FALLBACK_NAME = 'Anexo';

export function parseEventFiles(str) {
	if (!str) return [];
	return str
		.split(':')
		.map((entry) => entry.trim().match(ENTRY))
		.filter(Boolean)
		.map(([, handle, name]) => ({ handle, name: name || FALLBACK_NAME }));
}

export function sanitizeFileName(name) {
	return String(name).replace(/[:[\]]/g, '_');
}

export function serializeEventFiles(files) {
	if (!files || files.length === 0) return '';
	return files.map((f) => `${f.handle}[${sanitizeFileName(f.name)}]`).join(':');
}
