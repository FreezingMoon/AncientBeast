import { Client, Session, Socket } from '@heroiclabs/nakama-js';
import Game from '../game';

export default class Server {
	public client: Client;
	private socket: Socket;
	private useSSL: boolean;
	private verboseLogging: boolean;
	private createStatus: boolean;
	public game: Game;
	constructor(game: Game) {
		this.client = new Client(
			process.env.MULTIPLAYER_KEY,
			process.env.MULTIPLAYER_IP,
			process.env.MULTIPLAYER_PORT,
			process.env.MULTIPLAYER_SSL === 'true',
		);
		this.useSSL = process.env.MULTIPLAYER_SSL === 'true';
		this.verboseLogging = false;
		this.createStatus = false;
		this.game = game;
		this.socket = null;
	}

	async serverConnect(session: Session) {
		this.socket = await this.client.createSocket(this.useSSL, this.verboseLogging);
		const connection = await this.socket.connect(session, this.createStatus);
		console.log('connected to socket');
		return Promise.resolve(connection);
	}
}
