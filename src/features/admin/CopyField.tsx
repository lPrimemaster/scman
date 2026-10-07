import { type Component } from 'solid-js';
import { copyToClipboard } from '../../lib/media';
import { toast } from '../../lib/toast';
import { IconButton } from '../../components/ui/Button';

export async function copyWithToast(text: string) {
	try {
		await copyToClipboard(text);
		toast.success('Link copiado.');
	} catch {
		toast.error('Não foi possível copiar.');
	}
}

export const CopyField: Component<{ value: string; label?: string }> = (props) => (
	<div class='flex items-center gap-1 rounded-xl border border-border bg-surface-2 py-1 pr-1 pl-3'>
		<input
			class='min-w-0 flex-1 bg-transparent text-sm text-fg-muted outline-none'
			value={props.value}
			aria-label={props.label ?? 'Link'}
			readonly
			onFocus={(e) => e.currentTarget.select()}
		/>
		<IconButton icon='copy' label='Copiar' onClick={() => copyWithToast(props.value)} />
	</div>
);
