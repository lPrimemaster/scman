/* @refresh reload */
import './index.css';
import { render } from 'solid-js/web';
import 'solid-devtools';
import { Router, Route } from '@solidjs/router';

import {
	App,
	AdminDashboard,
	Login,
	PopoutMessageSpace,
	Register,
	Calendar,
	Activate,
	protect,
	protectAdmin
} from './App';

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?',
  );
}

render(() => (
	<>
		<Router>
			{/* Admin only */}
			<Route path='/admin' component={protectAdmin(AdminDashboard)}/>
			<Route path='/register' component={protectAdmin(Register)}/>

			{/* Users only */}
			<Route path='/' component={protect(App)}/>
			<Route path='/calendar' component={protect(Calendar)}/>

			{/* All */}
			<Route path='/login' component={Login}/>
			<Route path='/activate' component={Activate}/>
		</Router>
		<PopoutMessageSpace/>
	</>
), root!);
