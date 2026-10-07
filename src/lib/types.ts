export type Role = 'admin' | 'federado' | 'cpt';

/** 0 Prova CPT · 1 Estágio Aberto · 2 Prova Federada · 3 Estágio Federado */
export type EventType = 0 | 1 | 2 | 3;

/** -1 no answer · 0 not going · 1 going · 2 maybe */
export type ResponseStatus = -1 | 0 | 1 | 2;

export interface User {
	id: number;
	username: string;
	full_name: string;
	role: Role;
}

export interface EventFile {
	handle: string;
	name: string;
}

export interface EventItem {
	id: number;
	name: string;
	location: string;
	/** ISO dates (YYYY-MM-DD) */
	start: string;
	end: string;
	sub_limit_date: string;
	change_limit: number;
	type: EventType;
	price: string;
	description: string;
	files: EventFile[];
	my_status?: ResponseStatus;
	/** Answers still allowed (first answer + changes); only in lists */
	my_changes_left?: number;
}

export type EventInput = Omit<EventItem, 'id' | 'my_status' | 'my_changes_left'>;

/** `exact`: same name, which cannot be created again */
export type SimilarRace = EventItem & { score: number; exact: boolean };

/** Races added by athletes last a single day: the server sets `end` to `start`. */
export type RaceInput = Pick<EventItem, 'name' | 'location' | 'start' | 'sub_limit_date' | 'description'>;

export interface Attendee {
	full_name: string;
	username: string;
}

export interface Attendance {
	going: Attendee[];
	not_going: Attendee[];
	maybe: Attendee[];
	noanswer: Attendee[];
}

export interface MyEventState {
	status: ResponseStatus;
	changesLeft: number;
	locked: boolean;
	paid: boolean;
	deadlinePassed: boolean;
	canRespond: boolean;
}

export interface EventDetail {
	event: EventItem;
	attendance: Attendance;
	me: MyEventState;
}

export type UserStatus = 'active' | 'inactive' | 'disabled';

export interface ManagedUser extends User {
	status: UserStatus;
}

export type InviteStatus = 'active' | 'pending' | 'expired';

export interface Invite {
	token: string;
	link: string;
	username: string;
	full_name: string;
	role: Role;
	expires_at: number;
	status: InviteStatus;
}

export type TokenCheck = { valid: true; username: string } | { valid: false; reason: string };

// ---------- Admin statistics ----------

export interface StatsEvent {
	id: number;
	name: string;
	start: string;
	end: string;
	type: EventType;
}

export interface StatsAthlete {
	id: number;
	full_name: string;
	username: string;
	role: Role;
	active: boolean;
	disabled: boolean;
	/** Approximate join date (from the invite), null for accounts older than invites */
	joined: string | null;
}

export interface StatsResponse {
	user_id: number;
	event_id: number;
	status: 0 | 1 | 2;
	updated_at: string;
}

export interface AttendanceStats {
	from: string;
	to: string;
	events: StatsEvent[];
	athletes: StatsAthlete[];
	responses: StatsResponse[];
}
