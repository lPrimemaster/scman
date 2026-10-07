import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { ResponseControls } from './ResponseControls';
import type { MyEventState } from '../../lib/types';

const me = (o: Partial<MyEventState> = {}): MyEventState => ({
	status: -1,
	changesLeft: 3,
	locked: false,
	paid: false,
	deadlinePassed: false,
	canRespond: true,
	...o
});

describe('ResponseControls', () => {
	it('lets the user answer when allowed', async () => {
		const onRespond = vi.fn();
		render(() => <ResponseControls me={me()} onRespond={onRespond} />);
		fireEvent.click(screen.getByRole('button', { name: /^Disponível/ }));
		expect(onRespond).toHaveBeenCalledWith(1);
		expect(screen.getByText('Podes alterar a resposta mais 2 vezes.')).toBeTruthy();
	});

	it('marks the current answer and disables re-selecting it', () => {
		render(() => <ResponseControls me={me({ status: 0 })} onRespond={() => {}} />);
		const no = screen.getByRole('button', { name: /Indisponível/ }) as HTMLButtonElement;
		expect(no.getAttribute('aria-pressed')).toBe('true');
		expect(no.disabled).toBe(true);
	});

	it('shows the block reason and disables both options', () => {
		render(() => <ResponseControls me={me({ deadlinePassed: true, canRespond: false })} onRespond={() => {}} />);
		expect(screen.getByText('Data limite de resposta atingida.')).toBeTruthy();
		for (const b of screen.getAllByRole('button') as HTMLButtonElement[]) expect(b.disabled).toBe(true);
	});
});
