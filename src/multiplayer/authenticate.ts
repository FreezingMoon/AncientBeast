import { Client } from '@heroiclabs/nakama-js';

type loginOptions = {
	username?: string;
	email: string;
	password: string;
	passwordmatch?: string;
};

export default class Authenticate {
	private username: string;
	private password: string;
	private email: string;
	private client: Client;
	constructor(login: loginOptions, client: Client) {
		this.username = login.username || '';
		this.email = login.email || '';
		this.password = login.password || '';
		this.client = client;
	}
	async register() {
		const session = await this.client.authenticateEmail(
			this.email,
			this.password,
			true,
			this.username,
		);
		return Promise.resolve(session);
	}

	async authenticateEmail() {
		const session = await this.client.authenticateEmail(this.email, this.password, false);
		return Promise.resolve(session);
	}
}
