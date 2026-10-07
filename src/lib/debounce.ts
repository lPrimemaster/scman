import { createEffect, createSignal, onCleanup, type Accessor } from 'solid-js';

/** Follows `source`, but only once it has stopped changing for `ms`. */
export function createDebounced<T>(source: Accessor<T>, ms = 350): Accessor<T> {
	const [value, setValue] = createSignal<T>(source());
	createEffect(() => {
		const next = source();
		const timer = setTimeout(() => setValue(() => next), ms);
		onCleanup(() => clearTimeout(timer));
	});
	return value;
}
