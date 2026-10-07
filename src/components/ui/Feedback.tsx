import { Show, type ParentComponent } from 'solid-js';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';

export const Spinner = (props: { class?: string }) => (
	<svg class={cx('animate-spin', props.class ?? 'size-5')} viewBox='0 0 24 24' fill='none' aria-hidden='true'>
		<circle cx='12' cy='12' r='9' stroke='currentColor' stroke-opacity='0.2' stroke-width='3' />
		<path d='M21 12a9 9 0 0 0-9-9' stroke='currentColor' stroke-width='3' stroke-linecap='round' />
	</svg>
);

export const PageSpinner = () => (
	<div class='flex justify-center py-16 text-fg-muted' role='status' aria-label='A carregar'>
		<Spinner class='size-6' />
	</div>
);

export const EmptyState: ParentComponent<{ icon?: IconName; title: string; class?: string }> = (props) => (
	<div class={cx('flex flex-col items-center gap-2 px-6 py-10 text-center', props.class)}>
		<div class='flex size-10 items-center justify-center rounded-full bg-surface-2 text-fg-muted'>
			<Icon name={props.icon ?? 'inbox'} class='size-5' />
		</div>
		<p class='text-sm font-medium text-fg'>{props.title}</p>
		<Show when={props.children}>
			<div class='text-sm text-fg-muted'>{props.children}</div>
		</Show>
	</div>
);

type Tone = 'neutral' | 'accent' | 'success' | 'danger' | 'warning';

const TONES: Record<Tone, string> = {
	neutral: 'bg-surface-2 text-fg-muted',
	accent: 'bg-accent-soft text-accent-strong',
	success: 'bg-success-soft text-success',
	danger: 'bg-danger-soft text-danger',
	warning: 'bg-warning-soft text-warning'
};

export const Badge: ParentComponent<{ tone?: Tone; class?: string; dot?: string; title?: string }> = (props) => (
	<span
		title={props.title}
		class={cx(
			'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
			TONES[props.tone ?? 'neutral'],
			props.class
		)}
	>
		<Show when={props.dot}>
			<span class='size-1.5 rounded-full' style={{ background: props.dot }} />
		</Show>
		{props.children}
	</span>
);

export const Notice: ParentComponent<{ tone?: Tone; icon?: IconName; class?: string }> = (props) => (
	<div
		class={cx(
			'flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-sm',
			TONES[props.tone ?? 'neutral'],
			props.class
		)}
	>
		<Show when={props.icon}>
			<Icon name={props.icon!} class='mt-0.5 size-4 shrink-0' />
		</Show>
		<div class='min-w-0 flex-1'>{props.children}</div>
	</div>
);

/** `label` names the card as a landmark region (useful when similar cards repeat on a page). */
export const Card: ParentComponent<{ class?: string; label?: string }> = (props) => (
	<section aria-label={props.label} class={cx('rounded-2xl border border-border bg-surface', props.class)}>
		{props.children}
	</section>
);

export const SectionHeader: ParentComponent<{ title: string; subtitle?: string }> = (props) => (
	<div class='flex items-center justify-between gap-3 px-4 pt-4 pb-2 sm:px-5'>
		<div>
			<h2 class='text-base font-semibold text-fg'>{props.title}</h2>
			<Show when={props.subtitle}>
				<p class='text-sm text-fg-muted'>{props.subtitle}</p>
			</Show>
		</div>
		{props.children}
	</div>
);

export const PageHeader: ParentComponent<{ title: string; subtitle?: string }> = (props) => (
	<div class='mb-5 flex flex-wrap items-end justify-between gap-3'>
		<div>
			<h1 class='text-2xl font-semibold tracking-tight text-fg'>{props.title}</h1>
			<Show when={props.subtitle}>
				<p class='mt-1 text-sm text-fg-muted'>{props.subtitle}</p>
			</Show>
		</div>
		<div class='flex items-center gap-2'>{props.children}</div>
	</div>
);
