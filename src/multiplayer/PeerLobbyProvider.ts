import { PlayerIdentity } from './identity';
import { PeerTransport } from './transport/PeerTransport';
import { ITransport } from './transport/ITransport';
import {
	GameConfig,
	GameMessage,
	ILobbyProvider,
	isActionMessage,
	LobbyCode,
	LobbyPlayer,
	LobbySession,
	LobbyState,
	PeerId,
	generateLobbyCode,
	getPeerIdForLobby,
} from './types';

export class PeerLobbyProvider implements ILobbyProvider {
	private readonly identity = new PlayerIdentity();
	private readonly transport: ITransport;
	private state: LobbyState = this.createEmptyState();
	private lobbyUpdateHandlers: Array<(lobby: LobbyState) => void> = [];
	private gameMessageHandlers: Array<(message: GameMessage) => void> = [];
	private pendingJoinResolve?: (session: LobbySession) => void;
	private pendingJoinReject?: (error: Error) => void;
	private matchStartGraceUntil = 0;

	constructor(transport: ITransport = new PeerTransport()) {
		this.transport = transport;
		this.wireTransport();
	}

	async createLobby(config: GameConfig, code?: LobbyCode): Promise<LobbySession> {
		const lobbyCode = code || generateLobbyCode();
		const playerId = this.identity.getId();
		const hostPeerId = getPeerIdForLobby(lobbyCode);
		const hostPlayer: LobbyPlayer = {
			playerId,
			peerId: hostPeerId,
			name: playerId,
			playerIndex: 0,
		};

		this.state = {
			code: lobbyCode,
			host: playerId,
			hostPeerId,
			players: [hostPlayer],
			config,
			status: 'waiting',
		};

		await this.transport.connect(lobbyCode, { isHost: true, hostPeerId });
		this.emitLobbyUpdate();
		return this.toSession(hostPlayer);
	}

	async joinLobby(code: LobbyCode): Promise<LobbySession> {
		const playerId = this.identity.getId();
		const hostPeerId = getPeerIdForLobby(code);
		const sessionPromise = this.createJoinPromise();

		try {
			await this.transport.connect(code, { isHost: false, hostPeerId });
		} catch (error) {
			this.pendingJoinResolve = undefined;
			this.pendingJoinReject = undefined;
			throw error;
		}

		this.state = {
			...this.state,
			code,
			hostPeerId,
			status: 'waiting',
		};

		const player: LobbyPlayer = {
			playerId,
			peerId: this.transport.getMyId(),
			name: playerId,
			playerIndex: -1,
		};
		let joined = false;
		const sendJoinRequest = () => {
			if (joined) {
				return;
			}
			this.transport.send({
				type: 'player-joined',
				player,
			});
		};
		sendJoinRequest();
		const retryInterval = window.setInterval(sendJoinRequest, 500);

		sessionPromise
			.then(() => {
				joined = true;
			})
			.catch(() => {
				/* keep retrying handled by timeout */
			})
			.finally(() => window.clearInterval(retryInterval));

		return sessionPromise;
	}

	leaveLobby(): void {
		this.pendingJoinResolve = undefined;
		this.transport.disconnect();

		if (this.state.status !== 'ended') {
			this.state = { ...this.state, status: 'ended' };
			this.emitLobbyUpdate();
		}
	}

	isHost(): boolean {
		// Must use peerId, not playerId/identity, because playerId is shared
		// across browser tabs in the same browser (same localStorage UUID).
		// peerId is unique per browser context (PeerJS connection ID).
		if (this.state.status === 'idle') {
			return false;
		}
		const myPeerId = this.transport.getMyId();
		return this.state.hostPeerId === myPeerId;
	}

	getLobbyState(): LobbyState {
		return this.state;
	}

	getLocalPlayer(): LobbyPlayer | undefined {
		const myPeerId = this.transport.getMyId();
		return this.state.players.find((player) => player.peerId === myPeerId);
	}

	markMatchStarted(): void {
		this.matchStartGraceUntil = Date.now() + 10000;
	}

	sendGameMessage(message: GameMessage): void {
		this.transport.send(message);
	}

	onLobbyUpdate(cb: (lobby: LobbyState) => void): void {
		this.lobbyUpdateHandlers.push(cb);
	}

	onGameMessage(cb: (message: GameMessage) => void): void {
		this.gameMessageHandlers.push(cb);
	}

	private wireTransport(): void {
		this.transport.onMessage((message, peerId) => this.handleTransportMessage(message, peerId));
		this.transport.onPeerJoin((peerId) => this.handlePeerConnection(peerId));
		this.transport.onPeerLeave((peerId) => this.handlePeerLeave(peerId));
	}

	private handlePeerConnection(peerId: PeerId): void {
		if (!this.isHost() || this.state.status !== 'waiting') {
			return;
		}

		// The authoritative join handshake happens in handlePlayerJoined, which
		// carries the joiner's stable playerId. The raw connection event alone has
		// no playerId, so only use it to greet a peer we already know; otherwise
		// wait for the player-joined message to assign a slot.
		const nextPlayer = this.state.players.find((player) => player.peerId === peerId);

		if (nextPlayer) {
			this.transport.sendTo(peerId, {
				type: 'lobby-joined',
				player: nextPlayer,
			});
		}
	}

	private handleTransportMessage(message: GameMessage, peerId: PeerId): void {
		if (message.type === 'player-joined' && this.isHost()) {
			this.handlePlayerJoined(message.player, peerId);
			return;
		}

		if (message.type === 'lobby-joined' && !this.isHost()) {
			if (this.state.status !== 'waiting' && this.state.status !== 'idle') {
				console.warn('[lobby-joined] Ignored: state is', this.state.status);
				return;
			}

			const localPlayer: LobbyPlayer = {
				...message.player,
				playerId: message.player.playerId || this.identity.getId(),
				peerId: this.transport.getMyId(),
				name: this.identity.getId(),
			};

			const players = this.state.players.filter(
				(player) => player.playerIndex !== localPlayer.playerIndex,
			);
			players.push(localPlayer);
			players.sort((a, b) => a.playerIndex - b.playerIndex);

			this.state = {
				code: this.state.code || '',
				host: this.state.host,
				hostPeerId: this.state.hostPeerId,
				players,
				config: this.state.config,
				status: 'waiting',
			};
			this.emitLobbyUpdate();
			this.resolveJoin();
			return;
		}

		if (this.isHost() && message.type === 'match-loaded') {
			const player = this.state.players.find((item) => item.peerId === peerId);
			const forwardedMessage: GameMessage = {
				...message,
				playerId: player?.playerId || peerId,
			};
			this.transport.sendExcept(peerId, forwardedMessage);
			this.gameMessageHandlers.forEach((handler) => handler(forwardedMessage));
			return;
		}

		if (this.isHost() && isActionMessage(message)) {
			this.transport.sendExcept(peerId, message);
			this.gameMessageHandlers.forEach((handler) => handler(message));
			return;
		}

		if (message.type === 'match-start') {
			const myPeerId = this.transport.getMyId();
			const myPlayerId = this.identity.getId();
			const players = message.players.map((player) => {
				if (player.peerId === myPeerId) {
					return { ...player, playerId: myPlayerId, peerId: myPeerId };
				}
				return player;
			});
			const selfByPeerId = players.find((p) => p.peerId === myPeerId);
			if (!selfByPeerId) {
				console.error(
					'[Match-Start] FAILED to find self by peerId. players:',
					players.map((p) => ({
						peerId: p.peerId,
						playerId: p.playerId,
						playerIndex: p.playerIndex,
					})),
				);
			}
			this.state = {
				code: this.state.code || '',
				host: message.host,
				hostPeerId: message.hostPeerId,
				players,
				config: message.config,
				status: 'playing',
			};
			this.emitLobbyUpdate();
			this.resolveJoin();
			this.gameMessageHandlers.forEach((handler) => handler(message));
			return;
		}

		if (message.type === 'player-left') {
			if (this.pendingJoinReject) {
				this.rejectJoin(new Error('Lobby host rejected the connection'));
				return;
			}

			this.state = { ...this.state, status: 'ended' };
			this.emitLobbyUpdate();
			this.gameMessageHandlers.forEach((handler) =>
				handler({ type: 'player-left', playerId: message.playerId, player: message.player }),
			);
			return;
		}

		this.gameMessageHandlers.forEach((handler) => handler(message));
	}

	private handlePlayerJoined(player: LobbyPlayer, peerId: PeerId): void {
		if (this.state.status !== 'waiting') {
			this.transport.send({
				type: 'player-left',
				playerId: player.playerId,
				player: { ...player, playerIndex: -1 },
			});
			return;
		}

		const existingPlayer = this.state.players.find(
			(item) =>
				(item.peerId && item.peerId === peerId) ||
				(item.playerIndex > 0 && player.playerId && item.playerId === player.playerId),
		);

		if (existingPlayer) {
			existingPlayer.peerId = peerId;
			if (player.playerId) {
				existingPlayer.playerId = player.playerId;
				existingPlayer.name = player.name;
			}
			this.emitLobbyUpdate();
			this.transport.sendTo(peerId, {
				type: 'lobby-joined',
				player: existingPlayer,
			});
			return;
		}

		const usedIndexes = new Set(this.state.players.map((item) => item.playerIndex));
		let nextIndex = -1;
		for (let index = 1; index < this.state.config.gameMode; index += 1) {
			if (!usedIndexes.has(index)) {
				nextIndex = index;
				break;
			}
		}

		if (nextIndex === -1) {
			this.transport.sendTo(peerId, {
				type: 'player-left',
				playerId: player.playerId,
				player: { ...player, playerIndex: -1 },
			});
			return;
		}

		const nextPlayer: LobbyPlayer = {
			...player,
			peerId,
			playerIndex: nextIndex,
		};

		this.state.players.push(nextPlayer);
		this.emitLobbyUpdate();
		this.gameMessageHandlers.forEach((handler) =>
			handler({ type: 'player-joined', player: nextPlayer }),
		);

		this.transport.sendTo(peerId, {
			type: 'lobby-joined',
			player: nextPlayer,
		});
	}

	private handlePeerLeave(peerId: PeerId): void {
		if (Date.now() < this.matchStartGraceUntil) {
			return;
		}

		const leavingPlayer = this.state.players.find((player) => player.peerId === peerId);

		if (!leavingPlayer) {
			return;
		}

		this.state.players = this.state.players.filter((player) => player.peerId !== peerId);

		if (this.isHost()) {
			this.state = { ...this.state, status: this.state.players.length > 0 ? 'waiting' : 'ended' };
			this.transport.send({
				type: 'player-left',
				playerId: leavingPlayer.playerId,
				player: leavingPlayer,
			});
			this.emitLobbyUpdate();
			this.gameMessageHandlers.forEach((handler) =>
				handler({ type: 'player-left', playerId: leavingPlayer.playerId, player: leavingPlayer }),
			);
			return;
		}

		this.state = { ...this.state, status: 'ended' };
		this.rejectJoin(new Error('Lobby host disconnected'));
		this.emitLobbyUpdate();
		this.gameMessageHandlers.forEach((handler) =>
			handler({ type: 'player-left', playerId: leavingPlayer.playerId, player: leavingPlayer }),
		);
	}

	private createJoinPromise(): Promise<LobbySession> {
		return new Promise((resolve, reject) => {
			const timeout = window.setTimeout(() => {
				this.pendingJoinResolve = undefined;
				this.pendingJoinReject = undefined;
				reject(new Error('Timed out waiting for lobby host'));
			}, 3000);

			this.pendingJoinResolve = (session) => {
				window.clearTimeout(timeout);
				this.pendingJoinReject = undefined;
				resolve(session);
			};

			this.pendingJoinReject = (error) => {
				window.clearTimeout(timeout);
				this.pendingJoinResolve = undefined;
				reject(error);
			};
		});
	}

	private resolveJoin(): void {
		const localPlayer = this.getLocalPlayer();

		if (!localPlayer || !this.pendingJoinResolve) {
			return;
		}

		const resolve = this.pendingJoinResolve;
		this.pendingJoinResolve = undefined;
		this.pendingJoinReject = undefined;
		resolve(this.toSession(localPlayer));
	}

	private rejectJoin(error: Error): void {
		if (this.pendingJoinReject) {
			this.pendingJoinReject(error);
			return;
		}

		this.pendingJoinResolve = undefined;
	}

	private toSession(player: LobbyPlayer): LobbySession {
		return {
			code: this.state.code,
			host: this.state.hostPeerId,
			hostPlayerId: this.state.host,
			players: this.state.players,
			config: this.state.config,
			status: this.state.status,
			myPlayer: player,
		};
	}

	private emitLobbyUpdate(): void {
		this.lobbyUpdateHandlers.forEach((handler) => handler(this.state));
	}

	private createEmptyState(): LobbyState {
		return {
			code: '',
			host: '',
			hostPeerId: '',
			players: [],
			config: {
				gameMode: 2,
				creaLimitNbr: 3,
				unitDrops: 1,
				abilityUpgrades: 3,
				plasma_amount: 30,
				turnTimePool: -1,
				timePool: -1,
				background_image: 'default',
			},
			status: 'idle',
		};
	}
}
