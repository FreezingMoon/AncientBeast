import { Client } from '@heroiclabs/nakama-js/dist/nakama-js.esm';

export default class Server {
	constructor(clientInfo, game) {
		this.client = new Client(clientInfo.key, clientInfo.ip, clientInfo.port);
		this.useSSL = false;
		this.verboseLogging = false;
		this.createStatus = false;
		this.game = game;
		this.socket = null;
	}

	async serverConnect(session) {
		this.socket = await this.client.createSocket(this.useSSL, this.verboseLogging);
		let connection = await this.socket.connect(session, this.createStatus);
		console.log('connected to socket');
		return Promise.resolve(connection);
	}
}
