/* eslint-disable @typescript-eslint/no-explicit-any */
import {
	createHeadlessGame,
	applyIntent,
	settle,
	serializeState,
	destroyHeadlessGame,
	type HeadlessConfig,
} from './headlessGame';
import type { AuthoritativeState, Intent } from './authoritativeTypes';

/**
 * Server-side authoritative engine for one lobby.
 *
 * The server owns the single source of truth: it applies each client `Intent`
 * through the real engine and broadcasts the resulting `AuthoritativeState`.
 * Clients become thin renderers that adopt this state instead of recomputing
 * logic — which is why the old `creature-died` / `opts.path` / gap-recovery
 * hacks become unnecessary: deaths and positions are just outcomes of the
 * deterministic step.
 *
 * Prototype note: this keeps a live in-memory game instance for speed. On a
 * serverless runtime (Devvit) no instance survives between requests, so
 * production should reconstruct from the persisted intent log via
 * `LobbyEngine.fromLog()` (or `replayIntents`) — the engine is deterministic,
 * so replaying the same ordered intents always yields the same state.
 */
export class LobbyEngine {
	private game: any;
	private intents: Intent[] = [];
	sequence = 0;

	private readonly config: Partial<HeadlessConfig>;

	private constructor(config: Partial<HeadlessConfig>, abilities: Array<(G: any) => void>) {
		this.config = config;
		void abilities;
	}

	static async create(
		config: Partial<HeadlessConfig>,
		abilities: Array<(G: any) => void> = [],
	): Promise<LobbyEngine> {
		const engine = new LobbyEngine(config, abilities);
		engine.game = await createHeadlessGame(abilities, {
			config: { ...config, players: config.players },
		});
		return engine;
	}

	/** Apply an intent and wait for the engine to settle; returns authoritative state. */
	async step(intent: Intent): Promise<AuthoritativeState> {
		applyIntent(this.game, intent);
		await settle(this.game);
		this.intents.push(intent);
		this.sequence += 1;
		return this.getState();
	}

	/** Reconstruct an engine from a persisted intent log (serverless-safe). */
	static async fromLog(
		config: Partial<HeadlessConfig>,
		intents: Intent[],
		abilities: Array<(G: any) => void> = [],
	): Promise<LobbyEngine> {
		const engine = new LobbyEngine(config, abilities);
		engine.game = await createHeadlessGame(abilities, {
			config: { ...config, players: config.players },
		});
		for (const intent of intents) {
			applyIntent(engine.game, intent);
			await settle(engine.game);
		}
		engine.intents = [...intents];
		engine.sequence = intents.length;
		return engine;
	}

	getState(): AuthoritativeState {
		return serializeState(this.game);
	}

	getLog(): readonly Intent[] {
		return this.intents;
	}

	/**
	 * Tear the engine's game down and release every handle it holds
	 * (clock interval, deferred work, Phaser instance, virtual clock).
	 *
	 * Reconstructions are short-lived by design — a serverless host
	 * rebuilds from the log, reads one snapshot, and is done — so an
	 * engine that is not destroyed leaks a live game for the rest of
	 * the process. `create()`-built engines that stay live for a lobby
	 * should be destroyed when the lobby closes.
	 */
	destroy(): void {
		destroyHeadlessGame(this.game);
	}
}
