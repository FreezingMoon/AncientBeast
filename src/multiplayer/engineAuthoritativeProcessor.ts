/* eslint-disable @typescript-eslint/no-explicit-any */
import { LobbyEngine } from '../devvit/authoritativeEngine';
import type { AuthoritativeState, Intent, IntentStore } from './authoritative';
import { InMemoryIntentStore } from './authoritative';

/**
 * Engine-backed authoritative processor.
 *
 * Wraps an `IntentStore` and adds state reconstruction via the deterministic
 * `LobbyEngine.fromLog` (serverless-safe rebuild from the persisted intent
 * log + config). This is the "heavy" variant — it pulls in `game.ts`/`pixi`/
 * `phaser` through the engine, so only bundle it in contexts that can resolve
 * those (the client browser, the playtest runner, dedicated engine nodes, …).
 * Do NOT import it from the serverless server bundle — use the
 * `AuthoritativeProcessor` there instead.
 */
export interface EngineAuthoritativeProcessorOptions {
	store?: IntentStore;
	abilities?: Array<(G: any) => void>;
	loadAbilities?: () => Promise<Array<(G: any) => void>>;
}

export class EngineAuthoritativeProcessor {
	readonly store: IntentStore;
	private readonly abilities: Array<(G: any) => void>;
	private readonly loadAbilities?: () => Promise<Array<(G: any) => void>>;

	constructor(options: EngineAuthoritativeProcessorOptions = {}) {
		this.store = options.store ?? new InMemoryIntentStore();
		this.abilities = options.abilities ?? [];
		this.loadAbilities = options.loadAbilities;
	}

	private async resolveAbilities(): Promise<Array<(G: any) => void>> {
		if (this.loadAbilities) return this.loadAbilities();
		return this.abilities;
	}

	/** Append an intent AND return the full authoritative state. */
	async step(code: string, intent: Intent, config: any): Promise<AuthoritativeState> {
		await this.store.append(code, intent);
		return this.reconstruct(code, config);
	}

	async getState(code: string, config: any): Promise<AuthoritativeState | null> {
		if (!(await this.store.has(code))) return null;
		return this.reconstruct(code, config);
	}

	async has(code: string): Promise<boolean> {
		return this.store.has(code);
	}

	async getLog(code: string): Promise<Intent[]> {
		return this.store.getLog(code);
	}

	async getSequence(code: string): Promise<number> {
		return this.store.getSequence(code);
	}

	async reset(code: string): Promise<void> {
		await this.store.reset(code);
	}

	private async reconstruct(code: string, config: any): Promise<AuthoritativeState> {
		const log = await this.store.getLog(code);
		const abilities = await this.resolveAbilities();
		const engine = await LobbyEngine.fromLog(config, log, abilities);
		try {
			return engine.getState();
		} finally {
			// The reconstruction exists only to produce this snapshot.
			// Left alive it keeps a whole game engine — clock interval,
			// deferred work, Phaser instance — running for the rest of
			// the process: one leak per `step()`, and enough live
			// handles to stop a test worker from exiting gracefully.
			engine.destroy();
		}
	}
}
