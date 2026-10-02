import { getPhaser } from '../runtime';
import { AssetLoader } from '../loader';
import { setBoardCamera, resetBoardCamera } from '../../game-display/camera';
import { advanceFrame } from '../../timing/clock';
import type Phaser from 'phaser';

type Container = Phaser.GameObjects.Container;
type Loader = Phaser.Loader.LoaderPlugin;
type Camera = Phaser.Cameras.Scene2D.Camera;

/**
 * The Phaser `Scene` base class, resolved at module-evaluation time.
 *
 * This module is only ever reached through a dynamic `import()` issued by
 * {@link Game.createPhaser}, which awaits the Phaser runtime first. Evaluating
 * `getPhaser()` at module scope is therefore safe, and it is what keeps this
 * file out of the initial bundle: a static `import { Scene } from 'phaser'`
 * would put the whole engine on the pre-match critical path.
 */
const SceneBase = getPhaser().Scene;

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
 * queued through `this.load` and the rest of the game hangs off the scene's own
 * systems.
 */
export class GameScene extends SceneBase {
	private readonly host: GameSceneHost;

	/**
	 * The root of the match's display tree.
	 *
	 * Phaser 2's `game.world` was an implicit global display group; here it is an
	 * explicit container the scene owns, so gameplay code has a single named root
	 * to clear and to parent layers under rather than reaching into
	 * `scene.children`.
	 */
	world!: Container;

	/** Typed aliases for the systems gameplay code talks to most. */
	loader!: Loader;
	camera!: Camera;

	/**
	 * AB's loader seam: the preload batch, the on-demand texture path, and the
	 * progress the loader bar is driven from.
	 *
	 * Built in `create()` rather than constructed with the scene, because it
	 * binds the on-demand loader in `src/assets.ts` to *this* scene's loader and
	 * must be released again when the match goes away.
	 */
	assets!: AssetLoader;

	/**
	 * Frame delta, in ms, for the frame currently being processed.
	 *
	 * Phaser 4's `Clock` exposes `now` but no `elapsedMS`, so the scene records
	 * the delta it is handed. AB's shader effects need the per-frame delta (not
	 * cumulative time) to advance their `uTime` uniform.
	 */
	elapsedMS = 0;

	constructor(host: GameSceneHost) {
		super({ key: GAME_SCENE_KEY });
		this.host = host;
	}

	/** Phaser 4 boots scenes with optional data; AB needs none. */
	init(): void {}

	/** Asset queuing happens through `this.load`, so nothing to preload here. */
	preload(): void {}

	create(): void {
		this.loader = this.load;
		this.camera = this.cameras.main;
		this.assets = new AssetLoader(this);
		// Abilities shake the board from their own module scope, so they reach
		// this camera through the registered handle rather than the scene.
		setBoardCamera(this.camera);
		// `scene.add.container` registers in the scene display list, which is
		// exactly what a world root should be. Layers parent themselves to this.
		this.world = this.add.container(0, 0);
		this.world.setName('world');
		this.host.onSceneReady();
	}

	shutdown(): void {
		// A rematch registers its own camera; leaving this one behind would have
		// effects shaking a destroyed scene for the rest of the session.
		resetBoardCamera();
		this.assets?.destroy();
	}

	update(time: number, delta: number): void {
		this.elapsedMS = delta;
		// AB reads its frame delta from the clock rather than the engine, since
		// Phaser 4's Clock has no `elapsedMS` of its own.
		advanceFrame(delta);
		this.host.onSceneUpdate(time, delta);
	}
}
