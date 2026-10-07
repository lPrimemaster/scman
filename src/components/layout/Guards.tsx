import { Navigate } from '@solidjs/router';
import { Match, onMount, Switch, type ParentComponent } from 'solid-js';
import { useSession } from '../../lib/session';
import { syncPush } from '../../lib/push';
import { PageSpinner } from '../ui/Feedback';
import { AppShell } from './AppShell';
import { EventDetailRoute } from '../../features/events/EventDetail';

/** Layout for signed-in pages. */
export const ProtectedLayout: ParentComponent = (props) => {
	const session = useSession();
	onMount(() => {
		if (session.token()) syncPush();
	});

	return (
		<Switch>
			<Match when={!session.token()}>
				<Navigate href='/login' />
			</Match>
			<Match when={session.loading() && !session.user()}>
				<PageSpinner />
			</Match>
			<Match when={!session.user()}>
				<Navigate href='/login' />
			</Match>
			<Match when={session.user()}>
				<AppShell>{props.children}</AppShell>
				<EventDetailRoute />
			</Match>
		</Switch>
	);
};

export const AdminOnly: ParentComponent = (props) => {
	const session = useSession();
	return (
		<Switch>
			<Match when={session.isAdmin()}>{props.children}</Match>
			<Match when={!session.isAdmin()}>
				<Navigate href='/' />
			</Match>
		</Switch>
	);
};
