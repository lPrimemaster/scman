import type {
	AttendanceStats,
	EventDetail,
	EventInput,
	EventItem,
	EventType,
	Invite,
	ManagedUser,
	RaceInput,
	ResponseStatus,
	Role,
	SimilarRace,
	TokenCheck,
	User
} from './types';

const TOKEN_KEY = 'token';

export const tokenStore = {
	get: () => localStorage.getItem(TOKEN_KEY),
	set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
	clear: () => localStorage.removeItem(TOKEN_KEY)
};

export class ApiError extends Error {
	constructor(
		public status: number,
		message: string,
		/** The parsed error body, for endpoints that send extra fields */
		public data?: Record<string, unknown>
	) {
		super(message);
	}
}

type AuthFailureHandler = (reason: 'unauthorized' | 'disabled') => void;
let onAuthFailure: AuthFailureHandler = () => {};

/** The session registers how to react when the server rejects our token. */
export function setAuthFailureHandler(handler: AuthFailureHandler) {
	onAuthFailure = handler;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
	const token = tokenStore.get();
	const headers: Record<string, string> = {};
	if (token) headers.Authorization = `Bearer ${token}`;
	if (body !== undefined) headers['Content-Type'] = 'application/json';

	const res = await fetch(path, {
		method,
		headers,
		body: body !== undefined ? JSON.stringify(body) : undefined
	});

	const text = await res.text();
	const data = text ? JSON.parse(text) : undefined;

	if (!res.ok) {
		const message = data?.error ?? data?.message ?? `Erro ${res.status}`;
		if (token && res.status === 401) onAuthFailure('unauthorized');
		if (token && res.status === 403 && message === 'Account disabled') onAuthFailure('disabled');
		throw new ApiError(res.status, message, data);
	}
	return data as T;
}

const get = <T>(path: string) => request<T>('GET', path);
const post = <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {});
const put = <T>(path: string, body: unknown) => request<T>('PUT', path, body);
const patch = <T>(path: string, body: unknown) => request<T>('PATCH', path, body);
const del = <T>(path: string, body?: unknown) => request<T>('DELETE', path, body);

const enc = encodeURIComponent;

function query(params: Record<string, string | number | boolean | undefined>) {
	const qs = new URLSearchParams();
	for (const [k, v] of Object.entries(params)) {
		if (v !== undefined) qs.set(k, String(v));
	}
	const s = qs.toString();
	return s ? `?${s}` : '';
}

/** Uploads with progress reporting (fetch has no upload progress). */
function uploadFile(file: File, onProgress?: (percent: number) => void) {
	return new Promise<{ handle: string; name: string; size: number }>((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		const form = new FormData();
		form.append('file', file);

		xhr.open('POST', '/api/files');
		const token = tokenStore.get();
		if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
		};
		xhr.onload = () => {
			let data: any;
			try {
				data = JSON.parse(xhr.responseText);
			} catch {
				data = {};
			}
			if (xhr.status === 200) resolve(data);
			else reject(new ApiError(xhr.status, data.error ?? 'Falha no upload.'));
		};
		xhr.onerror = () => reject(new ApiError(0, 'Falha de rede.'));
		xhr.send(form);
	});
}

export const api = {
	auth: {
		login: (username: string, password: string) =>
			post<{ token: string; user: User }>('/api/auth/login', { username, password }),
		me: () => get<User>('/api/auth/me'),
		changePassword: (current: string, password: string) =>
			post<{ ok: true }>('/api/auth/password', { current, password })
	},
	events: {
		list: (params: { upcoming?: boolean; type?: EventType; limit?: number } = {}) =>
			get<EventItem[]>(`/api/events${query(params)}`),
		get: (id: number) => get<EventDetail>(`/api/events/${id}`),
		respond: (id: number, status: ResponseStatus) => put<EventDetail>(`/api/events/${id}/response`, { status }),
		create: (event: EventInput) => post<EventItem>('/api/events', event),
		createRace: (race: RaceInput) => post<EventItem>('/api/events/races', race),
		similarRaces: (params: { name: string; location?: string; start?: string }) =>
			get<SimilarRace[]>(`/api/events/races/similar${query(params)}`),
		update: (id: number, event: EventInput) => put<EventItem>(`/api/events/${id}`, event),
		remove: (id: number) => del<{ ok: true }>(`/api/events/${id}`)
	},
	calendar: {
		feed: () => get<{ path: string }>('/api/calendar/feed'),
		regenerate: () => post<{ path: string }>('/api/calendar/feed/regenerate')
	},
	stats: {
		attendance: (range: { from?: string; to?: string }) =>
			get<AttendanceStats>(`/api/stats/attendance${query(range)}`)
	},
	users: {
		list: () => get<ManagedUser[]>('/api/users'),
		create: (user: { username: string; full_name: string; role: Role }) =>
			post<{ id: number; token: string; inviteLink: string }>('/api/users', user),
		update: (id: number, changes: { role?: Role; disabled?: boolean }) =>
			patch<ManagedUser>(`/api/users/${id}`, changes),
		resetPassword: (id: number) => post<{ resetLink: string }>(`/api/users/${id}/reset`)
	},
	invites: {
		list: () => get<Invite[]>('/api/invites'),
		check: (token: string) => get<TokenCheck>(`/api/invites/${enc(token)}`),
		activate: (token: string, password: string) =>
			post<{ ok: true; username: string }>(`/api/invites/${enc(token)}/activate`, { password }),
		remove: (token: string) => del<{ ok: true }>(`/api/invites/${enc(token)}`)
	},
	resets: {
		check: (token: string) => get<TokenCheck>(`/api/resets/${enc(token)}`),
		submit: (token: string, password: string) =>
			post<{ ok: true; username: string }>(`/api/resets/${enc(token)}`, { password })
	},
	files: {
		upload: uploadFile,
		remove: (handle: string) => del<{ ok: true }>(`/api/files/${enc(handle)}`),
		link: (handle: string) => get<{ url: string }>(`/api/files/${enc(handle)}/link`)
	},
	push: {
		config: () => get<{ enabled: boolean; publicKey: string | null }>('/api/push/config'),
		subscribe: (subscription: PushSubscriptionJSON) => post<{ ok: true }>('/api/push/subscriptions', subscription),
		unsubscribe: (endpoint: string) => del<{ ok: true }>('/api/push/subscriptions', { endpoint }),
		test: () => post<{ sent: number; failed: number }>('/api/push/test')
	},
	payments: {
		createOrder: (eventId: number) => post<{ orderId: string }>('/api/payments/orders', { event_id: eventId }),
		capture: (orderId: string) => post<unknown>(`/api/payments/orders/${enc(orderId)}/capture`)
	}
};
