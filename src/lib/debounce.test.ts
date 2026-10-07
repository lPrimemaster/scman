import { createRoot, createSignal } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDebounced } from './debounce';

describe('createDebounced', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('settles on the last value after a burst', () => {
		// Effects only start once the root callback has returned
		const { setText, debounced, dispose } = createRoot((dispose) => {
			const [text, setText] = createSignal('');
			return { setText, debounced: createDebounced(text, 300), dispose };
		});

		for (const v of ['s', 'se', 'sei']) {
			setText(v);
			vi.advanceTimersByTime(100);
		}
		expect(debounced()).toBe('');

		vi.advanceTimersByTime(300);
		expect(debounced()).toBe('sei');
		dispose();
	});
});
