import { Show, splitProps, type JSX, type ParentComponent } from 'solid-js';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';
import { Spinner } from './Feedback';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
	primary: 'bg-accent text-accent-fg hover:bg-accent-strong',
	secondary: 'bg-surface text-fg border border-border hover:bg-surface-2',
	ghost: 'text-fg hover:bg-surface-2',
	danger: 'bg-danger text-white hover:opacity-90'
};

const SIZES: Record<Size, string> = {
	sm: 'h-8 px-3 text-sm gap-1.5 rounded-lg',
	md: 'h-10 px-4 text-sm gap-2 rounded-xl',
	lg: 'h-12 px-5 text-base gap-2 rounded-xl'
};

export type ButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: Variant;
	size?: Size;
	icon?: IconName;
	loading?: boolean;
	block?: boolean;
};

export const Button: ParentComponent<ButtonProps> = (props) => {
	const [local, rest] = splitProps(props, ['variant', 'size', 'icon', 'loading', 'block', 'class', 'children']);
	return (
		<button
			type='button'
			{...rest}
			disabled={rest.disabled || local.loading}
			class={cx(
				'inline-flex items-center justify-center font-medium whitespace-nowrap transition-colors select-none',
				'cursor-pointer disabled:cursor-not-allowed disabled:opacity-50',
				VARIANTS[local.variant ?? 'secondary'],
				SIZES[local.size ?? 'md'],
				local.block && 'w-full',
				local.class
			)}
		>
			<Show when={local.loading} fallback={local.icon && <Icon name={local.icon} class='size-4 shrink-0' />}>
				<Spinner class='size-4' />
			</Show>
			{local.children}
		</button>
	);
};

export const IconButton = (
	props: JSX.ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; variant?: Variant }
) => {
	const [local, rest] = splitProps(props, ['icon', 'label', 'variant', 'class']);
	return (
		<button
			type='button'
			aria-label={local.label}
			title={local.label}
			{...rest}
			class={cx(
				'inline-flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors cursor-pointer',
				'disabled:cursor-not-allowed disabled:opacity-40',
				local.variant === 'danger'
					? 'text-danger hover:bg-danger-soft'
					: 'text-fg-muted hover:bg-surface-2 hover:text-fg',
				local.class
			)}
		>
			<Icon name={local.icon} class='size-4' />
		</button>
	);
};
