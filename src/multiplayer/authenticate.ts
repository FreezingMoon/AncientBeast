/**
 * Authenticate - Lobby-based replacement for Nakama authentication
 * 
 * Replaces old Nakama-based authentication with new lobby system.
 * @file authenticate.ts
 */

import { LobbyClient } from '../networking/lobby-client';

export default class LobbyAuthenticate {
	private client: LobbyClient;

	constructor() {
		this.client = new LobbyClient();
	}

	/**
	 * Register new player with auto-generated ID
	 * Replaces Nakama email/password registration
	 */
	async register(): Promise<string> {
		console.log('Registering new player...');
		const playerId = await this.client.registerPlayer();
		console.log(`Player registered: ${playerId}`);
		return playerId;
	}

	/**
	 * Authenticate player (for lobby system, this is just registration)
	 * Replaces Nakama email/password authentication
	 */
	async authenticate(): Promise<string> {
		console.log('Authenticating player...');
		const playerId = await this.client.registerPlayer();
		console.log(`Player authenticated: ${playerId}`);
		return playerId;
	}

	/**
	 * Get player info
	 */
	async getPlayerInfo(playerId: string): Promise<any> {
		return await this.client.getPlayerInfo(playerId);
	}

	/**
	 * Disconnect from lobby server
	 */
	disconnect(): void {
		this.client.disconnect();
	}
}
