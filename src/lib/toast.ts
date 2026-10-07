import { createSignal } from 'solid-js';

export type ToastKind = 'info' | 'success' | 'error';

export interface Toast {
	id: number;
	message: string;
	kind: ToastKind;
}

let nextId = 0;
const [toasts, setToasts] = createSignal<Toast[]>([]);

export { toasts };

export function dismissToast(id: number) {
	setToasts((list) => list.filter((t) => t.id !== id));
}

function push(message: string, kind: ToastKind, duration = 3500) {
	const id = nextId++;
	setToasts((list) => [...list, { id, message, kind }]);
	setTimeout(() => dismissToast(id), duration);
}

export const toast = {
	info: (message: string) => push(message, 'info'),
	success: (message: string) => push(message, 'success'),
	error: (message: string) => push(message, 'error', 5000)
};

/** Shows a friendly message for a failed request. */
export function toastError(fallback: string) {
	return (err: unknown) => {
		console.error(err);
		toast.error(fallback);
	};
}
