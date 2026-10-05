/**
 * @jest-environment <rootDir>/test/jsdom-environment.js
 * @jest-environment-options {"resources": "usable"}
 */

/**
 * Integration coverage for the real HEADLESS engine.
 *
 * These suites boot an actual `Phaser.HEADLESS` game — the same `GameScene` a
 * browser match gets — and are the regression cover for the assumptions
 * `src/phaser/headless.ts` makes about the engine:
 *
 *   - Phaser 4's `TweenManager` reads `Date.now()`, not the frame delta, so a
 *     virtual clock has to stand in or tweens move on wall-clock time;
 *   - that clock must be installed *before* the `Scene` is constructed, because
 *     the manager captures its start time there and a real-epoch start freezes
 *     every tween at progress 0;
 *   - `TimeStep` starts its own `requestAnimationFrame` loop, which has to be
 *     put to sleep or real timestamps leak into the scene.
 *
 * Two things differ from the rest of the suite, both scoped to this file rather
 * than to a second Jest project, so these tests run as part of plain `npm test`:
 *
 *   - **The real engine.** `test/phaser-runtime-setup.js` installs a mock via
 *     `setPhaserNamespace()`, which deliberately shares `loadPhaser()`'s memo
 *     slot. `beforeAll` below drops it and pulls the genuine bundle, so booting
 *     here displaces the mock rather than fighting it.
 *   - **`resources: 'usable'`.** Phaser 4's `TextureManager` blocks its own boot
 *     on decoding two base64 PNGs, and jsdom only fires an image's `load` when it
 *     is allowed to resolve `src`. Without it the game reports `isBooted` and then
 *     sits forever with no scene. Jest builds a fresh environment per test file
 *     and reads this from the docblock above, so only this file pays for it.
 */
import { afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals';
import { bootHeadlessMatch, HEADLESS_FRAME_MS, type HeadlessMatch } from '../../phaser/headless';
import { loadRealPhaser } from '../../phaser/runtime';
import { Phaser4Engine } from '../../engine/Phaser4Engine';

/** Whether a sprite is part-way along a 0 -> 100 tween. */
function isPartWay(sp: { x: number }): boolean {
	return sp.x > 0 && sp.x < 100;
}

/** Phaser's base64 defaults must finish decoding before a scene can start. */
const BOOT_TIMEOUT = 60_000;

// A real Phaser boot decodes textures and allocates a scene; the 5s default is
// tight on a cold cache.
jest.setTimeout(BOOT_TIMEOUT + 30_000);

beforeAll(async () => {
	await loadRealPhaser();
});

let live: HeadlessMatch | null = null;

async function boot(options: Parameters<typeof bootHeadlessMatch>[0] = {}): Promise<HeadlessMatch> {
	const match = await bootHeadlessMatch(options);
	live = match;
	return match;
}

afterEach(() => {
	live?.destroy();
	live = null;
});

describe('booting a real HEADLESS match', () => {
	test(
		'the game boots, runs, and builds the world root',
		async () => {
			const match = await boot();

			expect(match.game.isBooted).toBe(true);
			expect(match.game.isRunning).toBe(true);
			// HEADLESS means no renderer at all, which is what makes a commit on a
			// canvas surface a no-op rather than a throw.
			expect(match.game.renderer).toBeNull();
			expect(match.scene.world.type).toBe('Container');
			expect(match.scene.world.name).toBe('world');
		},
		BOOT_TIMEOUT,
	);

	test(
		'the scene host is told when the scene is ready and on every update',
		async () => {
			const onSceneReady = jest.fn();
			const onSceneUpdate = jest.fn();
			const match = await boot({ host: { onSceneReady, onSceneUpdate } });

			expect(onSceneReady).toHaveBeenCalledTimes(1);
			expect(onSceneUpdate).not.toHaveBeenCalled();

			match.stepFrames(3);

			expect(onSceneUpdate).toHaveBeenCalledTimes(3);
			expect(onSceneUpdate).toHaveBeenLastCalledWith(3 * HEADLESS_FRAME_MS, HEADLESS_FRAME_MS);
		},
		BOOT_TIMEOUT,
	);

	test(
		'the engine loop is asleep, so nothing advances without being asked',
		async () => {
			const match = await boot();
			match.stepFrames(2);
			const frames = match.frames;
			const now = match.now;

			// Real time passing must not move the match: the `requestAnimationFrame`
			// loop Phaser starts for itself is stopped, so only `stepFrames` does.
			await new Promise((resolve) => setTimeout(resolve, 250));

			expect(match.frames).toBe(frames);
			expect(match.now).toBe(now);
		},
		BOOT_TIMEOUT,
	);
});

describe('headless time is virtual, not wall-clock', () => {
	test(
		'a tween runs on the virtual clock and finishes exactly on time',
		async () => {
			const match = await boot();
			const sprite = match.scene.add.sprite(0, 0, '__DEFAULT');
			let completed = false;
			match.scene.tweens.add({
				targets: sprite,
				x: 100,
				duration: 100,
				onComplete: () => {
					completed = true;
				},
			});

			// Phaser discards a tween's first frame's delta ("reset the delta so we
			// always start progress from zero"), so a 100ms tween needs eight 16ms
			// frames to land, not seven. Asserted explicitly: an off-by-one-frame here
			// would otherwise look like clock drift, and cost real debugging time.
			match.stepFrames(6);
			expect(sprite.x).toBe(80);
			expect(completed).toBe(false);

			match.stepFrames(1);
			expect(sprite.x).toBe(96);
			expect(completed).toBe(false);

			match.stepFrames(1);
			expect(completed).toBe(true);
			expect(sprite.x).toBe(100);
		},
		BOOT_TIMEOUT,
	);

	test(
		'a scene timer fires on the same clock as the tweens',
		async () => {
			const match = await boot();
			let fired = false;
			match.scene.time.delayedCall(200, () => {
				fired = true;
			});

			match.stepFrames(10); // 160ms
			expect(fired).toBe(false);

			match.stepFrames(5); // 240ms
			expect(fired).toBe(true);
		},
		BOOT_TIMEOUT,
	);

	test(
		'two identical tweens driven by the same frames land on the same value',
		async () => {
			const match = await boot();
			const a = match.scene.add.sprite(0, 0, '__DEFAULT');
			const b = match.scene.add.sprite(0, 0, '__DEFAULT');
			for (const target of [a, b]) {
				match.scene.tweens.add({
					targets: target,
					x: 250,
					duration: 500,
					ease: 'Quad.easeInOut',
				});
			}

			match.stepFrames(7);
			const [at7a, at7b] = [a.x, b.x];
			match.stepFrames(4);

			// Two tweens created together and driven by the same frames must be at the
			// same point on the same schedule — this is the property that makes a
			// simulated match comparable to the last one.
			expect(at7a).toBe(at7b);
			expect(a.x).toBe(b.x);
			expect(a.x).toBeGreaterThan(at7a);

			match.stepFrames(60);
			expect(a.x).toBe(b.x);
			expect(a.x).toBe(250);
		},
		BOOT_TIMEOUT,
	);

	test(
		'the wall clock is put back when the match is destroyed',
		async () => {
			// Captured before the match, because during a match `Date.now` is the
			// virtual clock and would compare equal to itself.
			const realBefore = Date.now();
			const match = await boot();
			expect(Date.now()).not.toBe(realBefore);

			match.destroy();
			expect(match.isDestroyed).toBe(true);
			// Close enough to the real clock to prove it was restored, without
			// asserting on a value that legitimately changes between lines.
			expect(Math.abs(Date.now() - realBefore)).toBeLessThan(5_000);

			// `destroy` is idempotent, so a caller's teardown path does not have to
			// know whether something else already released the match.
			expect(() => match.destroy()).not.toThrow();
		},
		BOOT_TIMEOUT,
	);

	test(
		'stepping a destroyed match is a no-op',
		async () => {
			const match = await boot();
			match.stepFrames(2);
			match.destroy();
			const frames = match.frames;

			match.stepFrames(5);

			expect(match.frames).toBe(frames);
		},
		BOOT_TIMEOUT,
	);
});

describe('settle', () => {
	test(
		'it stops as soon as the scene is idle',
		async () => {
			const match = await boot();
			const sprite = match.scene.add.sprite(0, 0, '__DEFAULT');
			let completed = false;
			match.scene.tweens.add({
				targets: sprite,
				alpha: 0,
				duration: 200,
				onComplete: () => {
					completed = true;
				},
			});

			expect(match.isIdle()).toBe(false);
			const settled = await match.settle({ maxFrames: 200 });

			expect(settled).toBe(true);
			expect(completed).toBe(true);
			expect(match.isIdle()).toBe(true);
			// 200ms of tween at 16ms a frame is 13 frames; settling must not run to
			// the budget to notice that.
			expect(match.frames).toBeLessThan(30);
		},
		BOOT_TIMEOUT,
	);

	test(
		'an idle match settles immediately',
		async () => {
			const match = await boot();

			expect(match.isIdle()).toBe(true);
			expect(await match.settle()).toBe(true);
			expect(match.frames).toBe(1);
		},
		BOOT_TIMEOUT,
	);

	test(
		'a caller can define its own idea of idle',
		async () => {
			const match = await boot();
			const sprite = match.scene.add.sprite(0, 0, '__DEFAULT');
			match.scene.tweens.add({ targets: sprite, x: 100, duration: 500 });

			// The engine has a lot left to do, but the caller is satisfied as soon as
			// its own sprite has arrived.
			const settled = await match.settle({
				isIdle: () => sprite.x >= 100,
				maxFrames: 200,
			});

			expect(settled).toBe(true);
			expect(sprite.x).toBe(100);
		},
		BOOT_TIMEOUT,
	);

	test(
		'it reports failure rather than pretending a stuck match settled',
		async () => {
			const match = await boot();
			// A tween that can never complete: nothing will remove it from the queue,
			// so settling must give up and say so instead of returning a state the
			// caller would trust.
			match.scene.tweens.add({
				targets: match.scene.add.sprite(0, 0, '__DEFAULT'),
				x: 100,
				duration: 100_000,
			});

			const settled = await match.settle({ maxFrames: 20 });

			expect(settled).toBe(false);
			expect(match.frames).toBe(20);
		},
		BOOT_TIMEOUT,
	);

	test(
		'a virtual-time budget also stops the pump',
		async () => {
			const match = await boot();
			match.scene.tweens.add({
				targets: match.scene.add.sprite(0, 0, '__DEFAULT'),
				x: 100,
				duration: 100_000,
			});

			const settled = await match.settle({ maxFrames: 10_000, maxVirtualMs: 320 });

			expect(settled).toBe(false);
			expect(match.now).toBeGreaterThanOrEqual(320);
			expect(match.frames).toBeLessThan(1_000);
		},
		BOOT_TIMEOUT,
	);
});

describe('tween isRunning tracks the real chain state', () => {
	/**
	 * The adapter's `isRunning` is what the bounce and cleanup guards read to avoid
	 * restarting work that is already running. `src/__tests__/creature.ts` pins that
	 * guard logic against a *mock* tween, which means the guard could pass while the
	 * real adapter underneath reported `undefined` and never fired. These cover the
	 * adapter itself, against a real `Phaser.Tweens.TweenChain`.
	 */
	test(
		'a tween reads as not running before start, running while playing, and not running once stopped',
		async () => {
			const match = await boot();
			const engine = new Phaser4Engine(match.game, match.scene);
			const sprite = match.scene.add.sprite(0, 0, '__DEFAULT');
			const tween = engine.tween(sprite).to({ x: 100 }, 200);

			// Built but never started: there is a chain to come, nothing running yet.
			expect(tween.isRunning).toBe(false);

			tween.start();
			match.stepFrames(2);
			expect(isPartWay(sprite)).toBe(true);
			expect(tween.isRunning).toBe(true);

			tween.stop();
			expect(tween.isRunning).toBe(false);
		},
		BOOT_TIMEOUT,
	);

	test(
		'an auto-starting tween is running without a separate start()',
		async () => {
			const match = await boot();
			const engine = new Phaser4Engine(match.game, match.scene);
			const sprite = match.scene.add.sprite(0, 0, '__DEFAULT');

			engine.tween(sprite).to({ x: 100 }, 200, undefined, true);
			match.stepFrames(2);

			expect(isPartWay(sprite)).toBe(true);
		},
		BOOT_TIMEOUT,
	);

	test(
		'the infinite yoyo bounce stays running for as long as it is left alone',
		async () => {
			const match = await boot();
			const engine = new Phaser4Engine(match.game, match.scene);
			const bounceSrc = { offset: 0 };

			// The exact shape `CreatureSprite.setHealthBounce` builds: auto-starting,
			// yoyo, infinite repeat. `yoyo()` and `repeat()` each rebuild the chain,
			// so this is also the case where a lost `play()` on the rebuilt chain
			// would surface as "not running".
			const bounce = engine
				.tween(bounceSrc)
				.to({ offset: -10 }, 350, undefined, true)
				.yoyo(true)
				.repeat(-1);

			match.stepFrames(4);
			expect(bounce.isRunning).toBe(true);

			// Well past one 350ms cycle, so the yoyo has wrapped at least once.
			match.stepFrames(60);
			expect(bounce.isRunning).toBe(true);
		},
		BOOT_TIMEOUT,
	);

	test(
		'onUpdateCallback fires every frame, not just on the chain that was current at registration',
		async () => {
			const match = await boot();
			const engine = new Phaser4Engine(match.game, match.scene);
			const src = { alpha: 0 };
			let frames = 0;
			let lastSeen = 0;

			const tween = engine.tween(src).to({ alpha: 1 }, 200, undefined, true);
			// Registered after the chain exists, and again after a rebuild, because
			// Phaser 4 rebuilds the chain on `yoyo`/`repeat` and anything bound to
			// the previous one would silently stop being called.
			tween.onUpdateCallback(() => {
				frames += 1;
				lastSeen = src.alpha;
			});

			match.stepFrames(3);
			const afterFirst = frames;
			expect(afterFirst).toBeGreaterThan(0);
			expect(lastSeen).toBeGreaterThan(0);
			expect(lastSeen).toBeLessThan(1);

			tween.yoyo(true).repeat(-1);
			const afterRebuild = frames;
			match.stepFrames(3);

			expect(frames).toBeGreaterThan(afterRebuild);
			expect(afterRebuild).toBe(afterFirst);
		},
		BOOT_TIMEOUT,
	);

	test(
		'a finite tween stops reading as running once it has finished',
		async () => {
			const match = await boot();
			const engine = new Phaser4Engine(match.game, match.scene);
			const sprite = match.scene.add.sprite(0, 0, '__DEFAULT');
			const tween = engine.tween(sprite).to({ x: 100 }, 100).start();

			match.stepFrames(1);
			expect(tween.isRunning).toBe(true);

			await match.settle();

			expect(sprite.x).toBe(100);
			expect(tween.isRunning).toBe(false);
		},
		BOOT_TIMEOUT,
	);
});
