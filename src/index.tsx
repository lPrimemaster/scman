/* @refresh reload */
import './index.css';
import { render } from 'solid-js/web';
import { Navigate, Route, Router } from '@solidjs/router';
import { SessionProvider } from './lib/session';
import { Toaster } from './components/ui/Toaster';
import { AdminOnly, ProtectedLayout } from './components/layout/Guards';
import { Home } from './pages/Home';
import { CalendarPage } from './pages/Calendar';
import { Login } from './pages/Login';
import { SetPasswordPage } from './pages/SetPassword';
import { AdminHome } from './features/admin/AdminHome';
import { InvitesPage } from './features/admin/InvitesPage';
import { UsersPage } from './features/admin/UsersPage';
import { EventsAdmin } from './features/admin/EventsAdmin';
import { StatsPage } from './features/admin/StatsPage';

if (import.meta.env.DEV) {
	await import('solid-devtools');
}

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found.');

render(
	() => (
		<SessionProvider>
			<Router>
				{/* Public */}
				<Route path='/login' component={Login} />
				{/* Paths kept stable: links handed out to users point here */}
				<Route path='/activate' component={() => <SetPasswordPage mode='activate' />} />
				<Route path='/reset_password' component={() => <SetPasswordPage mode='reset' />} />

				{/* Signed in */}
				<Route path='/' component={ProtectedLayout}>
					<Route path='/' component={Home} />
					<Route path='/calendar' component={CalendarPage} />
					<Route path='/admin' component={AdminOnly}>
						<Route path='/' component={AdminHome} />
						<Route path='/register' component={InvitesPage} />
						<Route path='/manage' component={UsersPage} />
						<Route path='/events' component={EventsAdmin} />
						<Route path='/stats' component={StatsPage} />
					</Route>
				</Route>

				<Route path='*' component={() => <Navigate href='/' />} />
			</Router>
			<Toaster />
		</SessionProvider>
	),
	root
);
