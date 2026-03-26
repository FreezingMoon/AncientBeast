/**
 * Lobby Client - Client-side API for lobby server communication
 */

import io, { Socket } from 'socket.io-client';

export interface LobbyInfo {
	id: string;
	name: string;
	hostId: string;
	isPrivate: boolean;
	maxPlayers: number;
	currentPlayerCount: number;
	gameMode: string;
	status: string;
	players: PlayerInfo[];
}

export interface PlayerInfo {
	id: string;
	isReady: boolean;
	currentLobbyId?: string;
}

export interface MatchInfo {
	lobbyId: string;
	players: PlayerInfo[];
}

export class LobbyClient {
	private socket: Socket;
	private serverUrl: string;
	private playerId?: string;
	private playerRegistration?: Promise<string>;

	constructor(serverUrl = 'http://localhost:3001') {
		this.serverUrl = serverUrl;
		this.socket = io(serverUrl);
		this.setupSocketHandlers();
	}

	/**
	 * Setup Socket.IO event handlers
	 */
	private setupSocketHandlers(): void {
		this.socket.on('connect', () => {
			console.log('Connected to lobby server');
		});

		this.socket.on('lobby:playerJoined', (data: { playerId: string }) => {
			console.log(`Player ${data.playerId} joined lobby`);
			this.onPlayerJoined?.(data.playerId);
		});

		this.socket.on('lobby:playerLeft', (data: { playerId: string }) => {
			console.log(`Player ${data.playerId} left lobby`);
			this.onPlayerLeft?.(data.playerId);
		});

		this.socket.on('matchmaking:matchFound', (data: MatchInfo) => {
			console.log('Match found!', data);
			this.onMatchFound?.(data);
		});

		this.socket.on('disconnect', () => {
			console.log('Disconnected from lobby server');
		});
	}

	/**
	 * Event callbacks
	 */
	public onPlayerJoined?: (playerId: string) => void;
	public onPlayerLeft?: (playerId: string) => void;
	public onMatchFound?: (match: MatchInfo) => void;

	/**
	 * Register a new player
	 */
	public async registerPlayer(): Promise<string> {
		if (this.playerId) {
			return this.playerId;
		}

		if (this.playerRegistration) {
			return this.playerRegistration;
		}

		this.playerRegistration = this.createPlayerSession();
		return this.playerRegistration;
	}

	private async createPlayerSession(): Promise<string> {
		const response = await fetch(`${this.serverUrl}/api/v1/player/register`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
		});

		const data = await response.json();
		if (data.success) {
			this.playerId = data.playerId;
			this.playerRegistration = undefined;
			return data.playerId;
		}

		this.playerRegistration = undefined;
		throw new Error('Failed to register player');
	}

	/**
	 * Get player info
	 */
	public async getPlayerInfo(playerId: string): Promise<PlayerInfo> {
		const response = await fetch(`${this.serverUrl}/api/v1/player/${playerId}`);
		const data = await response.json();
		return data;
	}

	/**
	 * Create a new lobby
	 */
	public async createLobby(name = '', isPrivate = false, maxPlayers = 8): Promise<LobbyInfo> {
		const playerId = await this.registerPlayer();

		const response = await fetch(`${this.serverUrl}/api/v1/lobby/create`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ playerId, lobbyName: name, isPrivate, maxPlayers }),
		});

		const data = await response.json();
		if (data.success) {
			this.socket.emit('lobby:join', { playerId, lobbyId: data.lobby.id });
			return data.lobby;
		}
		throw new Error('Failed to create lobby');
	}

	/**
	 * List available lobbies
	 */
	public async listLobbies(): Promise<LobbyInfo[]> {
		const response = await fetch(`${this.serverUrl}/api/v1/lobby/list`);
		const data = await response.json();
		return data.lobbies || [];
	}

	/**
	 * Join a lobby
	 */
	public async joinLobby(lobbyId: string): Promise<LobbyInfo> {
		const playerId = await this.registerPlayer();

		const response = await fetch(`${this.serverUrl}/api/v1/lobby/${lobbyId}/join`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ playerId }),
		});

		const data = await response.json();
		if (data.success) {
			this.socket.emit('lobby:join', { playerId, lobbyId });
			return data.lobby;
		}
		throw new Error('Failed to join lobby');
	}

	/**
	 * Leave current lobby
	 */
	public leaveLobby(lobbyId: string): void {
		if (this.playerId) {
			this.socket.emit('lobby:leave', { playerId: this.playerId, lobbyId });
		}
	}

	/**
	 * Add to matchmaking queue
	 */
	public async addToQueue(gameMode = 'standard'): Promise<number> {
		const playerId = await this.registerPlayer();

		const response = await fetch(`${this.serverUrl}/api/v1/matchmaking/queue`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ playerId, gameMode }),
		});

		const data = await response.json();
		if (data.success) {
			return data.estimatedWaitTime;
		}
		throw new Error('Failed to add to queue');
	}

	/**
	 * Leave matchmaking queue
	 */
	public async leaveQueue(): Promise<void> {
		const playerId = this.playerId;
		if (!playerId) {
			throw new Error('Player not registered');
		}

		const response = await fetch(`${this.serverUrl}/api/v1/matchmaking/leave`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ playerId }),
		});

		const data = await response.json();
		if (!data.success) {
			throw new Error('Failed to leave queue');
		}
	}

	/**
	 * Accept match
	 */
	public acceptMatch(): void {
		if (this.playerId) {
			this.socket.emit('matchmaking:accept', { playerId: this.playerId });
		}
	}

	/**
	 * Get server stats
	 */
	public async getStats(): Promise<{
		players: number;
		lobbies: number;
		queuedPlayers: number;
		uptime: number;
	}> {
		const response = await fetch(`${this.serverUrl}/api/v1/stats`);
		return await response.json();
	}

	/**
	 * Get player ID
	 */
	public getPlayerId(): string | undefined {
		return this.playerId;
	}

	/**
	 * Disconnect from server
	 */
	public disconnect(): void {
		this.socket.disconnect();
	}
}
