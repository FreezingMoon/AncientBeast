import { ensureDomGlobals } from './dom';
import { createGameConfig } from './boot';
import { getPhaser, loadPhaser } from './runtime';
import { GameScene, type GameSceneHost } from './scenes/GameScene';
import type Phaser from 'phaser';

/**
 * A real Phaser 4 game, booted with the HEADLESS renderer and stepped by hand.
 *
 * This replaces the `NullEngine`, which faked a Phaser 2 CE engine well enough
 * for gameplay code to run: tweens applied their target properties immediately
 * and completed on a microtask, timers were inert, and the scene's clock stood
 * still. That was good enough to decide matches, and it was also a different
 * engine — so a bug could pass the simulation and fail in a browser, or the
 * reverse.
 *
 * Booting the real engine removes that gap. The cost is that the engine now
 * decides when time passes, so nothing may drive it implicitly:
 *
 *   - Phaser 4's `TweenManager` reads `Date.now()` for its own clock rather than
 *     the frame delta, so {@link HeadlessMatch} installs a virtual `Date.now`
 *     advanced by exactly one step's delta. Without that, tweens would move on
 *     wall-clock time and a match would replay differently every run.
 *   - The `TimeStep` loop starts itself and would feed real `requestAnimationFrame`
 *     timestamps into the scene. {@link HeadlessMatch} puts it to sleep on boot;
 *     every frame from then on is one this module asked for.
 */

/** Frame delta a headless step uses unless the caller says otherwise. */
export const HEADLESS_FRAME_MS = 16;

/**
 * Where the virtual clock starts.
 *
 * Arbitrary but large: Phaser compares timestamps for equality in places where a
 * zero start makes "no time has passed yet" ambiguous.
 */
const VIRTUAL_EPOCH_MS = 1_000_000;

/** Give up on booting rather than hang a CI run. */
const BOOT_TIMEOUT_MS = 30_000;

/**
 * Everything a headless match needs the host environment to stop doing.
 *
 * Two things, both installed before the `Game` is constructed and both restored
 * on `destroy`.
 *
 * **The wall clock.** Phaser 4's `TweenManager` derives its own delta from
 * `Date.now()` rather than from the frame delta the engine hands it (`getDelta`:
 * `elapsed = Date.now() - prevTime`). That is fine in a browser and fatal here:
 * an unbounded wall clock means a match replayed twice advances tweens by
 * different amounts and settles in a different order. So `Date.now` is replaced
 * by a counter advanced by exactly one step's delta. Everything else in the
 * engine — the frame delta, the scene clock, timers — already follows the step,
 * so this only has to cover the one place Phaser went behind the frame delta's
 * back.
 *
 * **The frame loop.** `Game.start()` starts a `TimeStep` on
 * `requestAnimationFrame`. Under `Phaser.HEADLESS` that loop drives
 * `Game.headlessStep` — the same entry point this class calls — with the host's
 * real timestamps. A single stray callback rewinds the tween manager's
 * `prevTime` and the next explicit step is a frame short, which is a maddening
 * thing to chase. `game.loop.sleep()` is not enough on its own: the queue is
 * re-armed by `wake()`, which the visibility handler calls. Blacking the
 * callbacks out removes the possibility.
 *
 * The clock has to be in place *before* the `Scene` is constructed, not just
 * before the `Game`. Constructing a `Scene` builds its `TweenManager`, which
 * captures its start time at that moment; a start time read from the real epoch
 * swallows the first frame's delta as a large negative lag and then settles, so
 * every tween is silently one frame behind.
 */
class HeadlessEnvironment {
	private current: number;

	private readonly realDateNow = Date.now;
	private readonly realRequestAnimationFrame: typeof requestAnimationFrame | undefined;
	private readonly realCancelAnimationFrame: typeof cancelAnimationFrame | undefined;

	constructor() {
		this.current = VIRTUAL_EPOCH_MS;
		Date.now = () => this.current;

		const host = globalThis as unknown as {
			requestAnimationFrame?: typeof requestAnimationFrame;
			cancelAnimationFrame?: typeof cancelAnimationFrame;
		};
		this.realRequestAnimationFrame = host.requestAnimationFrame;
		this.realCancelAnimationFrame = host.cancelAnimationFrame;
		host.requestAnimationFrame = () => 0;
		host.cancelAnimationFrame = () => undefined;
	}

	/** Move the clock, and return the new value. */
	advance(deltaMs: number): number {
		this.current += deltaMs;
		return this.current;
	}

	/** Milliseconds since this environment was installed. */
	elapsed(): number {
		return this.current - VIRTUAL_EPOCH_MS;
	}

	/** Put the host back the way it was. */
	restore(): void {
		Date.now = this.realDateNow;
		const host = globalThis as unknown as {
			requestAnimationFrame?: typeof requestAnimationFrame;
			cancelAnimationFrame?: typeof cancelAnimationFrame;
		};
		if (this.realRequestAnimationFrame) {
			host.requestAnimationFrame = this.realRequestAnimationFrame;
		} else {
			delete host.requestAnimationFrame;
		}
		if (this.realCancelAnimationFrame) {
			host.cancelAnimationFrame = this.realCancelAnimationFrame;
		} else {
			delete host.cancelAnimationFrame;
		}
	}
}

/**
 * Hand-driven frame control for a `Phaser.Game` this module did not boot.
 *
 * {@link bootHeadlessMatch} builds its own `GameScene`, so it cannot help a
 * caller that already has an engine — the authoritative server, which boots
 * through `Game.createPhaser()` so that the browser and the server share one
 * code path. That caller still needs the same two guarantees: the wall clock is
 * virtual, and the engine's own `requestAnimationFrame` loop is out of the way.
 *
 * Install this *before* constructing the scene. The `TweenManager` reads the
 * clock the moment a `Scene` is built, so a driver installed afterwards leaves
 * every tween keyed to a start time the virtual clock has already passed.
 */
export interface HeadlessDriver {
	/** Hand over the game to drive, once it has been constructed. */
	attach(game: Phaser.Game): void;
	/** Advance one frame and move the virtual clock by the same delta. */
	step(deltaMs?: number): void;
	/** Advance exactly `count` frames. */
	stepFrames(count: number, deltaMs?: number): void;
	/** Virtual milliseconds since the driver was installed. */
	elapsed(): number;
	/** Put the wall clock and frame callbacks back. */
	restore(): void;
}

/**
 * Take over the host environment for a game that is about to be built.
 *
 * Separate from {@link bootHeadlessMatch} because that helper constructs the
 * scene itself, whereas the authoritative server boots through
 * `Game.createPhaser()` so the browser and the server share one code path. That
 * caller needs the same two guarantees — a virtual wall clock, and the engine's
 * own `requestAnimationFrame` loop out of the way — wrapped around a `Game`
 * that does not exist yet.
 *
 * So: call this first, {@link HeadlessDriver.attach} the game once it is built,
 * then {@link HeadlessDriver.step} it. Attaching after the scene is built is
 * fine; *installing* after it is not. The `TweenManager` samples the clock the
 * moment a `Scene` is constructed, so a virtual clock that starts afterwards
 * leaves every tween keyed to a start time it has already passed.
 */
export function createHeadlessDriver(): HeadlessDriver {
	const env = new HeadlessEnvironment();
	let game: Phaser.Game | null = null;
	return {
		attach(phaser: Phaser.Game): void {
			game = phaser;
		},
		step(deltaMs: number = HEADLESS_FRAME_MS): void {
			game?.headlessStep(env.advance(deltaMs) - VIRTUAL_EPOCH_MS, deltaMs);
		},
		stepFrames(count: number, deltaMs: number = HEADLESS_FRAME_MS): void {
			for (let i = 0; i < count; i++) {
				game?.headlessStep(env.advance(deltaMs) - VIRTUAL_EPOCH_MS, deltaMs);
			}
		},
		elapsed(): number {
			return env.elapsed();
		},
		restore(): void {
			env.restore();
		},
	};
}

export interface SettleOptions {
	/**
	 * Keep stepping while this returns `false`.
	 *
	 * Defaults to "nothing is running": no queued tweens, no pending timers, and
	 * no callbacks waiting on a microtask.
	 */
	isIdle?(): boolean;
	/** Stop after this many frames. Defaults to 10 000 (about 160 seconds of game time). */
	maxFrames?: number;
	/** Stop after this much virtual time, in ms. Defaults to 600 000. */
	maxVirtualMs?: number;
}

export interface HeadlessMatchOptions {
	/** Frame delta for every step. Defaults to {@link HEADLESS_FRAME_MS}. */
	frameMs?: number;
	/**
	 * Scene lifecycle callbacks to observe.
	 *
	 * Partial on purpose: a caller interested only in frame updates should not
	 * have to stub `onSceneReady`.
	 */
	host?: Partial<GameSceneHost>;
}

/**
 * A booted, hand-stepped Phaser game.
 *
 * Deliberately not the `Game` itself: the safety here is that there is exactly
 * one way to advance time, and handing out the raw `Phaser.Game` would put a
 * second one back on the table.
 */
export class HeadlessMatch {
	readonly game: Phaser.Game;
	readonly scene: GameScene;

	private readonly frameMs: number;
	private readonly env: HeadlessEnvironment;
	private destroyed = false;

	constructor(game: Phaser.Game, scene: GameScene, frameMs: number, env: HeadlessEnvironment) {
		this.game = game;
		this.scene = scene;
		this.frameMs = frameMs;
		this.env = env;
	}

	/** Virtual milliseconds since this match booted. */
	get now(): number {
		return this.env.elapsed();
	}

	/** Frames stepped so far. */
	frames = 0;

	/** Whether {@link destroy} has run. */
	get isDestroyed(): boolean {
		return this.destroyed;
	}

	/**
	 * Advance exactly `count` frames.
	 *
	 * `time` is a timestamp relative to the match's epoch rather than an
	 * absolute one, matching what Phaser's own `headlessStep` receives from
	 * `requestAnimationFrame`.
	 */
	stepFrames(count: number, deltaMs: number = this.frameMs): void {
		for (let i = 0; i < count; i++) {
			this.step(deltaMs);
		}
	}

	/** Advance one frame. */
	step(deltaMs: number = this.frameMs): void {
		if (this.destroyed) {
			return;
		}
		// Phaser's TweenManager samples `Date.now()` rather than the delta, so the
		// virtual clock has to move by the same amount the frame claims.
		this.game.headlessStep(this.env.advance(deltaMs) - VIRTUAL_EPOCH_MS, deltaMs);
		this.frames++;
	}

	/**
	 * Step frames, yielding to the real event loop between them, until idle.
	 *
	 * The yield matters: gameplay still schedules work through real promises
	 * (texture decodes, `await` in ability chains), and a loop that never returns
	 * to the event loop would starve all of it.
	 *
	 * Resolves `true` when the match went idle, `false` when a budget ran out.
	 * A caller that gets `false` is looking at a match that never settles —
	 * usually a tween whose completion was never reached — and should say so
	 * rather than treat the state as final.
	 */
	async settle(options: SettleOptions = {}): Promise<boolean> {
		const isIdle = options.isIdle ?? (() => this.isIdle());
		const maxFrames = options.maxFrames ?? 10_000;
		const maxVirtualMs = options.maxVirtualMs ?? 600_000;

		for (let frame = 0; frame < maxFrames; frame++) {
			this.step();
			// Two turns: the first drains callbacks queued by the step, the second
			// callbacks queued by those. Anything deeper is a microtask chain
			// gameplay should not be building.
			await Promise.resolve();
			await Promise.resolve();

			if (isIdle()) {
				return true;
			}
			if (this.now >= maxVirtualMs) {
				return false;
			}
		}

		return false;
	}

	/**
	 * Whether the scene has nothing left to run.
	 *
	 * "Nothing" is the engine's own queues, not AB's: a queued animation AB
	 * intends to start is its business, and would otherwise read as busy forever.
	 *
	 * The `Clock`'s private queues are read rather than its public `getActiveEventCount`,
	 * which is documented but counts only timers that have been inserted, not ones
	 * queued this frame — and an event queued but not yet inserted is exactly the
	 * one that means there is more to do.
	 */
	isIdle(): boolean {
		const scene = this.scene as unknown as {
			tweens?: { getTweens?(): unknown[] };
			time?: {
				_active?: unknown[];
				_pendingInsertion?: unknown[];
				_pendingRemoval?: unknown[];
			};
		};
		const clock = scene.time;
		const tweens = scene.tweens?.getTweens?.().length ?? 0;
		const active = clock?._active?.length ?? 0;
		const pending = clock?._pendingInsertion?.length ?? 0;
		const removing = clock?._pendingRemoval?.length ?? 0;
		return tweens === 0 && active === 0 && pending === 0 && removing === 0;
	}

	/**
	 * Stop the engine and put the wall clock back.
	 *
	 * `noReturn` stays false: Phaser reads it as "this page never runs Phaser
	 * again" and wipes its core-plugin cache, after which no subsequent
	 * `new Phaser.Game()` boots at all.
	 */
	destroy(): void {
		if (this.destroyed) {
			return;
		}
		this.destroyed = true;
		this.env.restore();
		this.game.destroy(false, false);
	}
}

/**
 * Boot a real HEADLESS Phaser game and hand back a hand-stepped handle.
 *
 * Ordering matters throughout: DOM globals first (Phaser touches `window` at
 * import time), then the runtime, then the game. The scene is constructed here
 * rather than passed in so the caller gets the same `GameScene` a browser match
 * gets — a simulation that boots a lookalike scene is the gap this module exists
 * to close.
 */
export async function bootHeadlessMatch(
	options: HeadlessMatchOptions = {},
): Promise<HeadlessMatch> {
	await ensureDomGlobals();
	await loadPhaser();

	const frameMs = options.frameMs ?? HEADLESS_FRAME_MS;

	let sceneReady = false;
	const host: GameSceneHost = {
		onSceneReady: () => {
			sceneReady = true;
			options.host?.onSceneReady?.();
		},
		onSceneUpdate: (time, delta) => options.host?.onSceneUpdate?.(time, delta),
	};

	const env = new HeadlessEnvironment();

	let game: Phaser.Game;
	let scene: GameScene;
	try {
		// Imported here rather than at module scope: `GameScene` subclasses
		// `Phaser.Scene`, so evaluating it requires the runtime, and this module is
		// imported by callers that must stay on the pre-match critical path.
		const { GameScene: SceneClass } = await import('./scenes/GameScene');
		scene = new SceneClass(host);

		const { Game } = getPhaser();
		game = new Game(createGameConfig({ type: getPhaser().HEADLESS, scene: [scene] }));
		await waitForBoot(game, () => sceneReady);
	} catch (error) {
		env.restore();
		throw error;
	}

	const match = new HeadlessMatch(game, scene, frameMs, env);
	// Phaser's `TimeStep` starts its own `requestAnimationFrame` loop, which would
	// feed real timestamps into the scene and make the match replay differently
	// every run. Everything from here is stepped explicitly.
	game.loop.sleep();
	return match;
}

/**
 * Wait for Phaser to finish booting and start the scene.
 *
 * Boot is asynchronous: the `Game` constructor defers to `DOMContentLoaded`, the
 * texture manager waits on its own events before signalling readiness, and only
 * then does the scene's `create()` run. None of that can be pumped by hand,
 * because it is waiting on the real event loop.
 */
async function waitForBoot(game: Phaser.Game, isSceneReady: () => boolean): Promise<void> {
	const start = realNow();
	while (!game.isBooted || !isSceneReady()) {
		if (realNow() - start > BOOT_TIMEOUT_MS) {
			throw new Error('bootHeadlessMatch: Phaser did not finish booting in time');
		}
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
}

/**
 * The wall clock, captured before any match installs a virtual `Date.now`.
 *
 * `Date.now` is not usable for this: it is exactly what a live match replaces,
 * and the boot wait runs before that replacement but must not depend on it
 * outliving the match.
 */
const realNow = () => performance.now();
