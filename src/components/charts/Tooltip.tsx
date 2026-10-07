import { createSignal, For, Show, type Component } from 'solid-js';

export interface TooltipRow {
	color: string;
	label: string;
	value: string;
}

export interface TooltipContent {
	title: string;
	rows: TooltipRow[];
	footer?: string;
}

interface TooltipState extends TooltipContent {
	x: number;
	y: number;
}

/**
 * One tooltip per chart. Position is relative to the chart container, which must be `relative`.
 * Values lead (strong), series labels follow; rows are keyed with a short line in the series colour.
 */
export function createTooltip() {
	const [state, setState] = createSignal<TooltipState>();
	let container: HTMLElement | undefined;

	function show(target: Element, content: TooltipContent) {
		if (!container) return;
		const box = container.getBoundingClientRect();
		const mark = target.getBoundingClientRect();
		setState({ ...content, x: mark.left + mark.width / 2 - box.left, y: mark.top - box.top });
	}

	const View: Component = () => (
		<Show when={state()}>
			{(tip) => (
				<div
					role='status'
					class='pointer-events-none absolute z-10 min-w-36 -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg'
					style={{
						left: `clamp(80px, ${tip().x}px, calc(100% - 80px))`,
						top: `${tip().y - 8}px`
					}}
				>
					<p class='mb-1 font-medium text-fg-muted'>{tip().title}</p>
					<For each={tip().rows}>
						{(row) => (
							<p class='flex items-center gap-2 py-0.5'>
								<span class='h-0.5 w-3 shrink-0 rounded-full' style={{ background: row.color }} />
								<span class='font-semibold text-fg tabular-nums'>{row.value}</span>
								<span class='text-fg-muted'>{row.label}</span>
							</p>
						)}
					</For>
					<Show when={tip().footer}>
						<p class='mt-1 border-t border-border pt-1 text-fg-muted'>{tip().footer}</p>
					</Show>
				</div>
			)}
		</Show>
	);

	return {
		ref: (el: HTMLElement) => (container = el),
		show,
		hide: () => setState(undefined),
		View
	};
}
