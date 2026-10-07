import type { Component } from 'solid-js';
import { cx } from '../ui/cx';

/** A ratio from 0 to 1 as a thin bar; the track is a lighter step of the same hue. */
export const Meter: Component<{ value: number | null; class?: string; label?: string }> = (props) => (
	<div
		role='meter'
		aria-label={props.label}
		aria-valuemin={0}
		aria-valuemax={100}
		aria-valuenow={props.value === null ? undefined : Math.round(props.value * 100)}
		class={cx('h-1.5 w-full overflow-hidden rounded-full bg-viz-going-soft', props.class)}
	>
		<div class='h-full rounded-full bg-viz-going' style={{ width: `${(props.value ?? 0) * 100}%` }} />
	</div>
);
