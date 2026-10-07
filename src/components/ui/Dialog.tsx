import { createEffect, createSignal, onCleanup, Show, type JSX, type ParentComponent } from 'solid-js';
import { Portal } from 'solid-js/web';
import { cx } from './cx';
import { IconButton, Button } from './Button';

let openDialogs = 0;

/** Centered dialog on desktop, bottom sheet on mobile. */
export const Dialog: ParentComponent<{
	open: boolean;
	onClose: () => void;
	title?: JSX.Element;
	footer?: JSX.Element;
	size?: 'sm' | 'md' | 'lg';
	/** Accessible name when `title` is not plain text */
	label?: string;
}> = (props) => {
	createEffect(() => {
		if (!props.open) return;
		const onKey = (e: KeyboardEvent) => e.key === 'Escape' && props.onClose();
		document.addEventListener('keydown', onKey);
		if (openDialogs++ === 0) document.body.style.overflow = 'hidden';
		onCleanup(() => {
			document.removeEventListener('keydown', onKey);
			if (--openDialogs === 0) document.body.style.overflow = '';
		});
	});

	return (
		<Show when={props.open}>
			<Portal>
				<div class='fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6'>
					<div
						class='absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-[fade_150ms_ease-out]'
						onClick={() => props.onClose()}
					/>
					<div
						role='dialog'
						aria-modal='true'
						aria-label={props.label ?? (typeof props.title === 'string' ? props.title : undefined)}
						class={cx(
							'relative flex max-h-[92dvh] w-full flex-col overflow-hidden bg-surface text-fg shadow-2xl',
							'rounded-t-3xl border-t border-border sm:rounded-2xl sm:border',
							'animate-[sheet_200ms_ease-out] sm:animate-[pop_150ms_ease-out]',
							{ sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl' }[props.size ?? 'md']
						)}
					>
						<div class='mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border sm:hidden' />
						<div class='flex shrink-0 items-start justify-between gap-3 px-5 pt-3 pb-2 sm:pt-5'>
							<div class='min-w-0 flex-1 text-lg font-semibold'>{props.title}</div>
							<IconButton icon='x' label='Fechar' onClick={() => props.onClose()} class='-mr-2 -mt-1' />
						</div>
						<div class='min-h-0 flex-1 overflow-y-auto px-5 pb-5'>{props.children}</div>
						<Show when={props.footer}>
							<div class='pb-safe shrink-0 border-t border-border bg-surface px-5 py-3'>
								<div class='flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'>{props.footer}</div>
							</div>
						</Show>
					</div>
				</div>
			</Portal>
		</Show>
	);
};

export const ConfirmDialog: ParentComponent<{
	open: boolean;
	title: string;
	confirmLabel: string;
	danger?: boolean;
	onConfirm: () => Promise<unknown> | void;
	onClose: () => void;
}> = (props) => {
	const [busy, setBusy] = createSignal(false);

	async function confirm() {
		setBusy(true);
		try {
			await props.onConfirm();
			props.onClose();
		} finally {
			setBusy(false);
		}
	}

	return (
		<Dialog
			open={props.open}
			onClose={props.onClose}
			title={props.title}
			size='sm'
			footer={
				<>
					<Button onClick={() => props.onClose()}>Cancelar</Button>
					<Button variant={props.danger ? 'danger' : 'primary'} loading={busy()} onClick={confirm}>
						{props.confirmLabel}
					</Button>
				</>
			}
		>
			<div class='text-sm text-fg-muted'>{props.children}</div>
		</Dialog>
	);
};
