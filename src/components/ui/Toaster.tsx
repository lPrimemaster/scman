import { For } from 'solid-js';
import { Portal } from 'solid-js/web';
import { dismissToast, toasts } from '../../lib/toast';
import { cx } from './cx';
import { Icon } from './Icon';

export const Toaster = () => (
	<Portal>
		<div
			class='pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6'
			aria-live='polite'
		>
			<For each={toasts()}>
				{(t) => (
					<div
						role='status'
						class={cx(
							'pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-lg',
							'animate-[pop_150ms_ease-out] bg-surface',
							t.kind === 'error' ? 'border-danger/40 text-danger' : 'border-border text-fg'
						)}
					>
						<Icon
							name={t.kind === 'error' ? 'ban' : 'check'}
							class={cx('size-4 shrink-0', t.kind === 'success' && 'text-success')}
						/>
						<span class='flex-1'>{t.message}</span>
						<button
							class='text-fg-muted hover:text-fg cursor-pointer'
							aria-label='Fechar'
							onClick={() => dismissToast(t.id)}
						>
							<Icon name='x' class='size-3.5' />
						</button>
					</div>
				)}
			</For>
		</div>
	</Portal>
);
