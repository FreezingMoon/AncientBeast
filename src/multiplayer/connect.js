import { Client } from '@heroiclabs/nakama-js';

export default class Server {
	constructor(game) {
		this.client = new Client(
			process.env.MULTIPLAYER_KEY,
			process.env.MULTIPLAYER_IP,
			process.env.MULTIPLAYER_PORT,
			process.env.MULTIPLAYER_SSL,
		);
		this.useSSL = process.env.ssl;
		this.verboseLogging = false;
		this.createStatus = false;
		this.game = game;
		this.socket = null;
	}

	async serverConnect(session) {
		this.socket = await this.client.createSocket(this.useSSL, this.verboseLogging);
		const connection = await this.socket.connect(session, this.createStatus);
		console.log('connected to socket');
		return Promise.resolve(connection);
	}
}
