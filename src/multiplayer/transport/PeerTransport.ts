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
	private _reconnectTimers = new Map<PeerId, number>();
	private static readonly RECONNECT_TIMEOUT_MS = 10000;

	async connect(lobbyId: string, options: TransportConnectOptions = {}): Promise<void> {
		this.isHost = Boolean(options.isHost);
		this.disconnected = false;

		const hostPeerId = options.hostPeerId;
		this.hostPeerId = hostPeerId;
		// Generate unique peer IDs to avoid collisions when multiple tabs
		// share the same browser (and thus the same localStorage/PeerJS cache)
		const localPeerId = options.isHost
			? hostPeerId || `ab-lobby-${lobbyId}`
			: `ab-client-${lobbyId}-${Math.random().toString(36).slice(2, 10)}`;

		if (!hostPeerId) {
			throw new Error('Missing PeerJS host peer ID');
		}

		if (this.peer) {
			this.peer.destroy();
		}

		const Peer = (await import('peerjs')).default;
		this.peer = new Peer(localPeerId);

		// Log PeerJS connection state changes for diagnostics
		this.peer.on('disconnected', () => {
			console.warn('[PeerTransport] Peer disconnected (signaling lost). Reconnecting...');
			try {
				this.peer?.reconnect();
			} catch (_e) {
				/* ignore */
			}
		});

		this.peer.on('close', () => {
			console.warn('[PeerTransport] Peer connection closed permanently.');
		});

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
				(connection as any).__connectedAt = Date.now();
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
		const openPeers: string[] = [];
		const closedPeers: string[] = [];
		this.connections.forEach((connection) => {
			if (connection.open) {
				openPeers.push(connection.peer);
			} else {
				closedPeers.push(connection.peer);
			}
		});
		if (openPeers.length === 0 && closedPeers.length > 0) {
			console.warn('[PeerTransport] send: no open connections, closed:', closedPeers);
		}
		this.connections.forEach((connection) => {
			if (connection.open) {
				try {
					const cleaned = this.sanitizeForTransport(data);
					connection.send(cleaned);
				} catch (error) {
					console.warn('[PeerTransport] send failed:', error, String(data?.type ?? 'unknown'));
				}
			}
		});
	}

	sendTo(peerId: PeerId, data: GameMessage): void {
		const connection = this.connections.get(peerId);

		if (connection?.open) {
			try {
				const cleaned = this.sanitizeForTransport(data);
				connection.send(cleaned);
			} catch (error) {
				console.warn('[PeerTransport] sendTo failed:', error, String(data?.type ?? 'unknown'));
			}
		}
	}

	sendExcept(peerId: PeerId, data: GameMessage): void {
		this.connections.forEach((connection) => {
			if (connection.peer !== peerId && connection.open) {
				try {
					const cleaned = this.sanitizeForTransport(data);
					connection.send(cleaned);
				} catch (error) {
					console.warn(
						'[PeerTransport] sendExcept failed:',
						error,
						String(data?.type ?? 'unknown'),
					);
				}
			}
		});
	}

	// Strip any non-serializable values (functions) from messages before
	// handing them to PeerJS. Without this, PeerJS's custom pack() throws
	// "Type 'function' not yet supported" and the error propagates up
	// through callers (e.g. hex click callback), breaking local gameplay.
	private sanitizeForTransport<T>(data: T): T {
		return JSON.parse(JSON.stringify(data));
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
		(connection as any).__connectedAt = Date.now();
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

	private _connectedAt = new Map<PeerId, number>();

	private registerConnection(connection: import('peerjs').DataConnection): void {
		const existingConnection = this.connections.get(connection.peer);
		const incomingConnectedAt = (connection as any).__connectedAt ?? Date.now();

		if (existingConnection) {
			// If the existing connection is newer than the incoming one, reject
			// the incoming (likely a late race). Otherwise prefer the incoming
			// connection — a ghost connection may still claim `.open === true`
			// while its underlying WebRTC data channel is actually dead.
			const existingConnectedAt = this._connectedAt.get(connection.peer) ?? 0;
			if (existingConnectedAt >= incomingConnectedAt) {
				connection.close();
				return;
			}
			console.log(
				'[PeerTransport] registerConnection: replacing stale connection for',
				connection.peer,
				'existedSince:',
				existingConnectedAt,
				'incoming:',
				incomingConnectedAt,
			);
			this.connections.delete(connection.peer);
			try {
				existingConnection.close();
			} catch (_error) {
				/* ignore */
			}
		}

		this._connectedAt.set(connection.peer, incomingConnectedAt);
		console.log(
			'[PeerTransport] registerConnection: fresh for',
			connection.peer,
			'at:',
			incomingConnectedAt,
		);

		this.connections.set(connection.peer, connection);

		// Clear any pending reconnect timer for this peer
		const reconnectTimer = this._reconnectTimers.get(connection.peer);
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			this._reconnectTimers.delete(connection.peer);
		}

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
			} else {
				console.warn('[PeerTransport] Received non-game message:', typeof data, data);
			}
		});

		connection.on('close', () => {
			if (this.connections.get(connection.peer) !== connection) {
				return;
			}

			this.connections.delete(connection.peer);
			console.warn(
				'[PeerTransport] connection closed for peer:',
				connection.peer,
				'isHost:',
				this.isHost,
			);

			if (!this.disconnected && this.peer) {
				// Clear any existing reconnect timer for this peer
				const existingTimer = this._reconnectTimers.get(connection.peer);
				if (existingTimer) {
					clearTimeout(existingTimer);
				}

				// Set a timeout to fire peer leave after RECONNECT_TIMEOUT_MS
				const leaveTimer = window.setTimeout(() => {
					this._reconnectTimers.delete(connection.peer);
					if (!this.connections.has(connection.peer)) {
						console.warn('[PeerTransport] peer left (reconnect timeout):', connection.peer);
						this.peerLeaveHandlers.forEach((handler) => handler(connection.peer));
					}
				}, PeerTransport.RECONNECT_TIMEOUT_MS);
				this._reconnectTimers.set(connection.peer, leaveTimer);

				window.setTimeout(() => {
					if (!this.disconnected && this.peer && !this.connections.has(connection.peer)) {
						console.warn('[PeerTransport] reconnecting to:', connection.peer);
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
