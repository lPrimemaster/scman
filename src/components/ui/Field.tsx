import { For, Show, splitProps, type JSX, type ParentComponent } from 'solid-js';
import { cx } from './cx';
import { Icon } from './Icon';

const CONTROL =
	'w-full rounded-xl border border-border bg-surface px-3.5 text-sm text-fg placeholder:text-fg-muted/70 ' +
	'transition focus:border-accent focus:outline-none focus:ring-4 focus:ring-ring ' +
	'disabled:cursor-not-allowed disabled:opacity-60';

export const Field: ParentComponent<{ label: string; hint?: string; error?: string; class?: string }> = (props) => (
	<div class={cx('flex flex-col gap-1.5', props.class)}>
		<label class='flex flex-col gap-1.5'>
			<span class='text-sm font-medium text-fg'>{props.label}</span>
			{props.children}
		</label>
		<Show when={props.error} fallback={props.hint && <span class='text-xs text-fg-muted'>{props.hint}</span>}>
			<span class='text-xs text-danger' role='alert'>
				{props.error}
			</span>
		</Show>
	</div>
);

export const Input = (props: JSX.InputHTMLAttributes<HTMLInputElement>) => {
	const [local, rest] = splitProps(props, ['class']);
	return <input {...rest} class={cx(CONTROL, 'h-11 read-only:bg-surface-2', local.class)} />;
};

export const Textarea = (props: JSX.TextareaHTMLAttributes<HTMLTextAreaElement>) => {
	const [local, rest] = splitProps(props, ['class']);
	return (
		<textarea
			{...rest}
			class={cx(CONTROL, 'min-h-28 py-2.5 leading-relaxed read-only:bg-surface-2', local.class)}
		/>
	);
};

export interface Option<T extends string | number> {
	value: T;
	label: string;
}

export function Select<T extends string | number>(props: {
	value: T | undefined;
	options: Option<T>[];
	onChange: (value: T) => void;
	placeholder?: string;
	required?: boolean;
	disabled?: boolean;
	class?: string;
	id?: string;
	'aria-label'?: string;
}) {
	function handle(e: Event & { currentTarget: HTMLSelectElement }) {
		const opt = props.options[Number(e.currentTarget.value)];
		if (opt) props.onChange(opt.value);
	}

	const selectedIndex = () => props.options.findIndex((o) => o.value === props.value);

	return (
		<div class={cx('relative', props.class)}>
			<select
				id={props.id}
				aria-label={props['aria-label']}
				class={cx(CONTROL, 'h-11 appearance-none pr-9 cursor-pointer')}
				required={props.required}
				disabled={props.disabled}
				value={selectedIndex() === -1 ? '' : String(selectedIndex())}
				onChange={handle}
			>
				<Show when={selectedIndex() === -1}>
					<option value='' disabled>
						{props.placeholder ?? 'Selecionar…'}
					</option>
				</Show>
				<For each={props.options}>{(opt, i) => <option value={String(i())}>{opt.label}</option>}</For>
			</select>
			<Icon
				name='chevron-down'
				class='pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted'
			/>
		</div>
	);
}

export const Checkbox = (props: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
	<label class='inline-flex cursor-pointer items-center gap-2 text-sm text-fg select-none'>
		<input
			type='checkbox'
			class='size-4 cursor-pointer rounded border-border accent-[var(--accent)]'
			checked={props.checked}
			onChange={(e) => props.onChange(e.currentTarget.checked)}
		/>
		{props.label}
	</label>
);

export const SearchInput = (props: { value: string; onInput: (v: string) => void; placeholder?: string }) => (
	<div class='relative'>
		<Icon
			name='search'
			class='pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-muted'
		/>
		<input
			type='search'
			value={props.value}
			onInput={(e) => props.onInput(e.currentTarget.value)}
			placeholder={props.placeholder ?? 'Pesquisar…'}
			class={cx(CONTROL, 'h-11 pl-10')}
		/>
	</div>
);
