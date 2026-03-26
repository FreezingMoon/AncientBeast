/**
 * Matchmaking System
 *
 * Manages player queue and creates matches.
 */

import { PlayerSession } from './player';
import { LobbyManager } from './lobby';
import { v4 as uuidv4 } from 'uuid';

interface QueuedPlayer {
	player: PlayerSession;
	gameMode: string;
	queuedAt: Date;
}

interface Match {
	id: string;
	lobbyId: string;
	players: PlayerSession[];
	createdAt: Date;
}

export class Matchmaker {
	private queue: Map<string, QueuedPlayer>;
	private lobbyManager: LobbyManager;
	private matches: Map<string, Match>;

	constructor(lobbyManager: LobbyManager) {
		this.queue = new Map();
		this.lobbyManager = lobbyManager;
		this.matches = new Map();
	}

	/**
	 * Add player to matchmaking queue
	 */
	public addToQueue(player: PlayerSession, gameMode = 'standard'): void {
		this.queue.set(player.id, {
			player,
			gameMode,
			queuedAt: new Date(),
		});
	}

	/**
	 * Remove player from queue
	 */
	public removeFromQueue(playerId: string): void {
		this.queue.delete(playerId);
	}

	/**
	 * Get queue size
	 */
	public getQueueSize(): number {
		return this.queue.size;
	}

	/**
	 * Get estimated wait time
	 */
	public getEstimatedWaitTime(): number {
		const queueSize = this.queue.size;
		if (queueSize < 2) {
			return -1; // Unknown
		}
		// Rough estimate: 30 seconds per 2 players
		return Math.max(30000, (queueSize / 2) * 30000);
	}

	/**
	 * Try to create a match
	 */
	public createMatch(playerId: string): Match | null {
		const queuedPlayer = this.queue.get(playerId);
		if (!queuedPlayer) {
			return null;
		}

		// Find compatible players in queue
		const compatiblePlayers = Array.from(this.queue.values())
			.filter((qp) => qp.gameMode === queuedPlayer.gameMode)
			.filter((qp) => qp.player.id !== playerId)
			.slice(0, 7); // Max 8 players total

		if (compatiblePlayers.length < 1) {
			return null; // Need at least 2 players
		}

		// Create lobby for match
		const allPlayers = [queuedPlayer.player, ...compatiblePlayers.map((qp) => qp.player)];
		const lobby = this.lobbyManager.createLobby(
			queuedPlayer.player,
			`Match-${uuidv4().substring(0, 8)}`,
			false,
			8,
		);

		// Add all players to lobby
		allPlayers.forEach((player) => {
			if (player !== queuedPlayer.player) {
				this.lobbyManager.joinLobby(lobby, player);
				this.removeFromQueue(player.id);
			}
		});
		this.removeFromQueue(playerId);

		// Create match record
		const match: Match = {
			id: uuidv4(),
			lobbyId: lobby.id,
			players: allPlayers,
			createdAt: new Date(),
		};

		this.matches.set(match.id, match);

		return match;
	}

	/**
	 * Periodically try to create matches
	 */
	public processQueue(): void {
		if (this.queue.size < 2) {
			return;
		}

		// Group players by game mode
		const playersByMode = new Map<string, QueuedPlayer[]>();
		for (const qp of this.queue.values()) {
			if (!playersByMode.has(qp.gameMode)) {
				playersByMode.set(qp.gameMode, []);
			}
			playersByMode.get(qp.gameMode)!.push(qp);
		}

		// Create matches for each game mode
		for (const [gameMode, players] of playersByMode.entries()) {
			if (players.length >= 2) {
				// Create match with first 2-8 players
				const matchSize = Math.min(8, players.length);
				const matchPlayers = players.slice(0, matchSize);

				const lobby = this.lobbyManager.createLobby(
					matchPlayers[0].player,
					`Match-${gameMode}-${uuidv4().substring(0, 8)}`,
					false,
					8,
				);

				matchPlayers.forEach((qp) => {
					if (qp !== matchPlayers[0]) {
						this.lobbyManager.joinLobby(lobby, qp.player);
						this.removeFromQueue(qp.player.id);
					}
				});
				this.removeFromQueue(matchPlayers[0].player.id);
			}
		}
	}
}
