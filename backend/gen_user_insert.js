import readline from 'node:readline/promises';
import bcrypt from 'bcrypt';

async function main() {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});
	const full_name = await rl.question("Name: ");

	const names = full_name.split(' ');
	let autoUser;
	if (names.length > 1) {
		autoUser = names[0][0].toLowerCase() + '.' + names[names.length - 1].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
	} else {
		console.log('Failed! Cannot set default username on given full_name.');
	}

	let username = await rl.question(`Username (blank for '${autoUser}'): `);
	if(username.length === 0) {
		username = autoUser;
	}

	const role = await rl.question("Role ('user' or 'admin'): ");
	const password = await rl.question("Password: ");
	rl.close();

	const hash = await bcrypt.hash(password, 10);

	console.log('Generated Query:');
	console.log(`insert into users (username, passhash, full_name, role, active) values ('${username}', '${hash}', '${full_name}', '${role}', 1);`);
}

main();
