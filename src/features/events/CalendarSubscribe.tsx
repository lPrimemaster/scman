import { createResource, createSignal, Show, type Component } from 'solid-js';
import { api } from '../../lib/api';
import { absoluteUrl } from '../../lib/media';
import { toast, toastError } from '../../lib/toast';
import { Dialog } from '../../components/ui/Dialog';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Field';
import { PageSpinner } from '../../components/ui/Feedback';
import { CopyField } from '../admin/CopyField';

/** Personal calendar feed: Google / Apple / Outlook keep the club events in sync. */
export const CalendarSubscribeDialog: Component<{ open: boolean; onClose: () => void }> = (props) => {
	const [feed, { mutate }] = createResource(
		() => props.open,
		() => api.calendar.feed()
	);
	const [onlyGoing, setOnlyGoing] = createSignal(false);
	const [regenerating, setRegenerating] = createSignal(false);

	const httpsUrl = () => {
		const path = feed()?.path;
		return path ? absoluteUrl(path) + (onlyGoing() ? '?only=going' : '') : '';
	};
	// webcal:// opens the system calendar app with a "subscribe" prompt
	const webcalUrl = () => httpsUrl().replace(/^https?:/, 'webcal:');
	const googleUrl = () => `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl())}`;

	async function regenerate() {
		setRegenerating(true);
		try {
			mutate(await api.calendar.regenerate());
			toast.success('Novo link criado. O anterior deixou de funcionar.');
		} catch (err) {
			toastError('Não foi possível criar um novo link.')(err);
		} finally {
			setRegenerating(false);
		}
	}

	return (
		<Dialog open={props.open} onClose={props.onClose} title='Subscrever calendário' size='md'>
			<Show when={feed()} fallback={<PageSpinner />}>
				<div class='flex flex-col gap-4'>
					<p class='text-sm text-fg-muted'>
						Adiciona os eventos do clube ao teu calendário. Alterações e novos eventos aparecem sozinhos (o
						calendário atualiza algumas vezes por dia).
					</p>
					<Checkbox
						label='Só eventos em que estou disponível'
						checked={onlyGoing()}
						onChange={setOnlyGoing}
					/>
					<div class='flex flex-col gap-2 sm:flex-row'>
						<ButtonLink variant='primary' icon='calendar-plus' href={webcalUrl()} class='sm:flex-1'>
							Abrir no calendário
						</ButtonLink>
						<ButtonLink
							icon='external-link'
							href={googleUrl()}
							target='_blank'
							rel='noopener'
							class='sm:flex-1'
						>
							Google Calendar
						</ButtonLink>
					</div>
					<div class='flex flex-col gap-1.5'>
						<span class='text-sm font-medium'>Ou copia o link</span>
						<CopyField value={httpsUrl()} label='Link do calendário' />
						<span class='text-xs text-fg-muted'>
							Este link é pessoal: quem o tiver vê os teus eventos. Se o partilhaste por engano, cria um
							novo.
						</span>
					</div>
					<Button
						variant='ghost'
						size='sm'
						icon='refresh'
						class='self-start'
						loading={regenerating()}
						onClick={regenerate}
					>
						Gerar novo link
					</Button>
				</div>
			</Show>
		</Dialog>
	);
};
