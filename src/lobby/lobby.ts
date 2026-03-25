/**
 * Lobby Management
 *
 * Manages creation, joining, and lifecycle of game lobbies.
 */

import { PlayerSession } from './player';
import { v4 as uuidv4 } from 'uuid';

export class Lobby {
	public readonly id: string;
	public readonly name: string;
	public host: PlayerSession;
	public readonly isPrivate: boolean;
	public readonly maxPlayers: number;
	public readonly createdAt: Date;
	public players: PlayerSession[];
	public gameMode: string;
	public status: 'waiting' | 'starting' | 'in-progress' | 'finished';

	constructor(host: PlayerSession, name: string, isPrivate: boolean, maxPlayers = 8) {
		this.id = uuidv4();
		this.name = name || `Lobby-${this.id.substring(0, 8)}`;
		this.host = host;
		this.isPrivate = isPrivate;
		this.maxPlayers = maxPlayers;
		this.createdAt = new Date();
		this.players = [host];
		this.gameMode = 'standard';
		this.status = 'waiting';
	}

	/**
	 * Get lobby info (safe to send to clients)
	 */
	public getInfo(): object {
		return {
			id: this.id,
			name: this.name,
			hostId: this.host.id,
			isPrivate: this.isPrivate,
			maxPlayers: this.maxPlayers,
			currentPlayerCount: this.players.length,
			gameMode: this.gameMode,
			status: this.status,
			createdAt: this.createdAt.toISOString(),
			players: this.players.map((p) => p.getInfo()),
		};
	}

	/**
	 * Add player to lobby
	 */
	public addPlayer(player: PlayerSession): void {
		if (this.players.length >= this.maxPlayers) {
			throw new Error('Lobby is full');
		}
		this.players.push(player);
		player.joinLobby(this.id);
	}

	/**
	 * Remove player from lobby
	 */
	public removePlayer(player: PlayerSession): void {
		const index = this.players.indexOf(player);
		if (index > -1) {
			this.players.splice(index, 1);
			player.leaveLobby();

			// Transfer host if needed
			if (player === this.host && this.players.length > 0) {
				this.host = this.players[0];
			}

			if (this.players.length === 0) {
				this.status = 'finished';
			}
		}
	}

	/**
	 * Check if lobby is full
	 */
	public isFull(): boolean {
		return this.players.length >= this.maxPlayers;
	}

	/**
	 * Start the game
	 */
	public startGame(): void {
		if (this.players.length < 2) {
			throw new Error('Not enough players');
		}
		this.status = 'starting';
	}
}

export class LobbyManager {
	private lobbies: Map<string, Lobby>;

	constructor() {
		this.lobbies = new Map();
	}

	/**
	 * Create a new lobby
	 */
	public createLobby(host: PlayerSession, name: string, isPrivate: boolean, maxPlayers = 8): Lobby {
		const lobby = new Lobby(host, name, isPrivate, maxPlayers);
		this.lobbies.set(lobby.id, lobby);
		return lobby;
	}

	/**
	 * Get lobby by ID
	 */
	public getLobby(lobbyId: string): Lobby | undefined {
		return this.lobbies.get(lobbyId);
	}

	/**
	 * Get all active lobbies
	 */
	public getActiveLobbies(): Lobby[] {
		return Array.from(this.lobbies.values()).filter((lobby) => lobby.status === 'waiting');
	}

	/**
	 * Join a lobby
	 */
	public joinLobby(lobby: Lobby, player: PlayerSession): void {
		lobby.addPlayer(player);
	}

	/**
	 * Leave a lobby
	 */
	public leaveLobby(lobby: Lobby, player: PlayerSession): void {
		lobby.removePlayer(player);

		// Clean up empty lobbies
		if (lobby.players.length === 0) {
			this.lobbies.delete(lobby.id);
		}
	}

	/**
	 * Remove player from all lobbies
	 */
	public removePlayer(player: PlayerSession): void {
		if (player.currentLobbyId) {
			const lobby = this.getLobby(player.currentLobbyId);
			if (lobby) {
				this.leaveLobby(lobby, player);
			}
		}
	}

	/**
	 * Start a game in lobby
	 */
	public startGame(lobbyId: string): void {
		const lobby = this.getLobby(lobbyId);
		if (lobby) {
			lobby.startGame();
		}
	}

	/**
	 * Clean up finished lobbies
	 */
	public cleanupFinishedLobbies(): void {
		for (const [id, lobby] of this.lobbies.entries()) {
			if (lobby.status === 'finished') {
				this.lobbies.delete(id);
			}
		}
	}
}
