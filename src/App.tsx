import type { Component, JSXElement } from 'solid-js';
import { Navigate, A, useNavigate } from '@solidjs/router';
import { createEffect, createResource, createSignal, For, onCleanup, onMount, Show, untrack } from 'solid-js';
import { createStore } from 'solid-js/store';

import { EventInput, Calendar as FCCalendar } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';

function getToken() {
	return localStorage.getItem('token');
}

async function checkToken() {
	const token = getToken();
	if(!token) {
		console.log('no token');
		return false;
	}

	try {
		const res = await authFetch('/api/vcheck');
		return res.ok;
	} catch {
		return false;
	}
}

async function checkTokenAdmin() {
	const token = getToken();
	if(!token) {
		console.log('no token');
		return false;
	}

	try {
		const res = await authFetch('/api/adminvcheck');
		return res.ok;
	} catch {
		return false;
	}
}

function authFetch(url: string, options: any = {}) {
	return fetch(
		url,
		{
			...options,
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${getToken()}`,
				...options.headers
			}
		}
	);
}

function convertDateLocale(value: string) {
	return new Date(value).toLocaleDateString('pt-PT', {
		year: 'numeric',
		month: 'short',
		day: '2-digit',
	});
}

const NavigateHome : Component = () => {
	return <Navigate href='/'/>
};

const NavigateLogin : Component = () => {
	return <Navigate href='/login'/>;
};

const Protected : Component<{ children?: JSXElement }> = (props) => {
	const [check] = createResource(checkToken);

	return (
		<Show when={!check.loading}>
			<Show
				when={check()}
				fallback={<NavigateLogin/>}
			>
				{props.children}
			</Show>
		</Show>
	);
};

const AdminProtected : Component<{ children?: JSXElement }> = (props) => {
	const [check] = createResource(checkTokenAdmin);

	return (
		<Show when={!check.loading}>
			<Show
				when={check()}
				fallback={<NavigateHome/>}
			>
				{props.children}
			</Show>
		</Show>
	);
};

export function protect(Comp: Component) : Component {
	const IPComp : Component = () => {
		return (
			<Protected>
				<Comp/>
			</Protected>
		);
	};
	return IPComp;
}

export function protectAdmin(Comp: Component) : Component {
	const IAPComp : Component = () => {
		return (
			<AdminProtected>
				<Comp/>
			</AdminProtected>
		);
	};
	return IAPComp;
}

const Card : Component<{ class?: string, children?: JSXElement }> = (props) => {
	return (
		<div class={`${props.class} bg-gray-200 p-5 mb-5 rounded-md shadow-md hover:shadow-lg`} style='break-inside: avoid-column;'>
			{props.children}
		</div>
	);
};

interface Toast {
	id: number;
	message: string;
	type: 'info' | 'error';
	duration: number;
};

let toast_id = 0;
const [toasts, setToasts] = createSignal<Toast[]>([]);
function pushMessage(message: string, type: Toast['type'], duration: number = 3000) {
	const id = toast_id++;
	setToasts((p) => [...p, { id, message, type, duration }]);
	setTimeout(() => {
		setToasts((p) => p.filter((t) => t.id !== id));
	}, duration);
}

export const PopoutMessageSpace : Component = () => {
	return (
		<Show when={toasts().length > 0}>
			<div class='fixed bottom-0 left-0 right-0 text-sm font-semibold text-center p-3 z-100 shadow'>
				<For each={toasts()}>{(toast) => {
					return (
						<div class={
							`mb-2 px-5 py-2 rounded-md ${toast.type === 'info' ? 'text-blue-900 bg-blue-300' : 'text-red-900 bg-red-300'}`
						}>
							{toast.message}
						</div>
					);
				}}</For>
			</div>
		</Show>
	);
};

const Footer : Component = () => {
	return (
		<div class="fixed bottom-0 left-0 right-0 bg-transparent text-sm font-semibold text-center p-3 z-10 text-white">
			v0.2
		</div>
	);
};

export const Login : Component = () => {
	const [username, setUsername] = createSignal<string>('');
	const [password, setPassword] = createSignal<string>('');
	const navigate = useNavigate();

	async function loginRequest(e: Event) {
		e.preventDefault();

		const loginres = await fetch('/api/login', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ username: username(), password: password() })
		});

		if(loginres.ok) {
			const data = await loginres.json();
			localStorage.setItem('token', data.token);
			navigate('/');
			return;
		}
		
		// Error!
		pushMessage('Credenciais inválidas.', 'error');
	}

	// Go to main page if token found and valid
	onMount(async () => {
		if(await checkToken()) {
			navigate('/');
			return;
		}
	});

	return (
		<div class='min-h-screen flex items-center justify-center bg-gray-900'>
			<div class='w-full max-w-md p-5 bg-gray-700 rounded-2xl'>
				<div class='flex justify-center'>
					<img
						src='/logo.svg'
						alt='Logo'
						class='w-30 mb-5'
					/>
				</div>
				<h1 class='text-xl text-center font-medium text-gray-200'>Login Manager Ciclismo</h1>
				<form onSubmit={loginRequest} class='space-y-4'>
					<div>
						<label class='block text-gray-200 text-sm font-medium mb-1'>Username</label>
						<input
							type='text'
							autocomplete='username'
							value={username()}
							onInput={(e) => setUsername(e.currentTarget.value)}
							class='w-full border border-gray-500 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-200'
							required
						/>
					</div>
					<div>
						<label class='block text-gray-200 text-sm font-medium mb-1'>Password</label>
						<input
							type='password'
							autocomplete='current-password'
							value={password()}
							onInput={(e) => setPassword(e.currentTarget.value)}
							class='w-full border border-gray-500 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-200'
							required
						/>
					</div>
					<button
						type='submit'
						class='w-full bg-blue-600 text-gray-200 py-2 rounded-lg hover:bg-blue-700 transition cursor-pointer'
					>
						Log In
					</button>
				</form>
			</div>
			<Footer/>
		</div>
	);
};

const Modal : Component<{ open: boolean, onChange: Function, children?: JSXElement }> = (props) => {
	return (
		<Show when={props.open}>
			<div class='fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50'>
				<div class='bg-gray-700 rounded-lg md:p-6 w-3/4 shadow-lg relative text-gray-100 overflow-x-hidden overflow-y-auto max-h-3/4 md:max-h-14/16'>
					<div
						class='absolute top-2 right-2 px-5 bg-red-500 rounded-full cursor-pointer hover:bg-red-700 transition'
						onClick={() => { props.onChange(false) }}
					>
						Fechar
					</div>
					{props.children}
				</div>
			</div>
		</Show>
	);
};

interface AccRegDetails {
	username: string;
	name: string;
	autoUsername: string;
	role: string;
	token: string;
	set: boolean;
};

interface AccDetails {
	username: string;
	name: string;
	role: string;
	link: string;
	token: string;
	status: string;
};

export const Register : Component = () => {
	const [accCreated, setAccCreated] = createStore<Array<AccRegDetails>>([{
		username: '',
		name: '',
		autoUsername: '',
		role: '',
		token: '',
		set: false 
	}]);
	const [acc, setAcc] = createStore<Array<AccDetails>>([]);
	const [showEraseModal, setShowEraseModal] = createSignal<boolean>(false);
	const [currentItem, setCurrentItem] = createSignal<AccDetails>();

	async function eraseItem() {
		const item = currentItem();
		if(item !== undefined) {
			const res = await authFetch('/api/erase_token', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ token: item.token })
			});
			setCurrentItem(undefined); 
			fetchAllLinks();
		}
	}

	async function registerRequest(e: Event, item: AccRegDetails, idx: number) {
		e.preventDefault();

		const res = await authFetch('/api/register', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ username: item.username.length === 0 ? item.autoUsername : item.username, full_name: item.name, role: item.role })
		});

		if(!res.ok) {
			pushMessage('Nome de utilizador já existe.', 'error');
		} else {
			setAccCreated(idx, 'token', window.location.origin + (await res.json()).inviteLink);
			setAccCreated(idx, 'set', true);
			const token = item.token.split('=');
			setAcc(acc.length, {
				username: item.username.length === 0 ? item.autoUsername : item.username,
				name: item.name,
				role: item.role,
				link: window.location.origin + item.token,
				token: token[token.length - 1],
				status: 'Espera ativação'
			});

			setAccCreated(accCreated.length, { username: '', name: '', autoUsername: '', role: '', token: '', set: false });
		}

		console.log(accCreated);
	}

	createEffect(() => {
		const acc = accCreated[accCreated.length - 1];
		if(acc.username.length === 0) {
			const currentName = acc.name;
			const names = currentName.split(' ');
			if(names.length > 1) {
				const autoName = names[0][0].toLowerCase() + '.' + names[names.length - 1].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
				setAccCreated(accCreated.length - 1, 'autoUsername', autoName);
			}
		}
	});

	async function copyLink() {
		const input = document.getElementById('inviteCode')! as HTMLInputElement;
		try {
			await navigator.clipboard.writeText(input.value);
			pushMessage('Link copiado.', 'info');
		} catch(err) {
			pushMessage('Erro ao copiar.', 'error');
		}
	}

	async function fetchAllLinks() {
		const res = await authFetch('/api/activation_links');

		if(!res.ok) {
			pushMessage('Erro ao ler links.', 'error');
			return;
		}

		const data = await res.json();

		setAcc([]);
		for(const account of data) {
			setAcc(acc.length, {
				username: account.username,
				name: account.full_name,
				role: account.role,
				link: window.location.origin + '/activate?token=' + account.token,
				token: account.token,
				status: account.used === 1 ? 'Conta Ativa' : (account.expires_at < Date.now() ? 'Expirado' : 'Espera ativação') // token is used?
			});
		}
	}

	onMount(() => {
		fetchAllLinks();
	});

	return (
		<>
			<Navbar/>
			<div class='min-h-screen flex items-center justify-center bg-gray-900'>
				<div class='w-full max-w-full lg:max-w-3/4 p-5 bg-gray-700 rounded-2xl'>
					<h1 class='text-xl text-center font-medium text-gray-200 mb-5'>Registo de Contas</h1>
					<For each={accCreated}>{(item, i) =>
						<form onSubmit={(evt) => registerRequest(evt, item, i())} class='flex space-x-4 overflow-x-auto'>
							<fieldset class='flex space-x-4' disabled={item.set}>
								<div>
									<label class='block text-gray-200 text-sm font-medium mb-1'>Nome</label>
									<input
										type='text'
										value={item.name}
										onInput={(e) => setAccCreated(i(), 'name', e.currentTarget.value)}
										class='min-w-32 w-full border border-gray-500 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed'
										required
									/>
								</div>
								<div>
									<label class='block text-gray-200 text-sm font-medium mb-1'>Username</label>
									<input
										type='text'
										value={item.username}
										placeholder={item.autoUsername}
										onInput={(e) => setAccCreated(i(), 'username', e.currentTarget.value)}
										class='min-w-32 w-full border border-gray-500 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed'
									/>
								</div>
								<div>
									<label class='block text-gray-200 text-sm font-medium mb-1'>Permissões</label>
									<input
										list='perm-list'
										type='text'
										value={item.role}
										onInput={(e) => setAccCreated(i(), 'role', e.currentTarget.value)}
										class='min-w-32 w-full border border-gray-500 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed'
										required
									/>
									<datalist id='perm-list'>
										<option value='user'/>
										<option value='admin'/>
									</datalist>
								</div>
								<button
									type='submit'
									class='bg-blue-600 text-gray-200 py-2 rounded-lg hover:bg-blue-700 transition cursor-pointer mt-6 px-3 disabled:cursor-not-allowed disabled:bg-blue-900 disabled:text-gray-400'
								>
									Gerar
								</button>
							</fieldset>
							<div>
								<label class='block text-gray-200 text-sm font-medium mb-1'>Link</label>
								<input
									type='text'
									id='inviteCode'
									value={item.token}
									class='min-w-32 w-full border border-gray-500 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-400 cursor-text'
									onClick={(e) => e.currentTarget.select()}
									readonly
								/>
							</div>
							<button
								type='button'
								class='bg-blue-600 text-gray-200 py-2 rounded-lg hover:bg-blue-700 transition cursor-pointer mt-6 px-3 disabled:cursor-not-allowed disabled:bg-blue-900 disabled:text-gray-400'
								onClick={copyLink}
								disabled={!item.set}
							>
								Copiar
							</button>
						</form>
					}</For>
					<div class='w-full border-b mt-5 border-white'>
					</div>
					<h1 class='text-xl text-center font-medium text-gray-200 my-5'>Links Registados</h1>
					<div>
						<Show when={acc.length === 0}>
							<div class='text-gray-400 text-center -mt-3'>
								Sem links registados
							</div>
						</Show>
						<For each={acc}>{(item) =>
							<div class='flex space-x-4 overflow-x-auto'>
								<div>
									<label class='block text-gray-200 text-sm font-medium mb-1'>Nome</label>
									<input
										type='text'
										value={item.name}
										class='min-w-32 w-full border border-gray-500 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed'
										readonly
									/>
								</div>
								<div>
									<label class='block text-gray-200 text-sm font-medium mb-1'>Username</label>
									<input
										type='text'
										value={item.username}
										class='min-w-32 w-full border border-gray-500 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed'
										readonly
									/>
								</div>
								<div>
									<label class='block text-gray-200 text-sm font-medium mb-1'>Estado</label>
									<input
										type='text'
										value={item.status}
										class={
											`min-w-32 w-full border border-gray-500 rounded-lg px-4 py-2
focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800
disabled:text-gray-400 disabled:cursor-not-allowed
${(item.status == 'Conta Ativa') ?
'bg-green-200' :
(item.status == 'Espera ativação' ?
'bg-yellow-200' :
'bg-red-200')
}`
										}
										readonly
									/>
								</div>
								<div>
									<label class='block text-gray-200 text-sm font-medium mb-1'>Permissões</label>
									<input
										type='text'
										value={item.role}
										class='min-w-32 w-full border border-gray-500 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed'
										readonly
									/>
								</div>
								<div>
									<label class='block text-gray-200 text-sm font-medium mb-1'>Link</label>
									<input
										type='text'
										value={item.link}
										onClick={(e) => e.currentTarget.select()}
										class='min-w-32 w-full border border-gray-500 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed'
										readonly
									/>
								</div>
								<button
									type='button'
									onClick={() => { setCurrentItem(item); setShowEraseModal(true); }}
									class='bg-blue-600 text-gray-200 py-2 rounded-lg hover:bg-blue-700 transition cursor-pointer mt-6 px-3 disabled:cursor-not-allowed disabled:bg-blue-900 disabled:text-gray-400'
								>
									Apagar
								</button>
							</div>
						}</For>
						<Modal open={showEraseModal()} onChange={setShowEraseModal}>
							<h1 class='text-lg text-center pt-3'>Apagar link?</h1>
							<p class='text-center'>
								Esta ação não apaga o utilizador caso já tenha sido criado. Apenas o link de ativação.
							</p>
							<div class='flex place-content-center'>
								<button
									type='button'
									onClick={() => { setShowEraseModal(false); eraseItem(); }}
									class='bg-red-600 text-gray-200 py-2 rounded-lg hover:bg-red-700 transition cursor-pointer mt-6 px-3 disabled:cursor-not-allowed disabled:bg-red-900 disabled:text-gray-400'
								>
									Apagar
								</button>
							</div>
						</Modal>
					</div>
				</div>
			</div>
		</>
	);
};

const Navbar : Component = () => {
	const navigate = useNavigate();
	const [mobileOpen, setMobileOpen] = createSignal<boolean>(false);
	const [isAdmin, setIsAdmin] = createSignal<boolean>(false);

	onMount(async () => {
		setIsAdmin(await checkTokenAdmin());
	});

	function logOut() {
		localStorage.removeItem('token');
		navigate('/login');
	}

	return (
		<nav class='bg-blue-900 shadow-md'>
			<div class='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
				<div class='hidden md:flex justify-between h-16 items-center'>
					<div class='flex-shrink-0'>
						<A href='/'>
							<img src='/logo.svg' class='h-10 w-auto'/>
						</A>
					</div>
					<div class='hidden md:flex space-x-4 text-gray-200 font-semibold text-md'>
						<A href='/' class='hover:bg-blue-700 px-3 py-2 bg-blue-800 border rounded-lg'>
							Início
						</A>
						<A href='/calendar' class='hover:bg-blue-700 px-3 py-2 bg-blue-800 border rounded-lg'>
							Calendário	
						</A>
						<Show when={isAdmin()}>
							<A href='/admin' class='hover:bg-blue-700 px-3 py-2 bg-blue-800 border rounded-lg'>
								Admin
							</A>
						</Show>
						<button onClick={logOut} class='hover:bg-blue-700 px-3 py-2 bg-blue-800 border rounded-lg cursor-pointer'>
							Logout
						</button>
					</div>
				</div>
			</div>
			<div class='md:hidden px-2 space-y-1'>
				<div class='flex flex-shrink-0 py-3 place-content-center'>
					<button onClick={() => setMobileOpen(!mobileOpen())}>
						<img src='/logo.svg' class={`${mobileOpen() ? 'h-32' : 'h-8' } w-auto`}/>
					</button>
				</div>
				<div class={`${mobileOpen() ? 'block' : 'hidden'} px-2 space-y-1 pb-3`}>
					<A href='/' class='flex block hover:bg-blue-700 px-3 py-2 bg-blue-800 border rounded-lg place-content-center'>
						Início
					</A>
					<A href='/calendar' class='flex block hover:bg-blue-700 px-3 py-2 bg-blue-800 border rounded-lg place-content-center'>
						Calendário	
					</A>
					<Show when={isAdmin()}>
						<A href='/admin' class='flex block hover:bg-blue-700 px-3 py-2 bg-blue-800 border rounded-lg place-content-center'>
							Admin
						</A>
					</Show>
					<button onClick={logOut} class='w-full block hover:bg-blue-700 px-3 py-2 bg-blue-800 border rounded-lg cursor-pointer'>
						Logout
					</button>
				</div>
			</div>
		</nav>
	);
};

function useMediaQuery(query: string) {
	const media = window.matchMedia(query);
	const [mm, setMm] = createSignal<boolean>(media.matches);

	const listener = () => setMm(media.matches);
	media.addEventListener('change', listener);
	onCleanup(() => media.removeEventListener('change', listener));
	return mm;
}

interface CEvent {
	id: number;
	name: string;
	start: string;
	end: string;
	location: string;
	sub_limit_date: string;
	type: number;
};

const NameTable : Component<{ class?: string, names: Array<string> }> = (props) => {
	return (
		<table class={props.class}>
			<thead class='bg-transparent/50 text-xs md:text-sm'>
				<tr class='border-b text-gray-400'>
					<th class='px-4 py-3 text-center text-xl font-semibold w-8'>
					</th>
				</tr>
			</thead>

			<tbody class='block min-h-8 max-h-48 overflow-y-auto divide-y divide-transparent w-full'>
				<Show when={props.names !== undefined && props.names.length === 0}>
					<div class='text-center w-full text-gray-500 py-1'>
						Sem entradas
					</div>
				</Show>
				<For each={props.names}>{(name) => {
					return (
						<tr 
							class='hover:bg-gray-500 even:bg-gray-600 odd:bg-gray-700 transition table w-full table-fixed'
						>
							<td class='px-4 py-1 text-center text-white text-xs md:text-sm'>{name}</td>
						</tr>
					);
				}}</For>
			</tbody>
		</table>
	);
};

interface CTableData {
	going: Array<string>;
	not_going: Array<string>;
	maybe: Array<string>;
	noanswer: Array<string>;
};

const Tooltip : Component<{ children?: JSXElement, description: string }> = (props) => {
	const [show, setShow] = createSignal<boolean>(false);
	return (
		<div
			class='relative inline-block'
			onMouseEnter={() => setShow(true)}
			onMouseLeave={() => setShow(false)}
			onFocus={() => setShow(true)}
			onBlur={() => setShow(false)}
		>
			{props.children}
			<Show when={show()}>
				<div
					class='absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-50'
				>
					{props.description}
				</div>
			</Show>
		</div>
	);
};

// TODO: (César) Make this nicer for mobile
const NextTable : Component<{ type: number }> = (props) => {
	const isMobile = useMediaQuery('(max-width: 768px)');
	const [competitions, setCompetitions] = createSignal<CEvent[]>([]);
	const [eventModal, setEventModal] = createSignal<boolean>(false);
	const [selectedEvent, setSelectedEvent] = createSignal<CEvent>();
	const [tableData, setTableData] = createSignal<CTableData>();
	const [selfResponse, setSelfResponse] = createSignal<number>(-1);
	const [enableVote, setEnableVote] = createSignal<boolean>(true);
	const [isCollapsed, setIsCollapsed] = createSignal<boolean>(false);

	// Fetch next competitions
	createEffect(async () => {
		const params = new URLSearchParams();
		params.append('n', isCollapsed() ? (isMobile() ? '8' : '16') : '9999');
		params.append('t', props.type.toString()); // 0 for competitions
		const res = await authFetch(`/api/upcoming?${params}`);
		let data = await res.json();

		function convertDateLocale(value: string) {
			return new Date(value).toLocaleDateString('pt-PT', {
				year: 'numeric',
				month: 'short',
				day: '2-digit',
			});
		}

		const events = new Array<CEvent>();

		for(const e of data) {
			events.push({
				id: e.id,
				name: e.name,
				start: convertDateLocale(e.start),
				end: convertDateLocale(e.end),
				sub_limit_date: convertDateLocale(e.sub_limit_date),
				location: e.location,
				type: e.type
			});
		}

		setCompetitions(events);
	});

	function eventTypeToName(type: number | undefined) {
		if(type !== undefined) {
			switch(type) {
				case 0:  return 'Prova';
				case 1:  return 'Estágio';
				default: return 'Unknown';
			}
		}
	}

	function inspectEvent(event: CEvent) {
		setSelectedEvent(event);
		setEventModal(true);
	}

	async function updateTable(event: CEvent) {
		const params = new URLSearchParams();
		params.append('event', event.id.toString());
		const data = await (await authFetch(`/api/attendance?${params}`)).json();

		setTableData({
			going: data.going.map((x: { full_name: string }) => { return x.full_name; }),
			not_going: data.not_going.map((x: { full_name: string }) => { return x.full_name; }),
			maybe: data.maybe.map((x: { full_name: string }) => { return x.full_name; }),
			noanswer: data.noanswer.map((x: { full_name: string }) => { return x.full_name; })
		});

		setSelfResponse(data.self);
	}

	createEffect(async () => {
		const event = selectedEvent();
		if(event) {
			updateTable(event);
		}
	});

	async function checkSignLimit() {
		const event = selectedEvent();
		const params = new URLSearchParams();
		params.append('id', (event?.id!).toString());
		const res = await authFetch(`/api/sign_limit_reached?${params}`);
		const data = await res.json();
		setEnableVote(!data.status);
	}

	createEffect(() => {
		if(selectedEvent()) {
			checkSignLimit();
		}
	});

	async function setEventStatus(event: CEvent, status: number) {
		const res = await authFetch('/api/sign_evt', {
			method: 'POST',
			body: JSON.stringify({ event_id: event.id, status: status })
		});

		if(!res.ok) {
			pushMessage('Erro ao atualizar estado.', 'error');
		} else {
			console.log('Updating event');

			const data = await res.json();
			if(data.limit_reached) {
				setEnableVote(false);
			}

			updateTable(selectedEvent()!);
		}
	}

	return (
		<>
			<div class='overflow-x-auto'>
				<table class='min-w-full'>
					<thead
						class='bg-transparent/50 text-xs md:text-sm cursor-pointer hover:bg-gray-500'
						onClick={() => setIsCollapsed(!isCollapsed())}
					>
						<tr class='border-b text-gray-400'>
							<th class='px-4 py-3 text-left font-semibold w-8'>
								Início
							</th>
							<th class='hidden md:table-cell px-4 py-3 text-left font-semibold w-8'>
								Fim
							</th>
							<th class='hidden md:table-cell px-4 py-3 text-left font-semibold w-48'>
								Limite inscrição
							</th>
							<th class='px-4 py-3 text-left font-semibold'>
								Nome
							</th>
							<th class='px-4 py-3 text-left font-semibold'>
								Local
							</th>
						</tr>
					</thead>

					<tbody class='divide-y divide-transparent'>
						<Show when={competitions() !== undefined && competitions().length === 0}>
							<tr>
								<td colspan='99' class='text-center text-gray-500 py-1'>
									Sem entradas
								</td>
							</tr>
						</Show>
						<For each={competitions()}>{(event) => {
							return (
								<tr 
									class='hover:bg-gray-500 even:bg-gray-600 odd:bg-gray-700 cursor-pointer transition'
									onClick={() => inspectEvent(event)}
								>
									<td class='px-4 py-1 text-left text-white text-xs md:text-sm'>{event.start}</td>
									<td class='hidden md:table-cell px-4 py-1 text-left text-white text-xs md:text-sm'>{event.end}</td>
									<td class='hidden md:table-cell px-4 py-1 text-left text-white text-xs md:text-sm'>{event.sub_limit_date}</td>
									<td class='px-4 py-1 text-left text-white text-xs md:text-sm'>{event.name}</td>
									<td class='px-4 py-1 text-left text-white text-xs md:text-sm'>{event.location}</td>
								</tr>
							);
						}}</For>
					</tbody>
				</table>
			</div>
			<Modal open={eventModal()} onChange={(s: boolean) => { setEventModal(s); setSelectedEvent(!s ? undefined : selectedEvent()); }}>
				<h2 class='text-white pt-10 md:pt-0 pb-4 text-2xl font-semibold text-center'>Evento</h2>
				<h2 class='text-white pb-1 text-lg font-semibold text-center'>Informações</h2>
				<div class='flex items-center place-content-center flex-wrap'>
					<div class='flex-grow'>
						<div class='flex gap-5 items-center text-center my-5 px-5'>
							<label class='block text-gray-200 text-md font-medium w-8 text-right'>Tipo</label>
							<input
								type='text'
								value={eventTypeToName(selectedEvent()?.type!)}
								class='w-full border border-gray-500 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-300'
								disabled
							/>
						</div>
						<div class='flex gap-5 items-center text-center my-5 px-5'>
							<label class='block text-gray-200 text-md font-medium w-8 text-right'>Nome</label>
							<input
								type='text'
								value={selectedEvent()?.name}
								class='w-full border border-gray-500 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-300'
								disabled
							/>
						</div>
						<div class='flex gap-5 items-center text-center my-5 px-5'>
							<label class='block text-gray-200 text-md font-medium w-8 text-right'>Local</label>
							<input
								type='text'
								value={selectedEvent()?.location}
								class='w-full border border-gray-500 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-300'
								disabled
							/>
						</div>
					</div>
					<div class='flex-grow'>
						<div class='flex gap-5 items-center text-center my-5 px-5'>
							<label class='block text-gray-200 text-md font-medium text-right w-1/8'>Início</label>
							<input
								type='text'
								value={selectedEvent()?.start}
								class='w-full border border-gray-500 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-300'
								disabled
							/>
						</div>
						<div class='flex gap-5 items-center text-center my-5 px-5'>
							<label class='block text-gray-200 text-md font-medium text-right w-1/8'>Fim</label>
							<input
								type='text'
								value={selectedEvent()?.end}
								class='w-full border border-gray-500 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-300'
								disabled
							/>
						</div>
						<div class='flex gap-5 items-center text-center my-5 px-5'>
							<label class='block text-gray-200 text-md font-medium text-right w-1/8'>Limite</label>
							<input
								type='text'
								value={selectedEvent()?.sub_limit_date}
								class='w-full border border-gray-500 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-300'
								disabled
							/>
						</div>
					</div>
				</div>

				<h2 class='text-white mt-10 pb-1 text-lg font-semibold text-center'>Comparência</h2>
				<div class='flex gap-5 my-5 px-5 items-center text-md font-bold place-content-center'>
					<div class='flex gap-2 flex-wrap place-content-center'>
						<button
							class={`w-32 border-2 border-green-600 rounded-md px-5 py-2 cursor-pointer hover:bg-green-700 transition disabled:text-gray-400 disabled:border-green-800 disabled:cursor-not-allowed ${selfResponse() === 1 ? 'disabled:bg-green-700 bg-green-700' : 'disabled:hover:bg-transparent'}`}
							onClick={() => setEventStatus(selectedEvent()!, 1)}
							disabled={!enableVote() || selfResponse() === 1}
						>
							Vou
						</button>
						<button
							class={`w-32 border-2 border-yellow-600 rounded-md px-5 py-2 cursor-pointer hover:bg-yellow-700 transition disabled:text-gray-400 disabled:border-yellow-800 disabled:cursor-not-allowed ${selfResponse() === 2 ? 'disabled:bg-yellow-700 bg-yellow-700' : 'disabled:hover:bg-transparent'}`}
							onClick={() => setEventStatus(selectedEvent()!, 2)}
							disabled={!enableVote() || selfResponse() === 2}
						>
							Talvez
						</button>
						<button
							class={`w-32 border-2 border-red-700 rounded-md px-5 py-2 cursor-pointer hover:bg-red-800 transition disabled:text-gray-400 disabled:border-red-900 disabled:cursor-not-allowed ${selfResponse() === 0 ? 'disabled:bg-red-800 bg-red-800' : 'disabled:hover:bg-transparent'}`}
							onClick={() => setEventStatus(selectedEvent()!, 0)}
							disabled={!enableVote() || selfResponse() === 0}
						>
							Não vou
						</button>
					</div>
				</div>
				<Show when={!enableVote()}>
					<div class='flex place-content-center'>
						<div class='border rounded-sm py-0 px-3 text-red-300 border-red-500 text-sm'>
							Limite máximo de alterações antigido.
						</div>
					</div>
				</Show>

				<h2 class='text-white mt-10 pb-1 text-lg font-semibold text-center'>Participantes</h2>
				<div class='flex place-content-center gap-5 flex-wrap'>
					<div class='min-w-3/16'>
						<div class='text-center text-lg font-semibold -mb-5 bg-green-700 rounded-md'>
							Sim
						</div>
						<NameTable class='min-w-full' names={tableData()?.going!}/>
					</div>
					<div class='min-w-3/16'>
						<div class='text-center text-lg font-semibold -mb-5 bg-yellow-600 rounded-md'>
							Talvez
						</div>
						<NameTable class='min-w-full' names={tableData()?.maybe!}/>
					</div>
					<div class='min-w-3/16'>
						<div class='text-center text-lg font-semibold -mb-5 bg-red-700 rounded-md'>
							Não
						</div>
						<NameTable class='min-w-full' names={tableData()?.not_going!}/>
					</div>
					<div class='min-w-3/16 max-w-1/4 hidden md:block'>
						<div class='text-center text-lg font-semibold -mb-5 bg-gray-500 rounded-md'>
							Sem resposta
						</div>
						<NameTable class='min-w-full' names={tableData()?.noanswer!}/>
					</div>
				</div>
			</Modal>
		</>
	);
};

const LButton : Component<{ onClick?: (e: MouseEvent) => void, children?: JSXElement }> = (props) => {
	return (
		<button
			class='size-22 place-items-center rounded-md shadow-md bg-gray-600 hover:bg-gray-500 cursor-pointer hover:shadow-lg active:bg-gray-400 transition'
			onClick={props.onClick}
		>
			{props.children}
		</button>
	);
};

const AccountManager : Component = () => {
	const navigate = useNavigate();

	return (
		<div class='p-5 flex flex-wrap gap-5 place-content-center'>
			<LButton
				onClick={() => navigate('/register')}
			>
				<img src='/add.svg' class='size-10'/>
				<div class='text-xs font-semibold pt-3'>Nova Conta</div>
			</LButton>
			<LButton>
				<img src='/remove.svg' class='size-10'/>
				<div class='text-xs font-semibold pt-3'>Apagar Conta</div>
			</LButton>
		</div>
	);
};

const NewEvent : Component<{ open: boolean, onChange: Function }> = (props) => {
	const [name, setName] = createSignal<string>('');
	const [location, setLocation] = createSignal<string>('');
	const [start, setStart] = createSignal<string>('');
	const [end, setEnd] = createSignal<string>('');
	const [limit, setLimit] = createSignal<string>('');
	const [maxAlt, setMaxAlt] = createSignal<number>(5);
	const [type, setType] = createSignal<string>('');

	function getValidateDateMin() {
		return new Date().toISOString().split('T')[0];
	}

	async function submitEvent(e: Event) {
		e.preventDefault();

		const res = await authFetch('/api/new_event', {
			method: 'POST',
			body: JSON.stringify({
				name: name(),
				location: location(),
				start: start(),
				end: end(),
				limit: limit(),
				maxalt: maxAlt(),
				type: type() === 'Prova' ? 0 : 1
			})
		});

		if(!res.ok) {
			pushMessage('Falha ao cria evento.', 'error');
		} else {
			props.onChange(false);
			pushMessage('Evento criado.', 'info');
		}
	}

	return (
		<Modal {...props}>
			<h2 class='text-white pt-10 md:pt-0 pb-4 text-2xl font-semibold text-center'>Novo Evento</h2>
			<div class='flex place-content-center'>
				<form onSubmit={submitEvent} class='lg:w-3/4 space-y-4'>
					<div>
						<label class='block text-gray-200 text-sm font-medium mb-1'>Nome</label>
						<input
							type='text'
							value={name()}
							onInput={(e) => setName(e.currentTarget.value)}
							class='w-full border border-gray-500 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-200'
							required
						/>
					</div>
					<div>
						<label class='block text-gray-200 text-sm font-medium mb-1'>Local</label>
						<input
							type='text'
							value={location()}
							onInput={(e) => setLocation(e.currentTarget.value)}
							class='w-full border border-gray-500 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-200'
							required
						/>
					</div>
					<div>
						<label class='block text-gray-200 text-sm font-medium mb-1'>Início</label>
						<input
							type='date'
							value={start()}
							min={getValidateDateMin()}
							onInput={(e) => setStart(e.currentTarget.value)}
							class='w-full border border-gray-500 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-200'
							required
						/>
					</div>
					<div>
						<label class='block text-gray-200 text-sm font-medium mb-1'>Fim</label>
						<input
							type='date'
							value={end()}
							min={start() !== '' ? start() : getValidateDateMin()}
							onInput={(e) => setEnd(e.currentTarget.value)}
							class='w-full border border-gray-500 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-200'
							required
						/>
					</div>
					<div>
						<label class='block text-gray-200 text-sm font-medium mb-1'>Limite de inscrição</label>
						<input
							type='date'
							value={limit()}
							min={getValidateDateMin()}
							max={start() !== '' ? start() : undefined}
							onInput={(e) => setLimit(e.currentTarget.value)}
							class='w-full border border-gray-500 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-200'
							required
						/>
					</div>
					<div>
						<label class='block text-gray-200 text-sm font-medium mb-1'>Máximo de alterações</label>
						<input
							type='number'
							value={maxAlt()}
							min={0}
							max={100}
							onInput={(e) => setMaxAlt(Number(e.currentTarget.value))}
							class='w-full border border-gray-500 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-200'
							required
						/>
					</div>
					<div>
						<label class='block text-gray-200 text-sm font-medium mb-1'>Tipo</label>
						<input
							list='type-list'
							type='text'
							value={type()}
							onInput={(e) => setType(e.currentTarget.value)}
							class='w-full border border-gray-500 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-200'
							required
						/>
						<datalist id='type-list'>
							<option value='Prova'/>
							<option value='Estágio'/>
						</datalist>
					</div>
					<button
						type='submit'
						class='w-full bg-blue-600 text-gray-200 py-2 rounded-lg hover:bg-blue-700 transition cursor-pointer'
					>
						Criar
					</button>
				</form>
			</div>
		</Modal>
	);
};

const Popup : Component<{ open: boolean, children?: JSXElement }> = (props) => {
	return (
		<Show when={props.open}>
			<div class='fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50'>
				<div class='bg-gray-700 rounded-lg md:p-6 p-1 lg:w-1/4 w-3/4 shadow-lg relative text-gray-100 overflow-x-hidden overflow-y-auto max-h-3/4 md:max-h-14/16'>
					{props.children}
				</div>
			</div>
		</Show>
	);
};

// BUG: (César) This can become a problem when we have many events
const EraseEvent : Component<{ open: boolean, onChange: Function }> = (props) => {
	const [target, setTarget] = createSignal<CEvent>();
	const [events, setEvents] = createSignal<CEvent[]>([]);
	const [openPopup, setOpenPopup] = createSignal<boolean>(false);

	async function eraseEvent() {
		setOpenPopup(false);
		const res = await authFetch('/api/erase_event', {
			method: 'POST',
			body: JSON.stringify({
				id: target()?.id
			})
		});

		if(!res.ok || !(await res.json()).ok) {
			pushMessage('Falha ao apagar evento.', 'error');
		} else {
			pushMessage('Evento apagado.', 'info');

			// Remove from list
			setEvents((p) => p.filter((e) => e.id !== target()?.id));
		}

		setTarget(undefined);
	}

	onMount(async () => {
		const res = await authFetch('/api/all_events');
		let data = await res.json();

		const events = new Array<CEvent>();

		for(const e of data) {
			events.push({
				id: e.id,
				name: e.name,
				start: convertDateLocale(e.start),
				end: convertDateLocale(e.end),
				sub_limit_date: convertDateLocale(e.sub_limit_date),
				location: e.location,
				type: e.type
			});
		}

		setEvents(events);
	});

	return (
		<Modal {...props}>
			<h2 class='text-white pt-10 md:pt-0 pb-4 text-2xl font-semibold text-center'>Apagar Evento</h2>
			<div class='flex place-content-center'>
				<table class='min-w-full'>
					<thead
						class='bg-transparent/50 text-xs md:text-sm cursor-pointer hover:bg-gray-500'
						// onClick={() => setIsCollapsed(!isCollapsed())}
					>
						<tr class='border-b text-gray-400'>
							<th class='px-4 py-3 text-left font-semibold'>
								Nome
							</th>
							<th class='px-4 py-3 text-left font-semibold'>
								Local
							</th>
						</tr>
					</thead>

					<tbody class='divide-y divide-transparent'>
						<Show when={events() !== undefined && events().length === 0}>
							<tr>
								<td colspan='99' class='text-center text-gray-500 py-1'>
									Sem entradas
								</td>
							</tr>
						</Show>
						<For each={events()}>{(event) => {
							return (
								<tr 
									class='hover:bg-gray-500 even:bg-gray-600 odd:bg-gray-700 cursor-pointer transition'
									onClick={() => { setTarget(event); setOpenPopup(true); }}
								>
									<td class='px-4 py-1 text-left text-white text-xs md:text-sm'>{event.name}</td>
									<td class='px-4 py-1 text-left text-white text-xs md:text-sm'>{event.location}</td>
								</tr>
							);
						}}</For>
					</tbody>
				</table>
				<Popup open={openPopup()}>
					<h2 class='text-center text-lg font-medium'>Apagar evento?</h2>
					<div class='text-center mt-3'>
						"{target()?.name}"
					</div>
					<div class='flex place-content-center gap-2 mt-5'>
						<button
							type='submit'
							class='min-w-16 bg-blue-600 text-gray-200 py-2 rounded-lg hover:bg-blue-700 transition cursor-pointer px-1'
							onClick={() => eraseEvent()}
						>
							Sim
						</button>
						<button
							type='submit'
							class='min-w-16 bg-red-700 text-gray-200 py-2 rounded-lg hover:bg-red-800 transition cursor-pointer px-1'
							onClick={() => setOpenPopup(false)}
						>
							Não
						</button>
					</div>
				</Popup>
			</div>
		</Modal>
	);
};

const EventManager : Component = () => {
	const [openNew, setOpenNew] = createSignal<boolean>(false);
	const [openErase, setOpenErase] = createSignal<boolean>(false);

	return (
		<div class='p-5 flex flex-wrap gap-5 place-content-center'>
			<LButton
				onClick={() => setOpenNew(true)}
			>
				<img src='/event_check.svg' class='size-10'/>
				<div class='text-xs font-semibold pt-3'>Novo Evento</div>
			</LButton>
			<LButton>
				<div class='place-items-center'>
					<img src='/event_edit.svg' class='size-12 ml-2 -mt-0.5'/>
					<div class='text-xs font-semibold pt-3 -mt-1'>Editar Evento</div>
				</div>
			</LButton>
			<LButton
				onClick={() => setOpenErase(true)}
			>
				<img src='/event_error.svg' class='size-10'/>
				<div class='text-xs font-semibold pt-3'>Apagar Evento</div>
			</LButton>
		<NewEvent open={openNew()} onChange={setOpenNew}/>
		<EraseEvent open={openErase()} onChange={setOpenErase}/>
		</div>
	);
};

export const App : Component = () => {
	return (
		<>
			<Navbar/>
			<Card class='my-5 mx-5 bg-gray-700 text-gray-100'>
				<h1 class='font-bold text-md text-center'>Próximas provas</h1>
				<div>
					<NextTable type={0}/>
				</div>
			</Card>
			<Card class='my-5 mx-5 bg-gray-700 text-gray-100'>
				<h1 class='font-bold text-md text-center'>Próximos estágios</h1>
				<div>
					<NextTable type={1}/>
				</div>
			</Card>
		</>
	);
};

export const AdminDashboard : Component = () => {
	return (
		<>
			<Navbar/>
			<Card class='my-5 mx-5 bg-gray-700 text-gray-100'>
				<h1 class='font-bold text-md text-center'>Gestão de contas</h1>
				<div>
					<AccountManager/>
				</div>
			</Card>
			<Card class='my-5 mx-5 bg-gray-700 text-gray-100'>
				<h1 class='font-bold text-md text-center'>Gestão de eventos</h1>
				<div>
					<EventManager/>
				</div>
			</Card>
		</>
	);
};

export const Activate : Component = () => {
	const [password, setPassword] = createSignal<string>('');
	const [confPassword, setConfPassword] = createSignal<string>('');
	const [status, setStatus] = createSignal<boolean>(false);
	const [username, setUsername] = createSignal<string>('');
	const navigate = useNavigate();

	onMount(async () => {
		const token = new URLSearchParams(location.search).get('token');

		if(!token) {
			setStatus(false);
			return;
		}

		const res = await fetch(`/api/activate?token=${token}`);
		if(!res.ok) {
			pushMessage('Falha ao autenticar token.', 'error');
			setStatus(false);
			return;
		}

		const data = await res.json();

		if(!data.valid) {
			pushMessage('Ativação inválida: ' + data.reason, 'error');
			setStatus(false);
			return;
		}

		setStatus(true);
		setUsername(data.username);
	});

	async function activateAccount(e: Event) {
		e.preventDefault();

		if(password() !== confPassword()) {
			pushMessage('Passwords não correspondem.', 'error');
			setPassword('');
			setConfPassword('');
			return;
		}

		// now post
		const token = new URLSearchParams(location.search).get('token');
		const res = await fetch('/api/activate', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ token: token, password: password() })
		});

		const data = await res.json();

		if(data.ok) {
			navigate('/');
		}
	}

	return (
		<div class='min-h-screen flex items-center justify-center bg-gray-900'>
			<div class='w-full max-w-1/4 p-5 bg-gray-700 rounded-2xl overflow-x-auto'>
				<div class='flex place-content-center'>
					<img
						src='/logo.svg'
						alt='Logo'
						class='w-25 mb-5'
					/>
				</div>
				<Show when={status()} fallback={
					<div class='text-center'>
						<h1 class='text-xl text-center font-medium text-gray-200'>Token Inválido</h1>
						<A href='/' class='text-lg text-blue-300 hover:text-blue-500 transition'>Início</A>
					</div>
				}>
				<h1 class='text-xl text-center font-medium text-gray-200'>Ativar Conta</h1>
					<form onSubmit={activateAccount} class='space-y-4'>
						<div>
							<label class='block text-gray-200 text-sm font-medium mb-1'>Username</label>
							<input
								type='username'
								value={username()}
								class='w-full border border-gray-500 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-200 text-gray-400'
								required
								readonly
							/>
						</div>
						<div>
							<label class='block text-gray-200 text-sm font-medium mb-1'>Password</label>
							<input
								type='password'
								autocomplete='new-password'
								value={password()}
								onInput={(e) => setPassword(e.currentTarget.value)}
								class='w-full border border-gray-500 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-200'
								required
							/>
						</div>
						<div>
							<label class='block text-gray-200 text-sm font-medium mb-1'>Confirmar Password</label>
							<input
								type='password'
								autocomplete='new-password'
								value={confPassword()}
								onInput={(e) => setConfPassword(e.currentTarget.value)}
								class='w-full border border-gray-500 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-200'
								required
							/>
						</div>
						<button
							type='submit'
							class='w-full bg-blue-600 text-gray-200 py-2 rounded-lg hover:bg-blue-700 transition cursor-pointer'
						>
							Ativar
						</button>
					</form>
				</Show>
			</div>
		</div>
	);
};

export const Calendar : Component = () => {
	let element!: HTMLDivElement;

	onMount(async () => {
		const res = await authFetch('/api/all_events');
		const data = await res.json();

		const events = new Array<EventInput>();

		for(const e of data) {
			events.push({
				title: e.name,
				start: e.start,
				end: e.end,
				backgroundColor: e.type == 0 ? '#3788d8' : '#806928',
				borderColor: e.type == 0 ? '#3788d8' : '#806928'
			});

			events.push({
				title: '[Limite resposta] ' + e.name,
				start: e.sub_limit_date,
				end: e.sub_limit_date,
				backgroundColor: '#5b000b',
				borderColor: '#5b000b'
			});
		}

		console.log(events);

		const calendar = new FCCalendar(element, {
			plugins: [dayGridPlugin],
			initialView: 'dayGridMonth',
			headerToolbar: {
				left: 'prev,next today',
				center: '',
				right: 'title'
			},
			height: 'auto',
			events: events,
			// TODO: (César) Finish
			eventClick: () => {  },
			eventDidMount: (evt) => {
				evt.el.classList.add('cursor-pointer');
			}
		});

		calendar.render();
	});

	return (
		<div class='h-screen flex flex-col'>
			<Navbar/>
			<div class='bg-gray-700 p-5 rounded-lg m-5'>
				<div ref={element} class='text-white'>
				</div>
			</div>
		</div>
	);
};
