import { Show, type Component } from 'solid-js';
import { Meter } from './Meter';

export const StatTile: Component<{ label: string; value: string; caption?: string; meter?: number | null }> = (
	props
) => (
	<div class='flex flex-col gap-1 rounded-2xl border border-border bg-surface p-4'>
		<p class='text-sm text-fg-muted'>{props.label}</p>
		<p class='text-2xl font-semibold text-fg sm:text-3xl'>{props.value}</p>
		<Show when={props.meter !== undefined}>
			<Meter value={props.meter ?? null} label={props.label} class='mt-1' />
		</Show>
		<Show when={props.caption}>
			<p class='text-xs text-fg-muted'>{props.caption}</p>
		</Show>
	</div>
);
