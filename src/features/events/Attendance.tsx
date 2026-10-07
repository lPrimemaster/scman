import { createSignal, For, Show, type Component } from 'solid-js';
import type { Attendance, Attendee } from '../../lib/types';
import { cx } from '../../components/ui/cx';

const TABS = [
	{ key: 'going', label: 'Disponível', dot: 'var(--success)' },
	{ key: 'not_going', label: 'Indisponível', dot: 'var(--danger)' },
	{ key: 'noanswer', label: 'Sem resposta', dot: 'var(--fg-muted)' }
] as const;

// Two columns: stripe by row, so both cells of a row share the background
const cellClass = (index: number) => cx('min-w-0 px-3 py-2', Math.floor(index / 2) % 2 === 1 && 'bg-surface-2');

const AttendeeCell: Component<{ person: Attendee; index: number }> = (props) => (
	<li
		class={cx(cellClass(props.index), props.index % 2 === 1 && 'border-l border-border')}
		title={`${props.person.full_name} (${props.person.username})`}
	>
		<p class='truncate text-sm'>
			<span class='font-medium text-fg'>{props.person.full_name}</span>{' '}
			<span class='text-fg-muted'>({props.person.username})</span>
		</p>
	</li>
);

export const AttendanceTabs: Component<{ attendance: Attendance }> = (props) => {
	const [tab, setTab] = createSignal<(typeof TABS)[number]['key']>('going');
	const people = () => props.attendance[tab()] ?? [];

	return (
		<div>
			<div class='flex gap-1 rounded-xl bg-surface-2 p-1' role='tablist'>
				<For each={TABS}>
					{(t) => (
						<button
							role='tab'
							aria-selected={tab() === t.key}
							class={cx(
								'flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition sm:text-sm',
								tab() === t.key ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted hover:text-fg'
							)}
							onClick={() => setTab(t.key)}
						>
							<span class='size-1.5 rounded-full' style={{ background: t.dot }} />
							{t.label}
							<span class='tabular-nums text-fg-muted'>{props.attendance[t.key]?.length ?? 0}</span>
						</button>
					)}
				</For>
			</div>
			<Show
				when={people().length > 0}
				fallback={<p class='py-6 text-center text-sm text-fg-muted'>Ninguém nesta lista.</p>}
			>
				<ul class='mt-3 grid grid-cols-2 overflow-hidden rounded-xl border border-border' role='tabpanel'>
					<For each={people()}>{(person, i) => <AttendeeCell person={person} index={i()} />}</For>
					{/* Fill the last row so its stripe spans both columns */}
					<Show when={people().length % 2 === 1}>
						<li aria-hidden='true' class={cx(cellClass(people().length), 'border-l border-border')} />
					</Show>
				</ul>
			</Show>
		</div>
	);
};
