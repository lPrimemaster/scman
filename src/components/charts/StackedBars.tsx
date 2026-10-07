import { For, Show, type Component, type JSX } from 'solid-js';
import { cx } from '../ui/cx';
import { createTooltip } from './Tooltip';

export interface BarSegment {
	key: string;
	label: string;
	value: number;
	color: string;
	/** Text colour for an inline label on this fill */
	ink: 'light' | 'dark';
}

export interface BarRow {
	key: string;
	label: JSX.Element;
	/** Plain-text name, for tooltips and screen readers */
	name: string;
	caption?: string;
	segments: BarSegment[];
}

// Inline percentages only where they comfortably fit; the rest live in the tooltip and tables
const MIN_LABEL_SHARE = 0.12;

const pct = (share: number) => `${Math.round(share * 100)}%`;

/** Horizontal 100% stacked bars: one per row, segments separated by a 2px surface gap. */
export const StackedBars: Component<{ rows: BarRow[]; ariaLabel: string }> = (props) => {
	const tip = createTooltip();

	return (
		<div ref={tip.ref} class='relative flex flex-col gap-4' role='group' aria-label={props.ariaLabel}>
			<For each={props.rows}>
				{(row) => {
					const total = () => row.segments.reduce((sum, s) => sum + s.value, 0);
					const visible = () => row.segments.filter((s) => s.value > 0);
					return (
						<div>
							<div class='mb-1.5 flex items-baseline justify-between gap-3 text-sm'>
								<span class='min-w-0 truncate text-fg'>{row.label}</span>
								<Show when={row.caption}>
									<span class='shrink-0 text-xs text-fg-muted tabular-nums'>{row.caption}</span>
								</Show>
							</div>
							<Show
								when={total() > 0}
								fallback={<div class='h-5 rounded-r-[4px] bg-viz-track' aria-label='Sem dados' />}
							>
								<div class='flex h-5 gap-[2px]'>
									<For each={visible()}>
										{(seg, i) => {
											const share = () => seg.value / total();
											const content = () => ({
												title: row.name,
												rows: [
													{
														color: seg.color,
														label: seg.label,
														value: `${seg.value} · ${pct(share())}`
													}
												],
												footer: `${total()} esperados`
											});
											return (
												<span
													tabindex='0'
													aria-label={`${row.name}, ${seg.label}: ${seg.value} (${pct(share())})`}
													class={cx(
														'flex min-w-[3px] items-center justify-center text-[11px] font-medium outline-none transition-[filter] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring',
														i() === visible().length - 1 && 'rounded-r-[4px]',
														seg.ink === 'light' ? 'text-white' : 'text-fg'
													)}
													style={{ width: `${share() * 100}%`, background: seg.color }}
													onPointerEnter={(e) => tip.show(e.currentTarget, content())}
													onPointerLeave={tip.hide}
													onFocus={(e) => tip.show(e.currentTarget, content())}
													onBlur={tip.hide}
												>
													<Show when={share() >= MIN_LABEL_SHARE}>{pct(share())}</Show>
												</span>
											);
										}}
									</For>
								</div>
							</Show>
						</div>
					);
				}}
			</For>
			<tip.View />
		</div>
	);
};
