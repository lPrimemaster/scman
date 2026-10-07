import { createContext, createResource, createSignal, useContext, type ParentComponent } from 'solid-js';
import { api, setAuthFailureHandler, tokenStore } from './api';
import { unregisterPush } from './push';
import { toast } from './toast';
import type { Role, User } from './types';

interface Session {
	token: () => string | null;
	user: () => User | undefined;
	loading: () => boolean;
	role: () => Role | undefined;
	isAdmin: () => boolean;
	login: (username: string, password: string) => Promise<User>;
	logout: () => Promise<void>;
}

const SessionContext = createContext<Session>();

export const SessionProvider: ParentComponent = (props) => {
	const [token, setToken] = createSignal(tokenStore.get());
	const [user, { mutate }] = createResource(token, () => api.auth.me().catch(() => undefined));

	function clear() {
		tokenStore.clear();
		mutate(undefined);
		setToken(null);
	}

	setAuthFailureHandler((reason) => {
		if (reason === 'disabled') toast.error('Conta desativada por um administrador.');
		clear();
	});

	const session: Session = {
		token,
		user: () => (token() ? user() : undefined),
		loading: () => user.loading,
		role: () => session.user()?.role,
		isAdmin: () => session.role() === 'admin',
		async login(username, password) {
			const res = await api.auth.login(username, password);
			tokenStore.set(res.token);
			setToken(res.token);
			mutate(res.user);
			return res.user;
		},
		async logout() {
			await unregisterPush();
			clear();
		}
	};

	return <SessionContext.Provider value={session}>{props.children}</SessionContext.Provider>;
};

export function useSession() {
	const session = useContext(SessionContext);
	if (!session) throw new Error('useSession must be used inside <SessionProvider>');
	return session;
}
