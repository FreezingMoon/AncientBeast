export default class Authenticate {
	constructor(login, client) {
		this.username = login.username || '';
		this.email = login.email || '';
		this.password = login.password || '';
		this.client = client;
	}
	async register() {
		var session = await this.client.authenticateEmail({
			email: this.email,
			password: this.password,
			create: true,
			username: this.username,
		});

		return Promise.resolve(session);
	}

	async authenticateEmail() {
		var session = await this.client.authenticateEmail({
			email: this.email,
			create: false,
			password: this.password,
		});
		return Promise.resolve(session);
	}
}
