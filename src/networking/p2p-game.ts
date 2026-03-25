/**
 * P2P Game Integration
 *
 * Integrates P2P connections with AncientBeast gameplay.
 */

import { P2PHandler, P2PMessage } from './p2p-handler';
import { LobbyClient } from './lobby-client';

export interface GameState {
	players: PlayerState[];
	turn: number;
	currentPlayerId: string;
	gamePhase: 'setup' | 'playing' | 'finished';
}

export interface PlayerState {
	id: string;
	isReady: boolean;
	units: any[];
	resources: any;
}

export class P2PGameIntegration {
	private p2pHandler: P2PHandler;
	private lobbyClient: LobbyClient;
	private currentLobbyId?: string;
	private gameState?: GameState;
	private gameStateUpdateHandler?: (state: GameState) => void;
	private playerActionHandler?: (action: any) => void;

	constructor(lobbyClient: LobbyClient, playerId: string) {
		this.lobbyClient = lobbyClient;
		this.p2pHandler = new P2PHandler(playerId);
		this.setupP2PHandlers();
	}

	/**
	 * Setup P2P event handlers
	 */
	private setupP2PHandlers(): void {
		// Setup signaling via lobby server
		this.p2pHandler.setSignalingCallback((targetId, message) => {
			// Send signaling message via lobby server
			// This would use a custom lobby server endpoint for WebRTC signaling
			console.log(`Sending signaling message to ${targetId}:`, message);
		});

		// Handle peer connected
		this.p2pHandler.onPeerConnected((peerId) => {
			console.log(`Peer connected: ${peerId}`);
			this.updateGameState();
		});

		// Handle peer disconnected
		this.p2pHandler.onPeerDisconnected((peerId) => {
			console.log(`Peer disconnected: ${peerId}`);
			this.updateGameState();
		});

		// Handle incoming messages
		this.p2pHandler.onMessageReceived((message) => {
			this.handleP2PMessage(message);
		});
	}

	/**
	 * Handle incoming P2P message
	 */
	private handleP2PMessage(message: P2PMessage): void {
		console.log(`Received P2P message from ${message.from}:`, message.type);

		switch (message.type) {
			case 'game-state':
				this.gameState = message.data;
				this.gameStateUpdateHandler?.(this.gameState);
				break;

			case 'player-action':
				this.playerActionHandler?.(message.data);
				break;

			case 'chat':
				console.log(`Chat from ${message.from}:`, message.data);
				break;

			case 'custom':
				console.log(`Custom message from ${message.from}:`, message.data);
				break;
		}
	}

	/**
	 * Join lobby and setup P2P connections
	 */
	public async joinLobby(lobbyId: string): Promise<void> {
		this.currentLobbyId = lobbyId;

		// Get lobby info
		const lobby = await this.lobbyClient.joinLobby(lobbyId);
		console.log('Joined lobby:', lobby);

		// Initialize game state
		this.initializeGameState(lobby.players.map((p) => p.id));

		// Setup P2P connections with other players
		await this.setupP2PConnections(lobby.players.map((p) => p.id));
	}

	/**
	 * Initialize game state
	 */
	private initializeGameState(playerIds: string[]): void {
		this.gameState = {
			players: playerIds.map((id) => ({
				id,
				isReady: false,
				units: [],
				resources: {},
			})),
			turn: 1,
			currentPlayerId: playerIds[0],
			gamePhase: 'setup',
		};
	}

	/**
	 * Setup P2P connections with all players in lobby
	 */
	private async setupP2PConnections(playerIds: string[]): Promise<void> {
		const localId = this.p2pHandler.getLocalPlayerId();

		// Connect to all other players
		for (const playerId of playerIds) {
			if (playerId !== localId) {
				await this.p2pHandler.createOffer(playerId);
			}
		}
	}

	/**
	 * Update game state
	 */
	private updateGameState(): void {
		if (!this.gameState) return;

		// Broadcast updated game state to all peers
		this.p2pHandler.broadcastMessage({
			type: 'game-state',
			from: this.p2pHandler.getLocalPlayerId(),
			data: this.gameState,
			timestamp: Date.now(),
		});
	}

	/**
	 * Send player action to all peers
	 */
	public sendPlayerAction(action: any): void {
		if (!this.gameState) return;

		const message: P2PMessage = {
			type: 'player-action',
			from: this.p2pHandler.getLocalPlayerId(),
			to: 'broadcast',
			data: action,
			timestamp: Date.now(),
		};

		this.p2pHandler.broadcastMessage(message);
		this.playerActionHandler?.(action);
	}

	/**
	 * Set player ready status
	 */
	public setReady(ready: boolean): void {
		if (!this.gameState) return;

		const localId = this.p2pHandler.getLocalPlayerId();
		const player = this.gameState.players.find((p) => p.id === localId);
		if (player) {
			player.isReady = ready;
			this.updateGameState();
		}
	}

	/**
	 * Start game (host only)
	 */
	public startGame(): void {
		if (!this.gameState) return;

		// Check if all players are ready
		const allReady = this.gameState.players.every((p) => p.isReady);
		if (!allReady) {
			console.warn('Not all players are ready');
			return;
		}

		this.gameState.gamePhase = 'playing';
		this.updateGameState();
	}

	/**
	 * Leave current game
	 */
	public leaveGame(): void {
		this.p2pHandler.closeAll();
		this.currentLobbyId = undefined;
		this.gameState = undefined;
	}

	/**
	 * Get current game state
	 */
	public getGameState(): GameState | undefined {
		return this.gameState;
	}

	public getCurrentLobbyId(): string | undefined {
		return this.currentLobbyId;
	}

	/**
	 * Get connected players
	 */
	public getConnectedPlayers(): string[] {
		return this.p2pHandler.getConnectedPeers();
	}

	/**
	 * Set game state update callback
	 */
	public onGameStateUpdate(callback: (state: GameState) => void): void {
		this.gameStateUpdateHandler = callback;
	}

	/**
	 * Set player action callback
	 */
	public onPlayerAction(callback: (action: any) => void): void {
		this.playerActionHandler = callback;
	}
}
