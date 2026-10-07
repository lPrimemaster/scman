import { For, type Component } from 'solid-js';
import { cx } from '../ui/cx';

export interface LegendItem {
	label: string;
	color: string;
	/** A track swatch: the unfilled part of a bar */
	track?: boolean;
}

export const Legend: Component<{ items: LegendItem[]; class?: string }> = (props) => (
	<ul class={cx('flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-fg-muted', props.class)}>
		<For each={props.items}>
			{(item) => (
				<li class='flex items-center gap-1.5'>
					<span
						class={cx('size-2.5 rounded-[3px]', item.track && 'ring-1 ring-border ring-inset')}
						style={{ background: item.color }}
					/>
					{item.label}
				</li>
			)}
		</For>
	</ul>
);
