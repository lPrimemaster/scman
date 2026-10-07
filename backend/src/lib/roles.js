export const ROLES = ['admin', 'federado', 'cpt'];

// Event types
// 0 - Prova CPT
// 1 - Estágio/Evento Aberto
// 2 - Prova FED
// 3 - Estágio Fechado
export const EVENT_TYPES = [0, 1, 2, 3];
export const OPEN_EVENT_TYPES = [0, 1];

export function isFederated(role) {
	return role === 'admin' || role === 'federado';
}

export function visibleEventTypes(role) {
	return isFederated(role) ? EVENT_TYPES : OPEN_EVENT_TYPES;
}

export function canSeeEventType(role, type) {
	return visibleEventTypes(role).includes(Number(type));
}

// Roles notified about / expected to answer an event of a given type
export function rolesForEventType(type) {
	return OPEN_EVENT_TYPES.includes(Number(type)) ? ROLES : ['admin', 'federado'];
}
