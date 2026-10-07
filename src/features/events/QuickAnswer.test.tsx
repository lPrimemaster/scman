import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import type { EventItem } from '../../lib/types';
import { api } from '../../lib/api';
import { eventsVersion } from '../../lib/eventsBus';
import { QuickAnswer } from './QuickAnswer';

const event: EventItem = {
	id: 7,
	name: 'Volta',
	location: 'Évora',
	start: '2026-10-20',
	end: '2026-10-20',
	sub_limit_date: '2026-10-15',
	change_limit: 2,
	type: 2,
	price: '0',
	description: '',
	files: [],
	my_status: 1,
	my_changes_left: 2
};

describe('QuickAnswer', () => {
	afterEach(() => vi.restoreAllMocks());

	it('marks the current answer and sends a new one', async () => {
		const respond = vi.spyOn(api.events, 'respond').mockResolvedValue({} as never);
		const before = eventsVersion();
		render(() => <QuickAnswer event={event} />);

		const yes = screen.getByRole('button', { name: 'Disponível' });
		expect(yes.getAttribute('aria-pressed')).toBe('true');
		fireEvent.click(yes);
		expect(respond).not.toHaveBeenCalled(); // already the answer

		fireEvent.click(screen.getByRole('button', { name: 'Indisponível' }));
		expect(respond).toHaveBeenCalledWith(7, 0);
		await waitFor(() => expect(eventsVersion()).toBe(before + 1)); // lists refetch
	});
});
