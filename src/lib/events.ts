import type { EventItem, EventType, MyEventState, ResponseStatus, Role } from './types';
import { daysUntil } from './dates';

interface EventTypeInfo {
	label: string;
	/** Hex color, used for the calendar and badges */
	color: string;
}

export const EVENT_TYPES: Record<EventType, EventTypeInfo> = {
	0: { label: 'Prova CPT', color: '#3b82f6' },
	1: { label: 'Estágio Aberto', color: '#10b981' },
	2: { label: 'Prova Federada', color: '#c9a440' },
	3: { label: 'Estágio Federado', color: '#8b5cf6' }
};

export const EVENT_TYPE_OPTIONS = ([0, 1, 2, 3] as EventType[]).map((value) => ({
	value,
	label: EVENT_TYPES[value].label
}));

/** CPT races created by athletes: the server fixes type, price and change limit. */
export const MEMBER_RACE = { changeLimit: 10, deadlineDays: 10 };

export const ROLE_LABELS: Record<Role, string> = {
	admin: 'Administrador',
	federado: 'Federado',
	cpt: 'CPT'
};

export const ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as Role[]).map((value) => ({
	value,
	label: ROLE_LABELS[value]
}));

export const RESPONSE_LABELS: Record<ResponseStatus, string> = {
	[-1]: 'Sem resposta',
	0: 'Indisponível',
	1: 'Disponível',
	2: 'Talvez'
};

export function isFederated(role: Role | undefined) {
	return role === 'admin' || role === 'federado';
}

/** Why the user cannot change their answer, or null when they can. */
export function responseBlockReason(me: MyEventState): string | null {
	if (me.paid) return 'Evento pago. Alteração indisponível.';
	if (me.deadlinePassed) return 'Data limite de resposta atingida.';
	if (me.locked) return 'Limite máximo de alterações atingido.';
	return null;
}

export function changesLeftLabel(me: MyEventState): string | null {
	if (!me.canRespond) return null;
	// The first answer is not a change
	const changes = me.status === -1 ? me.changesLeft - 1 : me.changesLeft;
	if (changes <= 0) return me.status === -1 ? 'Não poderás alterar a resposta.' : 'Esta é a última alteração.';
	return changes === 1 ? 'Podes alterar a resposta mais 1 vez.' : `Podes alterar a resposta mais ${changes} vezes.`;
}

export function formatPrice(price: string) {
	const value = Number(price);
	if (!value) return 'Gratuito';
	return `${value.toFixed(2).replace('.', ',')} €`;
}

export type DeadlineState = 'open' | 'soon' | 'closed';

export function deadlineState(event: Pick<EventItem, 'sub_limit_date'>, now = new Date()): DeadlineState {
	const days = daysUntil(event.sub_limit_date, now);
	if (days < 0) return 'closed';
	if (days <= 3) return 'soon';
	return 'open';
}
