import { Show, type Component } from 'solid-js';
import type { MyEventState, ResponseStatus } from '../../lib/types';
import { changesLeftLabel, responseBlockReason } from '../../lib/events';
import { Icon } from '../../components/ui/Icon';
import { Notice } from '../../components/ui/Feedback';
import { cx } from '../../components/ui/cx';

const OPTIONS = [
	{ status: 1 as const, label: 'Disponível', icon: 'check' as const, active: 'bg-success text-white border-success' },
	{ status: 0 as const, label: 'Indisponível', icon: 'x' as const, active: 'bg-danger text-white border-danger' }
];

export const ResponseControls: Component<{
	me: MyEventState;
	busy?: boolean;
	onRespond: (status: ResponseStatus) => void;
}> = (props) => {
	const reason = () => responseBlockReason(props.me);
	const hint = () => changesLeftLabel(props.me);

	return (
		<div class='flex flex-col gap-2.5'>
			<div class='grid grid-cols-2 gap-2'>
				{OPTIONS.map((opt) => {
					const selected = () => props.me.status === opt.status;
					return (
						<button
							class={cx(
								'flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition',
								'disabled:cursor-not-allowed',
								selected()
									? opt.active
									: 'border-border bg-surface text-fg hover:bg-surface-2 disabled:opacity-50'
							)}
							aria-pressed={selected()}
							disabled={!props.me.canRespond || selected() || props.busy}
							onClick={() => props.onRespond(opt.status)}
						>
							<Icon name={opt.icon} class='size-4' />
							{opt.label}
						</button>
					);
				})}
			</div>
			<Show when={reason()}>
				<Notice tone={props.me.paid ? 'success' : 'warning'} icon={props.me.paid ? 'check' : 'clock'}>
					{reason()}
				</Notice>
			</Show>
			<Show when={hint()}>
				<p class='text-xs text-fg-muted'>{hint()}</p>
			</Show>
		</div>
	);
};
