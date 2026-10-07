import { createSignal, For, Show, type Component } from 'solid-js';
import type { Attendance } from '../../lib/types';
import { cx } from '../../components/ui/cx';

const TABS = [
	{ key: 'going', label: 'Disponível', dot: 'var(--success)' },
	{ key: 'not_going', label: 'Indisponível', dot: 'var(--danger)' },
	{ key: 'noanswer', label: 'Sem resposta', dot: 'var(--fg-muted)' }
] as const;

export const AttendanceTabs: Component<{ attendance: Attendance }> = (props) => {
	const [tab, setTab] = createSignal<(typeof TABS)[number]['key']>('going');
	const names = () => props.attendance[tab()] ?? [];

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
				when={names().length > 0}
				fallback={<p class='py-6 text-center text-sm text-fg-muted'>Ninguém nesta lista.</p>}
			>
				<ul class='mt-3 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2' role='tabpanel'>
					<For each={names()}>{(name) => <li class='truncate py-1 text-sm'>{name}</li>}</For>
				</ul>
			</Show>
		</div>
	);
};
