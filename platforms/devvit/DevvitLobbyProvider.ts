import { DevvitTransport } from './DevvitTransport';
import type {
	AuthoritativeState,
	GameConfig,
	GameMessage,
	INetworkBackend,
	Intent,
	LobbyCode,
	LobbyPlayer,
	LobbySession,
	LobbyState,
	PeerId,
} from '../../src/multiplayer/types';
import { generateLobbyCode, isSelfAppliedActionMessage } from '../../src/multiplayer/types';

interface CreateLobbyResponse {
	code: LobbyCode;
}

export class DevvitLobbyProvider implements INetworkBackend {
	private readonly transport: DevvitTransport;
	private state: LobbyState = this.createEmptyState();
	private lobbyUpdateHandlers: Array<(lobby: LobbyState) => void> = [];
	private gameMessageHandlers: Array<(message: GameMessage) => void> = [];
	private pendingJoinResolve?: (session: LobbySession) => void;
	private pendingJoinReject?: (error: Error) => void;
	private isHostFlag = false;
	private connected = false;
	private nextServerOrder: number | null = null;
	private pendingOrderedMessages = new Map<number, { message: GameMessage; peerId: PeerId }>();
	private gapRecoveryTimer: number | null = null;
	private gapRecoveryInFlight = false;
	private gapRecoveryAttempts = 0;
	private awaitingSyncSnapshot = false;

	private static readonly GAP_RECOVERY_DELAY_MS = 300;
	private static readonly GAP_RECOVERY_MAX_ATTEMPTS = 2;

	constructor(transport?: DevvitTransport) {
		this.transport = transport ?? new DevvitTransport({});
		this.wireTransport();
	}

	async createLobby(config: GameConfig, code?: LobbyCode): Promise<LobbySession> {
		const lobbyCode = code || generateLobbyCode();

		const res = await fetch(`/api/lobby`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ code: lobbyCode, config }),
		});

		if (!res.ok) {
			throw new Error(`Failed to create lobby: ${res.status}`);
		}

		const data = (await res.json()) as CreateLobbyResponse;
		const createdCode = data.code || lobbyCode;

		await this.transport.connect(createdCode, { isHost: true });

		const myPeerId = this.transport.getMyId();
		const player: LobbyPlayer = {
			playerId: myPeerId,
			peerId: myPeerId,
			name: myPeerId,
			playerIndex: 0,
		};

		this.state = {
			code: createdCode,
			host: myPeerId,
			hostPeerId: myPeerId,
			players: [player],
			config,
			status: 'waiting',
		};

		this.connected = true;
		this.isHostFlag = true;
		this.emitLobbyUpdate();
		return this.toSession(player);
	}

	async joinLobby(code: LobbyCode): Promise<LobbySession> {
		const sessionPromise = this.createJoinPromise();

		try {
			await this.transport.connect(code, { isHost: false });
		} catch (error) {
			this.pendingJoinResolve = undefined;
			this.pendingJoinReject = undefined;
			throw error;
		}

		// The server decides host status authoritatively (first to join an empty lobby
		// becomes host) — read the real result back rather than assuming `isHost: false`
		// just because that's what we requested. This matters for matchmaking-created
		// lobbies, where neither joining player explicitly "creates" it.
		this.isHostFlag = this.transport.isHostPeer();

		const myPeerId = this.transport.getMyId();

		const player: LobbyPlayer = {
			playerId: myPeerId,
			peerId: myPeerId,
			name: myPeerId,
			playerIndex: -1,
		};

		this.state = {
			...this.state,
			code,
			host: '',
			hostPeerId: '',
			players: [player],
			config: this.state.config,
			status: 'waiting',
		};

		return sessionPromise;
	}

	leaveLobby(): void {
		this.pendingJoinResolve = undefined;
		this.resetServerOrdering();
		this.transport.disconnect();

		if (this.state.status !== 'ended') {
			this.state = { ...this.state, status: 'ended' };
			this.emitLobbyUpdate();
		}
	}

	isHost(): boolean {
		return this.isHostFlag;
	}

	getLobbyState(): LobbyState {
		return this.state;
	}

	getLocalPlayer(): LobbyPlayer | undefined {
		const myPeerId = this.transport.getMyId();
		return this.state.players.find(
			(player) => player.peerId === myPeerId || player.playerId === myPeerId,
		);
	}

	markMatchStarted(): void {
		const code = this.state.code;

		fetch(`/api/lobby/${encodeURIComponent(code)}/start`, {
			method: 'POST',
		}).catch(() => {
			/* ignore */
		});

		if (this.state.status !== 'playing') {
			this.state = { ...this.state, status: 'playing' };
			this.emitLobbyUpdate();
		}
	}

	async sendGameMessage(message: GameMessage): Promise<void> {
		await this.transport.send(message);
	}

	async sendIntent(intent: Intent): Promise<void> {
		await this.transport.send({
			type: 'intent',
			intent,
			playerId: this.transport.getMyId(),
		});
	}

	onLobbyUpdate(cb: (lobby: LobbyState) => void): void {
		this.lobbyUpdateHandlers.push(cb);
	}

	onGameMessage(cb: (message: GameMessage) => void): void {
		this.gameMessageHandlers.push(cb);
	}

	onAuthoritativeState(cb: (state: AuthoritativeState) => void): void {
		this.gameMessageHandlers.push((message) => {
			if (message.type === 'authoritative-state') {
				cb(message.state);
			}
		});
	}

	private wireTransport(): void {
		this.transport.onMessage((message, peerId) => this.handleTransportMessage(message, peerId));
		this.transport.onPeerJoin((peerId) => this.handlePeerJoin(peerId));
		this.transport.onPeerLeave((peerId) => this.handlePeerLeave(peerId));
	}

	private handleTransportMessage(message: GameMessage, peerId: PeerId): void {
		if (this.shouldSequenceMessage(message)) {
			this.enqueueSequencedMessage(message, peerId);
			return;
		}

		this.processTransportMessage(message, peerId);
	}

	private processTransportMessage(message: GameMessage, peerId: PeerId): void {
		if (message.type === 'sync-request') {
			this.handleSyncRequest(message);
			return;
		}

		if (message.type === 'sync-snapshot') {
			this.handleSyncSnapshot(message);
			return;
		}

		// In Devvit mode the server relays every message to ALL clients, including the
		// sender. Relay-mode action messages (action-end, action-move, action-ability)
		// are already applied locally by the acting client before they are sent, so
		// re-applying their own echoed action would duplicate the effect (stacked units,
		// double turn-activation, etc.). Peer mode avoids this via sendExcept(peerId,...).
		// Authoritative `intent` messages are NOT applied locally before sending — they
		// are sent to the server for ordering and must be applied by every client when
		// the echoed intent arrives, otherwise the acting client's game state never
		// advances and both players become desynchronized.
		if (peerId === this.transport.getMyId() && isSelfAppliedActionMessage(message)) {
			return;
		}

		if (message.type === 'player-joined') {
			this.handlePlayerJoined(message.player, peerId);
			return;
		}

		if (message.type === 'lobby-joined') {
			this.handleLobbyJoined(message.player, peerId);
			return;
		}

		if (message.type === 'match-start') {
			this.handleMatchStart(message);
			return;
		}

		if (message.type === 'match-loaded') {
			this.gameMessageHandlers.forEach((handler) => handler(message));
			return;
		}

		if (message.type === 'player-left') {
			this.handlePlayerLeft(message);
			return;
		}

		if (message.type === 'heartbeat') {
			return;
		}

		this.gameMessageHandlers.forEach((handler) => handler(message));
	}

	private shouldSequenceMessage(message: GameMessage): boolean {
		return message.serverOrder != null;
	}

	private enqueueSequencedMessage(message: GameMessage, peerId: PeerId): void {
		const serverOrder = message.serverOrder;

		if (serverOrder == null) {
			this.processTransportMessage(message, peerId);
			return;
		}

		if (this.nextServerOrder == null) {
			this.nextServerOrder = serverOrder;
		}

		if (serverOrder < this.nextServerOrder) {
			return;
		}

		this.pendingOrderedMessages.set(serverOrder, { message, peerId });
		this.flushSequencedMessages();
		this.scheduleGapRecovery();
	}

	private flushSequencedMessages(): void {
		let progressed = false;

		while (this.nextServerOrder != null) {
			const pending = this.pendingOrderedMessages.get(this.nextServerOrder);

			if (!pending) {
				return;
			}

			this.pendingOrderedMessages.delete(this.nextServerOrder);
			this.processTransportMessage(pending.message, pending.peerId);
			this.nextServerOrder += 1;
			progressed = true;
		}

		if (progressed) {
			this.gapRecoveryAttempts = 0;
			this.awaitingSyncSnapshot = false;
		}

		this.scheduleGapRecovery();
	}

	private scheduleGapRecovery(): void {
		if (this.gapRecoveryTimer != null) {
			clearTimeout(this.gapRecoveryTimer);
			this.gapRecoveryTimer = null;
		}

		if (this.nextServerOrder == null || this.awaitingSyncSnapshot) {
			return;
		}

		if (!this.hasOutOfOrderGap()) {
			return;
		}

		this.gapRecoveryTimer = window.setTimeout(() => {
			this.gapRecoveryTimer = null;
			void this.tryRecoverGap();
		}, DevvitLobbyProvider.GAP_RECOVERY_DELAY_MS);
	}

	private async tryRecoverGap(): Promise<void> {
		if (this.gapRecoveryInFlight || this.nextServerOrder == null || this.awaitingSyncSnapshot) {
			return;
		}

		if (!this.hasOutOfOrderGap()) {
			return;
		}

		this.gapRecoveryInFlight = true;

		try {
			const afterOrder = Math.max(0, this.nextServerOrder - 1);
			const entries = await this.transport.fetchMessagesAfter(afterOrder);

			for (const entry of entries) {
				this.enqueueSequencedMessage(entry.message, entry.from);
			}

			if (this.nextServerOrder == null || this.pendingOrderedMessages.has(this.nextServerOrder)) {
				this.gapRecoveryAttempts = 0;
				return;
			}

			this.gapRecoveryAttempts += 1;
			if (this.gapRecoveryAttempts >= DevvitLobbyProvider.GAP_RECOVERY_MAX_ATTEMPTS) {
				await this.requestSyncSnapshot();
				return;
			}

			this.scheduleGapRecovery();
		} finally {
			this.gapRecoveryInFlight = false;
		}
	}

	private async requestSyncSnapshot(): Promise<void> {
		if (this.awaitingSyncSnapshot) {
			return;
		}

		if (this.isHostFlag) {
			return;
		}

		const localPlayer = this.getLocalPlayer();
		if (!localPlayer || this.nextServerOrder == null) {
			return;
		}

		this.awaitingSyncSnapshot = true;
		await this.transport.send({
			type: 'sync-request',
			playerId: localPlayer.playerId,
			expectedServerOrder: this.nextServerOrder,
			reason: 'missing-sequenced-messages',
		});
	}

	private hasOutOfOrderGap(): boolean {
		if (this.nextServerOrder == null) {
			return false;
		}

		if (this.pendingOrderedMessages.size === 0) {
			return false;
		}

		if (this.pendingOrderedMessages.has(this.nextServerOrder)) {
			return false;
		}

		for (const order of this.pendingOrderedMessages.keys()) {
			if (order > this.nextServerOrder) {
				return true;
			}
		}

		return false;
	}

	private handleSyncRequest(message: GameMessage & { type: 'sync-request' }): void {
		if (!this.isHostFlag) {
			return;
		}

		const localPlayer = this.getLocalPlayer();
		if (!localPlayer) {
			return;
		}

		void this.transport.send({
			type: 'sync-snapshot',
			playerId: message.playerId,
			config: this.state.config,
			reason: message.reason || `resync requested at order ${String(message.expectedServerOrder)}`,
		});
	}

	private handleSyncSnapshot(message: GameMessage & { type: 'sync-snapshot' }): void {
		const localPlayer = this.getLocalPlayer();
		if (!localPlayer || localPlayer.playerId !== message.playerId) {
			return;
		}

		this.awaitingSyncSnapshot = false;
		this.resetServerOrdering();
		this.gameMessageHandlers.forEach((handler) => handler(message));
	}

	private resetServerOrdering(): void {
		if (this.gapRecoveryTimer != null) {
			clearTimeout(this.gapRecoveryTimer);
			this.gapRecoveryTimer = null;
		}
		this.nextServerOrder = null;
		this.pendingOrderedMessages.clear();
		this.gapRecoveryAttempts = 0;
		this.awaitingSyncSnapshot = false;
	}

	private handlePlayerJoined(player: LobbyPlayer, peerId: PeerId): void {
		const existingPlayer = this.state.players.find((item) => item.peerId === peerId);

		if (existingPlayer) {
			Object.assign(existingPlayer, player);
			this.emitLobbyUpdate();
			return;
		}

		this.state.players.push(player);
		this.state.players.sort((a, b) => a.playerIndex - b.playerIndex);
		this.emitLobbyUpdate();

		this.gameMessageHandlers.forEach((handler) => handler({ type: 'player-joined', player }));

		const myPeerId = this.transport.getMyId();
		if (player.peerId === myPeerId && this.pendingJoinResolve) {
			this.resolveJoin(player);
		}
	}

	private handleLobbyJoined(player: LobbyPlayer, _peerId: PeerId): void {
		const myPeerId = this.transport.getMyId();
		// The host broadcasts `lobby-joined` with the newly joined peer's info so that
		// peer learns its server-assigned playerIndex. All other clients (including the
		// host) already know this from the preceding `player-joined` message; processing
		// it as their own would overwrite their local player with the wrong index.
		if (player.peerId !== myPeerId) {
			return;
		}

		const localPlayer: LobbyPlayer = {
			...player,
			playerId: player.playerId || myPeerId,
			peerId: myPeerId,
			name: myPeerId,
		};

		const players = this.state.players.filter(
			(player) => player.peerId !== myPeerId && player.playerId !== myPeerId,
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
		this.resolveJoin(localPlayer);
	}

	private handleMatchStart(message: GameMessage & { type: 'match-start' }): void {
		const myPeerId = this.transport.getMyId();
		const players = message.players.map((player) => {
			if (player.peerId === myPeerId) {
				return { ...player, playerId: myPeerId, peerId: myPeerId };
			}
			return player;
		});

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
	}

	private handlePlayerLeft(message: GameMessage & { type: 'player-left' }): void {
		if (this.pendingJoinReject) {
			this.rejectJoin(new Error('Lobby host rejected the connection'));
			return;
		}

		this.state = { ...this.state, status: 'ended' };
		this.emitLobbyUpdate();
		this.gameMessageHandlers.forEach((handler) =>
			handler({ type: 'player-left', playerId: message.playerId, player: message.player }),
		);
	}

	private handlePeerJoin(peerId: PeerId): void {
		if (!this.isHostFlag || this.state.status !== 'waiting') {
			return;
		}

		const nextPlayer = this.state.players.find((player) => player.peerId === peerId);

		if (nextPlayer) {
			this.transport.send({
				type: 'lobby-joined',
				player: nextPlayer,
			});
		}
	}

	private handlePeerLeave(peerId: PeerId): void {
		const leavingPlayer = this.state.players.find((player) => player.peerId === peerId);

		if (!leavingPlayer) {
			return;
		}

		this.state.players = this.state.players.filter((player) => player.peerId !== peerId);

		if (this.isHostFlag) {
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
			}, 30000);

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

	private resolveJoin(player?: LobbyPlayer): void {
		const localPlayer = player || this.getLocalPlayer();

		if (!localPlayer || !this.pendingJoinResolve) {
			return;
		}

		const resolve = this.pendingJoinResolve;
		this.pendingJoinResolve = undefined;
		this.pendingJoinReject = undefined;
		this.isHostFlag = this.state.hostPeerId === this.transport.getMyId();
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
