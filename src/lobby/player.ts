/**
 * Player Session Management
 *
 * Represents a unique player session with auto-generated ID.
 */

import { v4 as uuidv4 } from 'uuid';

export class PlayerSession {
	public readonly id: string;
	public readonly createdAt: Date;
	public socketId?: string;
	public currentLobbyId?: string;
	public isReady: boolean;
	public gameMode?: string;
	public region?: string;

	private constructor() {
		this.id = uuidv4();
		this.createdAt = new Date();
		this.isReady = false;
	}

	/**
	 * Create a new player session with auto-generated ID
	 */
	public static create(): PlayerSession {
		return new PlayerSession();
	}

	/**
	 * Get player info (safe to send to clients)
	 */
	public getInfo(): object {
		return {
			id: this.id,
			createdAt: this.createdAt.toISOString(),
			isReady: this.isReady,
			currentLobbyId: this.currentLobbyId,
			gameMode: this.gameMode,
			region: this.region,
		};
	}

	/**
	 * Set player ready status
	 */
	public setReady(ready: boolean): void {
		this.isReady = ready;
	}

	/**
	 * Join a lobby
	 */
	public joinLobby(lobbyId: string): void {
		this.currentLobbyId = lobbyId;
	}

	/**
	 * Leave current lobby
	 */
	public leaveLobby(): void {
		this.currentLobbyId = undefined;
	}

	/**
	 * Set matchmaking preferences
	 */
	public setPreferences(gameMode: string, region?: string): void {
		this.gameMode = gameMode;
		this.region = region;
	}
}
