import { tryGetPhaser } from '../phaser/runtime';
import type Phaser from 'phaser';

/**
 * AB's clock: where time comes from, and how a repeating frame callback is driven.
 *
 * Cycloper used to hand-roll its animation loops out of `Date.now()` and
 * `setTimeout(fn, 16)`. That is a determinism hazard rather than a style
 * problem. Phaser's `TweenManager` computes its own delta as
 * `Date.now() - prevTime`, so a headless runner has to advance a virtual clock
 * for tweens to move at all; a real `Date.now()` left inside gameplay code would
 * then disagree with every tween around it, and Cycloper's beams would report a
 * progress the beam graphics had not reached.
 *
 * So every timing read here goes through the scene's own clock when a scene is
 * registered, and only falls back to the host clock when there is no engine —
 * the unit suites, and the simulation harness until Phase 7 replaces its fake
 * engine with a real `Phaser.HEADLESS` boot.
 */

type Scene = Phaser.Scene;

/** Frame cadence for hand-driven animations, in ms. */
export const FRAME_INTERVAL_MS = 16;

let scene: Scene | null = null;
let lastDeltaMs = 0;

/**
 * Record the current frame's delta.
 *
 * Phaser 4's `Clock` exposes `now` but has no `delta` and no equivalent of
 * Phaser 2 CE's `elapsedMS`, so the frame delta has to be captured from
 * `Scene.update(time, delta)` — which is where the adapter captured it too, into
 * the same hand-rolled field.
 *
 * This is the delta since the *previous* update, not cumulative time. Consumers
 * such as the Infernal glow accumulate it into a `uTime` uniform, so treating it
 * as cumulative would drive those animations at the frame rate times too fast.
 */
export function advanceFrame(deltaMs: number): void {
	lastDeltaMs = deltaMs;
}

/**
 * Register the scene whose clock AB timing should follow.
 *
 * Called by `Game.createPhaser()` once the scene exists, and cleared by
 * `Game.destroyPhaser()`. Registering rather than importing is what keeps this
 * module free of the engine: it is reached by abilities at module scope, long
 * before a match is created.
 */
export function setClockScene(next: Scene | null): void {
	scene = next;
}

/** The registered scene, or `null` when no match is running. */
export function getClockScene(): Scene | null {
	return scene;
}

/**
 * Milliseconds since the epoch, on whichever clock is in effect.
 *
 * The scene's clock is preferred so a hand-driven loop and a Phaser tween
 * started in the same frame report the same elapsed time.
 */
export function now(): number {
	return scene?.time?.now ?? Date.now();
}

/**
 * Milliseconds elapsed since the previous frame.
 *
 * Sourced from {@link advanceFrame}, which the scene calls from `update()`.
 * Reports 0 before the first frame of a match: there is no previous frame yet,
 * and inventing one would hand smoothing terms a spike on the first tick.
 */
export function deltaMs(): number {
	return lastDeltaMs;
}

/** A cancellable timer. */
export interface Timer {
	/** Stop the timer. Safe to call more than once. */
	stop(): void;
}

/**
 * Schedule `callback` every `intervalMs` until the returned handle is stopped.
 *
 * On a scene this becomes `scene.time.addEvent`, so the callback runs on the
 * scene's update step and is stepped by the same clock as the tweens. Off-engine
 * it is a host `setInterval`, which is what those paths already used.
 */
export function every(intervalMs: number, callback: () => void): Timer {
	if (scene?.time?.addEvent) {
		const event = scene.time.addEvent({ delay: intervalMs, loop: true, callback });
		return {
			stop: () => {
				scene?.time?.removeEvent(event);
			},
		};
	}

	const handle = setInterval(callback, intervalMs);
	return {
		stop: () => {
			clearInterval(handle);
		},
	};
}

/** Schedule `callback` once after `delayMs`. */
export function after(delayMs: number, callback: () => void): Timer {
	const active = scene;
	if (active?.time?.addEvent) {
		const event = active.time.addEvent({ delay: delayMs, callback });
		return {
			stop: () => {
				active.time.removeEvent(event);
			},
		};
	}

	const handle = setTimeout(callback, delayMs);
	return {
		stop: () => {
			clearTimeout(handle);
		},
	};
}

/** Stop scheduling callbacks and clear the clock source. Used on teardown. */
export function resetClock(): void {
	scene = null;
	lastDeltaMs = 0;
}

/** Handle for a running {@link runTimedAnimation}. */
export interface TimedAnimation {
	/** Stop the loop early, without running `onDone`. */
	cancel(): void;
}

/**
 * Run a fixed-duration animation loop.
 *
 * `onFrame` receives the elapsed milliseconds and the 0..1 progress, and runs on
 * the first frame immediately — a loop that waited a full frame before drawing
 * would flash its start state. When progress reaches 1 the loop stops itself and
 * `onDone` runs.
 *
 * All four of Cycloper's beams had this shape open-coded, each with its own
 * `if (startTime === undefined) startTime = Date.now()` first-call special case
 * that sampled the clock once before the animation actually began.
 *
 * Callers that can be settled by something other than the clock running out —
 * the wall-print effect, whose `finish()` also fires on an exception — hold the
 * returned handle and call `cancel()`, which is what their `settled` flag was
 * doing by hand.
 */
export function runTimedAnimation(opts: {
	durationMs: number;
	onFrame(elapsedMs: number, progress: number): void;
	onDone?(): void;
	/** Frame cadence; defaults to {@link FRAME_INTERVAL_MS}. */
	intervalMs?: number;
}): TimedAnimation {
	const { durationMs, onFrame, onDone, intervalMs = FRAME_INTERVAL_MS } = opts;
	const startedAt = now();

	let timer: Timer | null = null;
	let finished = false;

	const stop = () => {
		finished = true;
		timer?.stop();
		timer = null;
	};

	const tick = () => {
		if (finished) {
			return;
		}

		const elapsedMs = now() - startedAt;
		const progress = durationMs <= 0 ? 1 : Math.min(1, elapsedMs / durationMs);

		try {
			onFrame(elapsedMs, progress);
		} catch (error) {
			// A frame that throws ends the animation, and the error is rethrown.
			//
			// The old `setTimeout` chains died on their own when a frame threw,
			// because the reschedule sat after the drawing code. A repeating scene
			// timer has no such self-limiting behaviour, so without this a failed
			// frame would be redrawn forever — against sprites the frame's own error
			// path has usually already destroyed.
			//
			// Rethrowing keeps this module from deciding what the failure means: the
			// caller still reports it and settles its own state.
			stop();
			throw error;
		}

		if (progress >= 1) {
			stop();
			onDone?.();
		}
	};

	// The first frame is drawn before the timer is registered, not after. A caller
	// can settle the animation from inside that first frame — the wall-print
	// effect does, on any error in its draw — and it cannot cancel a handle it has
	// not been given back yet. Registering the interval first would leave that
	// animation running against a destroyed wall.
	tick();

	if (!finished) {
		timer = every(intervalMs, tick);
	}

	return { cancel: stop };
}

/**
 * Whether the Phaser runtime is available to this module right now.
 *
 * Kept so a caller can assert it is on the engine-backed path — the headless
 * runner does, since its whole job is to step the real engine.
 */
export function isEngineClockActive(): boolean {
	return tryGetPhaser() !== null && scene !== null;
}
