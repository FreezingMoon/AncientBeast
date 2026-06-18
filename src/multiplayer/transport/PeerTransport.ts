import type { GameMessage, ITransport, PeerId, TransportConnectOptions } from '../types';

export { type ITransport } from '../types';

export interface PeerTransportCallbacks {
	onMessage: (data: GameMessage, peerId: PeerId) => void;
	onPeerJoin: (peerId: PeerId) => void;
	onPeerLeave: (peerId: PeerId) => void;
	onConnected: (peerId: PeerId) => void;
}

export class PeerTransport implements ITransport {
	private peer?: import('peerjs').default;
	private connections = new Map<PeerId, import('peerjs').DataConnection>();
	private messageHandlers: Array<(data: GameMessage, peerId: PeerId) => void> = [];
	private peerJoinHandlers: Array<(peerId: PeerId) => void> = [];
	private peerLeaveHandlers: Array<(peerId: PeerId) => void> = [];
	private connectedHandlers: Array<(peerId: PeerId) => void> = [];
	private myPeerId = '';
	private isHost = false;
	private hostPeerId?: string;
	private disconnected = false;

	async connect(lobbyId: string, options: TransportConnectOptions = {}): Promise<void> {
		this.isHost = Boolean(options.isHost);
		this.disconnected = false;

		const hostPeerId = options.hostPeerId;
		this.hostPeerId = hostPeerId;
		const localPeerId = options.isHost ? hostPeerId || `ab-lobby-${lobbyId}` : undefined;

		if (!hostPeerId) {
			throw new Error('Missing PeerJS host peer ID');
		}

		if (this.peer) {
			this.peer.destroy();
		}

		const Peer = (await import('peerjs')).default;
		this.peer = new Peer(localPeerId);

		return new Promise((resolve, reject) => {
			const timeout = window.setTimeout(() => {
				reject(new Error('Timed out connecting to multiplayer lobby'));
			}, 3000);

			let connectionReady: Promise<void> | null = null;

			const settle = (fn: (value?: unknown) => void, value?: unknown) => {
				if (fn === resolve && !this.isHost && connectionReady) {
					connectionReady
						.then(() => {
							window.clearTimeout(timeout);
							fn(value);
						})
						.catch(() => {
							window.clearTimeout(timeout);
							fn(value);
						});
					return;
				}
				window.clearTimeout(timeout);
				fn(value);
			};

			this.peer.on('open', (id) => {
				this.myPeerId = id;

				if (!this.isHost) {
					const connection = this.openConnection(hostPeerId);
					connectionReady = new Promise((resolveConnection) => {
						connection.on('open', () => resolveConnection());
					});
				}

				settle(resolve);
			});

			this.peer.on('connection', (connection) => {
				this.registerConnection(connection);
			});

			this.peer.on('error', (error) => {
				settle(reject, error);
				console.warn('PeerJS error:', error);
			});
		});
	}

	disconnect(): void {
		this.disconnected = true;
		this.connections.forEach((connection) => connection.close());
		this.connections.clear();

		if (this.peer) {
			this.peer.destroy();
			this.peer = undefined;
		}

		this.myPeerId = '';
	}

	send(data: GameMessage): void {
		this.connections.forEach((connection) => {
			if (connection.open) {
				connection.send(data);
			}
		});
	}

	sendTo(peerId: PeerId, data: GameMessage): void {
		const connection = this.connections.get(peerId);

		if (connection?.open) {
			connection.send(data);
		}
	}

	sendExcept(peerId: PeerId, data: GameMessage): void {
		this.connections.forEach((connection) => {
			if (connection.peer !== peerId && connection.open) {
				connection.send(data);
			}
		});
	}

	onMessage(cb: (data: GameMessage, peerId: PeerId) => void): void {
		this.messageHandlers.push(cb);
	}

	onPeerJoin(cb: (peerId: PeerId) => void): void {
		this.peerJoinHandlers.push(cb);
	}

	onPeerLeave(cb: (peerId: PeerId) => void): void {
		this.peerLeaveHandlers.push(cb);
	}

	onConnected(cb: (peerId: PeerId) => void): void {
		this.connectedHandlers.push(cb);
	}

	getMyId(): string {
		return this.myPeerId;
	}

	private openConnection(hostPeerId: string, attempt = 0): import('peerjs').DataConnection {
		const connection = this.peer!.connect(hostPeerId, { reliable: true });
		this.registerConnection(connection);

		if (!this.isHost && attempt < 5) {
			window.setTimeout(() => {
				if (this.disconnected || !this.peer) {
					return;
				}
				const current = this.connections.get(hostPeerId);
				if (current && current.open) {
					return;
				}
				if (current === connection) {
					this.connections.delete(hostPeerId);
				}
				try {
					connection.close();
				} catch (_error) {
					/* ignore */
				}
				this.openConnection(hostPeerId, attempt + 1);
			}, 1500);
		}

		return connection;
	}

	private registerConnection(connection: import('peerjs').DataConnection): void {
		const existingConnection = this.connections.get(connection.peer);

		if (existingConnection) {
			if (existingConnection.open) {
				connection.close();
				return;
			}
			this.connections.delete(connection.peer);
			try {
				existingConnection.close();
			} catch (_error) {
				/* ignore */
			}
		}

		this.connections.set(connection.peer, connection);

		const emitOpen = () => {
			this.connectedHandlers.forEach((handler) => handler(connection.peer));

			if (this.isHost) {
				this.peerJoinHandlers.forEach((handler) => handler(connection.peer));
			}
		};

		if (connection.open) {
			emitOpen();
		}

		connection.on('open', emitOpen);

		connection.on('data', (data) => {
			if (this.isGameMessage(data)) {
				this.messageHandlers.forEach((handler) => handler(data, connection.peer));
			}
		});

		connection.on('close', () => {
			if (this.connections.get(connection.peer) !== connection) {
				return;
			}

			this.connections.delete(connection.peer);

			if (!this.isHost && !this.disconnected && this.peer && connection.peer === this.hostPeerId) {
				window.setTimeout(() => {
					if (!this.disconnected && this.peer && !this.connections.has(connection.peer)) {
						this.openConnection(connection.peer);
					}
				}, 400);
				return;
			}

			this.peerLeaveHandlers.forEach((handler) => handler(connection.peer));
		});

		connection.on('error', (error) => {
			console.warn('PeerJS data connection error:', error);
		});
	}

	private isGameMessage(data: unknown): data is GameMessage {
		return Boolean(
			data &&
				typeof data === 'object' &&
				'type' in data &&
				typeof (data as { type: unknown }).type === 'string',
		);
	}
}
