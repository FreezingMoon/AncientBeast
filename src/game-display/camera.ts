import { tryGetPhaser } from '../phaser/runtime';
import type Phaser from 'phaser';

type Camera = Phaser.Cameras.Scene2D.Camera;

/**
 * The camera AB shakes, registered by `GameScene` and cleared when it shuts down.
 *
 * Registered rather than imported because abilities reach this module at their
 * own module scope, long before a match exists, and importing the scene would
 * drag the Phaser bundle onto the pre-match critical path.
 */
let camera: Camera | null = null;

/** Point {@link shakeBoard} at a scene's main camera. */
export function setBoardCamera(next: Camera | null): void {
	camera = next;
}

/** Forget the camera. Called when the match's scene shuts down. */
export function resetBoardCamera(): void {
	camera = null;
}

/** Which axes a shake moves along. */
export type ShakeAxis = 'horizontal' | 'vertical' | 'both';

export interface ShakeOptions {
	/**
	 * Peak offset, as a fraction of the camera's viewport.
	 *
	 * 0.01 is a nudge, 0.05 is a slam. This is Phaser's own unit — AB has always
	 * tuned against it, so the numbers carry over unchanged.
	 */
	amplitude: number;
	/** How long the shake runs, in ms. */
	durationMs: number;
	/**
	 * Run the full duration even though the camera would have settled sooner.
	 *
	 * Every shake AB fires sets this, because they are timed against ability
	 * animations that must not outlast the effect they belong to.
	 */
	force?: boolean;
	/** Defaults to `'both'`. */
	axis?: ShakeAxis;
}

/**
 * Shake the board's camera.
 *
 * The single entry point for the ~50 ability effects that shake the screen. The
 * one thing it does beyond forwarding to Phaser is express a one-axis shake: AB's
 * effects are directional (a lift shakes vertically, a charge shakes
 * horizontally), and Phaser 4 spells that as a per-axis `intensity` Vector2 with
 * the unused axis zeroed. Passing a bare number means "both".
 *
 * A no-op off-engine, which is what the headless simulation and the unit suites
 * want: nothing is being rendered, so there is nothing to shake.
 *
 * The old call shape was `shake(amplitude, duration, force, SHAKE_VERTICAL, snap)`.
 * Two of those arguments are gone. `snap` had no Phaser 4 counterpart at all and
 * was already being discarded, and the `SHAKE_*` flags became {@link ShakeAxis}
 * strings rather than magic numbers.
 */
export function shakeBoard(options: ShakeOptions): void {
	const active = camera;
	const phaser = tryGetPhaser();
	if (!active || !phaser) {
		return;
	}

	const { amplitude, durationMs, force, axis = 'both' } = options;

	let intensity: number | Phaser.Math.Vector2 = amplitude;
	if (axis !== 'both') {
		intensity = new phaser.Math.Vector2(
			axis === 'horizontal' ? amplitude : 0,
			axis === 'vertical' ? amplitude : 0,
		);
	}

	active.shake(durationMs, intensity, force);
}
