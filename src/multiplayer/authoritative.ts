import type { AbilityTarget } from './types';

/**
 * Transport-agnostic authoritative-multiplayer vocabulary.
 *
 * These types deliberately live in the `multiplayer` layer (not `devvit`) so
 * ANY transport can carry them: Devvit realtime, PeerJS (peerj2), Rivalis, Hono
 * HTTP, a local in-memory loopback for tests, etc. The game (`Game`) and the
 * server-side engine processor speak this vocabulary through the existing
 * `ITransport`/`INetworkBackend` envelope — they never name a transport.
 *
 * An `Intent` is a client *input* (what the player did). The server applies it
 * through the one deterministic engine and replies with an `AuthoritativeState`
 * snapshot. Because the engine is deterministic, replaying the same ordered
 * intent log yields identical state on every client — that is the whole point.
 */

export type Intent =
	| { kind: 'skip' }
	| { kind: 'delay' }
	| { kind: 'move'; target: { x: number; y: number }; path?: Array<{ x: number; y: number }> }
	| { kind: 'ability'; id: number; target: AbilityTarget; args: unknown[] };

export interface CreatureSnapshot {
	id: number;
	type: string;
	name: string;
	x: number;
	y: number;
	health: number;
	maxHealth: number;
	energy: number;
	maxEnergy: number;
	dead: boolean;
	vaporized: boolean;
	remainingMove: number;
	/** Movement banked from previous turns; added on top of the creature's movement. */
	movementPool?: number;
	playerIndex: number | null;
	status: {
		frozen: boolean;
		dizzy: boolean;
		cryostasis: boolean;
	};
}

export interface PlayerSnapshot {
	playerIndex: number;
	controller: string;
	score: number;
}

export interface AuthoritativeState {
	turn: number;
	round: number;
	gameState: string;
	activeCreatureId: number | null;
	players: PlayerSnapshot[];
	creatures: CreatureSnapshot[];
	queue: number[];
}

/**
 * Ordered, append-only intent log — the single source of truth the server
 * reconstructs engine state from. In-memory for local/test/dev; a Redis-backed
 * implementation drops in for serverless production (Devvit Lambdas don't keep
 * a live instance between requests, so the engine is rebuilt via
 * `LobbyEngine.fromLog(config, log)` on every step).
 */
export interface IntentStore {
	/** Append an intent; returns the new sequence number (1-based). */
	append(code: string, intent: Intent): Promise<number>;
	/** Full ordered log for a lobby. */
	getLog(code: string): Promise<Intent[]>;
	/** Current sequence (number of intents applied). */
	getSequence(code: string): Promise<number>;
	/** Whether a log exists for this lobby yet. */
	has(code: string): Promise<boolean>;
	/** Drop a lobby's log (rematch / cleanup). */
	reset(code: string): Promise<void>;
}

/** Default pluggable store. Swap for a RedisIntentStore in production. */
export class InMemoryIntentStore implements IntentStore {
	private readonly logs = new Map<string, Intent[]>();

	async append(code: string, intent: Intent): Promise<number> {
		const log = this.logs.get(code) ?? [];
		log.push(intent);
		this.logs.set(code, log);
		return log.length;
	}

	async getLog(code: string): Promise<Intent[]> {
		return [...(this.logs.get(code) ?? [])];
	}

	async getSequence(code: string): Promise<number> {
		return (this.logs.get(code) ?? []).length;
	}

	async has(code: string): Promise<boolean> {
		return this.logs.has(code);
	}

	async reset(code: string): Promise<void> {
		this.logs.delete(code);
	}
}
