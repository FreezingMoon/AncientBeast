import { getPhaser } from './phaser-runtime';
import type { Scene } from 'phaser';

/**
 * The Phaser `Scene` base class, resolved at module-evaluation time.
 *
 * This module is only ever reached through a dynamic `import()` issued by
 * `Game.createPhaser()`, which awaits the Phaser runtime first. Evaluating
 * `getPhaser()` at module scope is therefore safe, and it is what keeps this
 * file out of the initial bundle: a static `import { Scene } from 'phaser'`
 * would put the whole engine on the pre-match critical path.
 */
const SceneBase = getPhaser().Scene as typeof Scene;

/**
 * The contract the Ancient Beast scene needs from its host (`Game`).
 *
 * The scene never reaches for a global: `Game` hands itself to the scene at
 * construction time, so the scene is decoupled from module-level state and can
 * be instantiated more than once (one per match).
 */
export interface GameSceneHost {
	/** Called once, from `create()`, when Phaser has finished booting the scene. */
	onSceneReady(): void;
	/** Called from `update()` on every frame the scene is active. */
	onSceneUpdate(time: number, delta: number): void;
}

export const GAME_SCENE_KEY = 'AncientBeast';

/**
 * The single Phaser 4 scene backing Ancient Beast.
 *
 * Phaser 2 CE used a global `game.state` bag. In Phaser 4 the equivalent is a
 * scene, so the whole "state" concept collapses into this class: assets are
 * queued through `this.load` (reached via {@link GameEngine}), and the rest of
 * the engine hangs off the scene's own systems.
 */
export class GameScene extends SceneBase {
	private readonly host: GameSceneHost;

	constructor(host: GameSceneHost) {
		super({ key: GAME_SCENE_KEY });
		this.host = host;
	}

	/** Phaser 4 boots scenes with optional data; AB needs none. */
	init(): void {}

	/** Asset queuing happens through the engine loader, so nothing to preload here. */
	preload(): void {}

	create(): void {
		this.host.onSceneReady();
	}

	update(time: number, delta: number): void {
		this.host.onSceneUpdate(time, delta);
	}
}
