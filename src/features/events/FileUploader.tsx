import { createSignal, For, type Component } from 'solid-js';
import { Icon } from '../../components/ui/Icon';
import { IconButton } from '../../components/ui/Button';
import { cx } from '../../components/ui/cx';

export interface UploadItem {
	key: number;
	name: string;
	size?: number;
	handle?: string;
	progress: number;
	status: 'uploading' | 'done' | 'error';
	/** Already attached to the event before this edit */
	existing: boolean;
}

export function formatBytes(bytes: number) {
	if (!bytes) return '0 B';
	const units = ['B', 'kB', 'MB', 'GB'];
	const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1000)), units.length - 1);
	return `${(bytes / 1000 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export const FileUploader: Component<{
	items: UploadItem[];
	onFiles: (files: File[]) => void;
	onRemove: (item: UploadItem) => void;
}> = (props) => {
	const [dragging, setDragging] = createSignal(false);
	let input!: HTMLInputElement;

	function take(list: FileList | null | undefined) {
		if (list && list.length > 0) props.onFiles(Array.from(list));
	}

	return (
		<div class='flex flex-col gap-2'>
			<For each={props.items}>
				{(item) => (
					<div class='relative flex items-center gap-3 overflow-hidden rounded-xl border border-border bg-surface px-3 py-2'>
						<div
							class={cx(
								'absolute inset-y-0 left-0 transition-all',
								item.status === 'error' ? 'bg-danger-soft' : 'bg-accent-soft'
							)}
							style={{ width: item.status === 'done' ? '0%' : `${item.progress}%` }}
						/>
						<Icon name='paperclip' class='relative size-4 shrink-0 text-fg-muted' />
						<div class='relative min-w-0 flex-1'>
							<p class='truncate text-sm'>{item.name}</p>
							<p class='text-xs text-fg-muted'>
								{item.status === 'uploading'
									? `A enviar… ${item.progress}%`
									: item.status === 'error'
										? 'Falhou'
										: item.size !== undefined
											? formatBytes(item.size)
											: 'Anexado'}
							</p>
						</div>
						<IconButton
							icon='x'
							label={`Remover ${item.name}`}
							class='relative'
							disabled={item.status === 'uploading'}
							onClick={() => props.onRemove(item)}
						/>
					</div>
				)}
			</For>

			<button
				type='button'
				class={cx(
					'flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed px-4 py-5 text-sm transition',
					dragging() ? 'border-accent bg-accent-soft' : 'border-border text-fg-muted hover:bg-surface-2'
				)}
				onClick={() => input.click()}
				onDragOver={(e) => {
					e.preventDefault();
					setDragging(true);
				}}
				onDragLeave={() => setDragging(false)}
				onDrop={(e) => {
					e.preventDefault();
					setDragging(false);
					take(e.dataTransfer?.files);
				}}
			>
				<Icon name='upload' class='size-5' />
				<span>
					<span class='font-medium text-fg'>Escolher ficheiros</span> ou arrastar para aqui
				</span>
			</button>
			<input
				ref={input}
				type='file'
				multiple
				hidden
				data-testid='file-input'
				onChange={(e) => {
					take(e.currentTarget.files);
					e.currentTarget.value = '';
				}}
			/>
		</div>
	);
};
