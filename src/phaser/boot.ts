import type Phaser from 'phaser';
import { getPhaser } from './runtime';

/**
 * The one `GameConfig` factory shared by the browser and the headless runner.
 *
 * Keeping every field here means the headless simulation boots a game that is
 * configured exactly like the one a player sees, rather than a lookalike that
 * drifts as soon as someone edits the browser config. The only difference
 * between the two callers is the render type and whether the config carries a
 * DOM parent.
 */

/** Viewport the browser game is authored against; all layout maths assumes it. */
export const GAME_WIDTH = 1920;
export const GAME_HEIGHT = 1080;

export interface CreateGameConfigOptions {
	/**
	 * One of the `Phaser.AUTO` / `Phaser.CANVAS` / `Phaser.WEBGL` /
	 * `Phaser.HEADLESS` renderer constants. Defaults to `Phaser.AUTO`.
	 */
	type?: number;
	/** Scenes to boot. Omit for the default Ancient Beast scene wiring. */
	scene?: Phaser.Types.Core.GameConfig['scene'];
	/**
	 * DOM element the canvas is appended to. Omitted headless, where there is
	 * nothing to attach to.
	 */
	parent?: string;
}

/**
 * Build the `GameConfig` for an Ancient Beast match.
 *
 * Phaser is read through {@link getPhaser} rather than imported for values, so
 * the caller's static import graph stays free of the engine bundle. Callers must
 * `await loadPhaser()` first.
 */
export function createGameConfig(opts: CreateGameConfigOptions = {}): Phaser.Types.Core.GameConfig {
	const { Scale } = getPhaser();

	return {
		width: GAME_WIDTH,
		height: GAME_HEIGHT,
		type: opts.type ?? getPhaser().AUTO,
		...(opts.parent ? { parent: opts.parent } : {}),
		scale: {
			mode: Scale.FIT,
			autoCenter: Scale.CENTER_BOTH,
		},
		scene: opts.scene,
	} as Phaser.Types.Core.GameConfig;
}

/**
 * WebKitGTK reports a WebGL stack that advertises itself but renders black, so
 * those users get the canvas renderer instead.
 */
export function shouldUseCanvasRenderer(userAgent: string): boolean {
	return /(X11|Linux).*AppleWebKit\/.*Version\/.*Safari\//i.test(userAgent);
}
