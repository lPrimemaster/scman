import { For, Show, type Component } from 'solid-js';
import { cx } from '../ui/cx';
import { createTooltip, type TooltipRow } from './Tooltip';

export interface ColumnSegment {
	key: string;
	label: string;
	value: number;
	color: string;
}

export interface Column {
	key: string;
	/** Short axis label */
	label: string;
	title: string;
	segments: ColumnSegment[];
	footer?: string;
}

const PLOT_HEIGHT = 160;

/** A clean axis maximum and step: 1, 2 or 5 × 10^n. */
export function niceScale(max: number, ticks = 4) {
	if (max <= 0) return { max: ticks, step: 1 };
	const raw = max / ticks;
	const magnitude = 10 ** Math.floor(Math.log10(raw));
	const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw)!;
	return { max: Math.max(step, Math.ceil(max / step) * step), step: Math.max(1, step) };
}

/** Vertical stacked columns with one y-axis; each column's whole band is the hover target. */
export const StackedColumns: Component<{ columns: Column[]; ariaLabel: string; showTotals?: boolean }> = (props) => {
	const tip = createTooltip();
	const totals = () => props.columns.map((c) => c.segments.reduce((sum, s) => sum + s.value, 0));
	const scale = () => niceScale(Math.max(0, ...totals()));
	const ticks = () => {
		const { max, step } = scale();
		const list: number[] = [];
		for (let v = 0; v <= max; v += step) list.push(v);
		return list;
	};
	const px = (value: number) => (value / scale().max) * PLOT_HEIGHT;

	return (
		<div ref={tip.ref} class='relative' role='group' aria-label={props.ariaLabel}>
			<div class='flex'>
				{/* Y axis */}
				<div
					class='relative mr-2 w-6 shrink-0 text-right text-[11px] text-fg-muted tabular-nums'
					style={{ height: `${PLOT_HEIGHT}px` }}
				>
					<For each={ticks()}>
						{(t) => (
							<span class='absolute right-0 translate-y-1/2' style={{ bottom: `${px(t)}px` }}>
								{t}
							</span>
						)}
					</For>
				</div>
				<div class='min-w-0 flex-1 overflow-x-auto'>
					<div class='relative' style={{ 'min-width': `${props.columns.length * 28}px` }}>
						{/* Gridlines: hairline, solid, recessive */}
						<div
							class='pointer-events-none absolute inset-x-0 top-0'
							style={{ height: `${PLOT_HEIGHT}px` }}
						>
							<For each={ticks()}>
								{(t) => (
									<div
										class={cx('absolute inset-x-0 h-px', t === 0 ? 'bg-border' : 'bg-viz-grid')}
										style={{ bottom: `${px(t)}px` }}
									/>
								)}
							</For>
						</div>
						<div class='relative flex'>
							<For each={props.columns}>
								{(col, i) => {
									const rows = (): TooltipRow[] =>
										col.segments.map((s) => ({
											color: s.color,
											label: s.label,
											value: String(s.value)
										}));
									const content = () => ({ title: col.title, rows: rows(), footer: col.footer });
									return (
										<button
											type='button'
											class='group flex min-w-0 flex-1 cursor-default flex-col items-center outline-none'
											aria-label={`${col.title}: ${col.segments.map((s) => `${s.label} ${s.value}`).join(', ')}`}
											onPointerEnter={(e) =>
												tip.show(e.currentTarget.firstElementChild!, content())
											}
											onPointerLeave={tip.hide}
											onFocus={(e) => tip.show(e.currentTarget.firstElementChild!, content())}
											onBlur={tip.hide}
										>
											<div
												class='flex w-full flex-col-reverse items-center gap-[2px] rounded-md group-hover:bg-surface-2/60 group-focus-visible:ring-2 group-focus-visible:ring-ring'
												style={{ height: `${PLOT_HEIGHT}px` }}
											>
												<For each={col.segments.filter((s) => s.value > 0)}>
													{(seg, j) => (
														<div
															class={cx(
																'w-[60%] max-w-6 shrink-0',
																j() ===
																	col.segments.filter((s) => s.value > 0).length -
																		1 && 'rounded-t-[4px]'
															)}
															style={{
																height: `${Math.max(0, px(seg.value) - 2)}px`,
																background: seg.color
															}}
														/>
													)}
												</For>
												<Show when={props.showTotals && totals()[i()] > 0}>
													<span class='text-[11px] font-medium text-fg-muted tabular-nums'>
														{totals()[i()]}
													</span>
												</Show>
											</div>
											<span class='mt-1.5 text-[11px] text-fg-muted'>{col.label}</span>
										</button>
									);
								}}
							</For>
						</div>
					</div>
				</div>
			</div>
			<tip.View />
		</div>
	);
};
