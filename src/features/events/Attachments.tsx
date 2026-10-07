import { For, Show, type Component } from 'solid-js';
import type { EventFile } from '../../lib/types';
import { api } from '../../lib/api';
import { toastError } from '../../lib/toast';
import { Icon } from '../../components/ui/Icon';
import { Capacitor } from '@capacitor/core';

function openWithAnchor(url: string) {
	const a = document.createElement('a');
	a.href = url;
	a.target = '_blank';
	a.rel = 'noopener';
	a.click();
}

export async function openAttachment(handle: string) {
	if (Capacitor.isNativePlatform()) {
		try {
			openWithAnchor((await api.files.link(handle)).url);
		} catch (err) {
			toastError('Não foi possível abrir o anexo.')(err);
		}
		return;
	}

	// Open the window synchronously so popup blockers allow it, then point it at the signed link
	const win = window.open('', '_blank');
	try {
		const { url } = await api.files.link(handle);
		if (win) win.location.href = url;
		else window.location.href = url;
	} catch (err) {
		win?.close();
		toastError('Não foi possível abrir o anexo.')(err);
	}
}

export const Attachments: Component<{ files: EventFile[] }> = (props) => (
	<Show when={props.files.length > 0}>
		<div class='flex flex-wrap gap-2'>
			<For each={props.files}>
				{(file) => (
					<button
						class='inline-flex max-w-full cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm transition hover:bg-surface-2'
						onClick={() => openAttachment(file.handle)}
					>
						<Icon name='paperclip' class='size-4 shrink-0 text-fg-muted' />
						<span class='truncate'>{file.name}</span>
					</button>
				)}
			</For>
		</div>
	</Show>
);
