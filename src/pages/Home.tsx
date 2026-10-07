import { createResource, createSignal, For, Show, type Component } from 'solid-js';
import { api } from '../lib/api';
import type { EventType } from '../lib/types';
import { useSession } from '../lib/session';
import { isFederated } from '../lib/events';
import { eventsVersion } from '../lib/eventsBus';
import { Card, EmptyState, PageHeader, PageSpinner, SectionHeader } from '../components/ui/Feedback';
import { Button } from '../components/ui/Button';
import { EventList } from '../features/events/EventList';

const PREVIEW_COUNT = 5;

const UpcomingSection: Component<{ title: string; type: EventType; emptyText: string }> = (props) => {
	const [expanded, setExpanded] = createSignal(false);
	const [events] = createResource(
		() => [props.type, eventsVersion()] as const,
		([type]) => api.events.list({ upcoming: true, type })
	);
	const visible = () => (expanded() ? events() : events()?.slice(0, PREVIEW_COUNT)) ?? [];

	return (
		<Card>
			<SectionHeader title={props.title}>
				<Show when={(events()?.length ?? 0) > 0}>
					<span class='text-sm text-fg-muted tabular-nums'>{events()!.length}</span>
				</Show>
			</SectionHeader>
			<Show when={events.state !== 'errored'} fallback={<EmptyState title='Erro ao carregar eventos.' />}>
				<Show when={!events.loading || events()} fallback={<PageSpinner />}>
					<EventList events={visible()} emptyText={props.emptyText} />
				</Show>
			</Show>
			<Show when={(events()?.length ?? 0) > PREVIEW_COUNT}>
				<div class='border-t border-border p-2'>
					<Button variant='ghost' size='sm' block onClick={() => setExpanded(!expanded())}>
						{expanded() ? 'Mostrar menos' : `Ver todos (${events()!.length})`}
					</Button>
				</div>
			</Show>
		</Card>
	);
};

interface HomeSection {
	title: string;
	type: EventType;
	emptyText: string;
}

const FEDERATED_SECTIONS: HomeSection[] = [
	{ title: 'Próximas provas federadas', type: 2, emptyText: 'Sem provas federadas agendadas.' },
	{ title: 'Próximos estágios federados', type: 3, emptyText: 'Sem estágios federados agendados.' }
];

// Visible to every role
const OPEN_SECTIONS: HomeSection[] = [
	{ title: 'Próximas provas CPT', type: 0, emptyText: 'Sem provas CPT agendadas.' },
	{ title: 'Próximos estágios abertos', type: 1, emptyText: 'Sem estágios abertos agendados.' }
];

export const Home: Component = () => {
	const session = useSession();
	const firstName = () => session.user()?.full_name.split(' ')[0];
	const sections = () => (isFederated(session.role()) ? [...FEDERATED_SECTIONS, ...OPEN_SECTIONS] : OPEN_SECTIONS);

	return (
		<>
			<PageHeader title={`Olá, ${firstName() ?? ''}`} subtitle='Próximos eventos do clube.' />
			<div class='flex flex-col gap-5'>
				<For each={sections()}>
					{(section) => (
						<UpcomingSection title={section.title} type={section.type} emptyText={section.emptyText} />
					)}
				</For>
			</div>
		</>
	);
};
