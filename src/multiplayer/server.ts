/**
 * Multiplayer Server - Lobby-based replacement for Nakama
 * 
 * Replaces old Nakama-based server with new lobby system.
 * @file server.ts
 */

import { LobbyClient } from '../networking/lobby-client';
import { P2PGameIntegration } from '../networking/p2p-game';
import Game from '../game';

export default class LobbyServer {
	public client: LobbyClient;
	private p2pIntegration: P2PGameIntegration;
	private serverUrl: string;
	public game: Game;
	private playerId?: string;

	constructor(game: Game, serverUrl: string = 'http://localhost:3001') {
		this.serverUrl = serverUrl;
		this.client = new LobbyClient(serverUrl);
		this.game = game;
		this.playerId = undefined;
		
		// Setup P2P integration (will be initialized after player registration)
		this.p2pIntegration = null as any;
	}

	/**
	 * Initialize lobby connection and register player
	 */
	async initialize(): Promise<string> {
		console.log('Initializing lobby connection...');
		
		try {
			// Register player with auto-generated ID
			this.playerId = await this.client.registerPlayer();
			console.log(`Player registered: ${this.playerId}`);

			// Setup P2P integration
			this.p2pIntegration = new P2PGameIntegration(this.client, this.playerId);
			
			// Setup P2P event handlers
			this.p2pIntegration.onGameStateUpdate((state) => {
				console.log('Game state updated:', state);
				// Update game UI with new state
			});

			this.p2pIntegration.onPlayerAction((action) => {
				console.log('Player action received:', action);
				// Handle incoming player action
			});

			return this.playerId;
		} catch (error) {
			console.error('Failed to initialize lobby:', error);
			throw error;
		}
	}

	/**
	 * Create a new lobby
	 */
	async createLobby(name: string = '', isPrivate: boolean = false, maxPlayers: number = 8): Promise<any> {
		if (!this.playerId) {
			throw new Error('Player not registered. Call initialize() first.');
		}

		console.log(`Creating lobby: ${name}`);
		const lobby = await this.client.createLobby(name, isPrivate, maxPlayers);
		console.log('Lobby created:', lobby);
		return lobby;
	}

	/**
	 * Join an existing lobby
	 */
	async joinLobby(lobbyId: string): Promise<any> {
		if (!this.playerId) {
			throw new Error('Player not registered. Call initialize() first.');
		}

		console.log(`Joining lobby: ${lobbyId}`);
		const lobby = await this.client.joinLobby(lobbyId);
		console.log('Joined lobby:', lobby);

		// Setup P2P connections with other players
		await this.p2pIntegration.joinLobby(lobbyId);
		
		return lobby;
	}

	/**
	 * Browse available lobbies
	 */
	async listLobbies(): Promise<any[]> {
		return await this.client.listLobbies();
	}

	/**
	 * Start matchmaking
	 */
	async startMatchmaking(gameMode: string = 'standard'): Promise<number> {
		if (!this.playerId) {
			throw new Error('Player not registered. Call initialize() first.');
		}

		console.log('Starting matchmaking...');
		const waitTime = await this.client.addToQueue(gameMode);
		console.log(`Estimated wait time: ${waitTime}ms`);
		return waitTime;
	}

	/**
	 * Cancel matchmaking
	 */
	async cancelMatchmaking(): Promise<void> {
		await this.client.leaveQueue();
		console.log('Matchmaking cancelled');
	}

	/**
	 * Set player ready status
	 */
	setReady(ready: boolean): void {
		if (this.p2pIntegration) {
			this.p2pIntegration.setReady(ready);
		}
	}

	/**
	 * Start game (host only)
	 */
	startGame(): void {
		if (this.p2pIntegration) {
			this.p2pIntegration.startGame();
		}
	}

	/**
	 * Send player action to all peers
	 */
	sendAction(action: any): void {
		if (this.p2pIntegration) {
			this.p2pIntegration.sendPlayerAction(action);
		}
	}

	/**
	 * Leave current lobby
	 */
	leaveLobby(): void {
		if (this.p2pIntegration) {
			this.p2pIntegration.leaveGame();
		}
		this.client.leaveLobby(this.p2pIntegration?.currentLobbyId || '');
	}

	/**
	 * Get current player ID
	 */
	getPlayerId(): string | undefined {
		return this.playerId;
	}

	/**
	 * Get P2P integration
	 */
	getP2PIntegration(): P2PGameIntegration {
		return this.p2pIntegration;
	}

	/**
	 * Disconnect from lobby server
	 */
	disconnect(): void {
		this.leaveLobby();
		this.client.disconnect();
		console.log('Disconnected from lobby server');
	}
}
