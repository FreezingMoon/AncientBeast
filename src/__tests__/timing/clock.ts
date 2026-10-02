import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import {
	every,
	after,
	advanceFrame,
	deltaMs,
	now,
	resetClock,
	runTimedAnimation,
	setClockScene,
} from '../../timing/clock';

/**
 * A stand-in for a Phaser scene's clock, driven by hand.
 *
 * The point of these tests is that the module never reads the wall clock when a
 * scene is registered, so the fake only has to do what `scene.time` does: hold a
 * `now` that the test advances, and run registered callbacks on demand.
 */
function createFakeScene() {
	let clockNow = 1_000;
	/** One entry per registered callback, with the virtual time it next fires at. */
	const listeners: {
		id: number;
		dueAt: number;
		intervalMs: number;
		loop: boolean;
		callback: () => void;
	}[] = [];
	let nextId = 1;

	return {
		time: {
			get now() {
				return clockNow;
			},
			addEvent(cfg: { delay: number; loop?: boolean; callback: () => void }) {
				const id = nextId++;
				listeners.push({
					id,
					dueAt: clockNow + cfg.delay,
					intervalMs: cfg.delay,
					loop: cfg.loop ?? false,
					callback: cfg.callback,
				});
				return id;
			},
			removeEvent(id: number) {
				const index = listeners.findIndex((entry) => entry.id === id);
				if (index >= 0) listeners.splice(index, 1);
			},
		},
		/**
		 * Advance the virtual clock, firing each due callback once per elapsed
		 * interval — a looping timer fires `floor(elapsed / delay)` times, the way
		 * Phaser's TimerEvent re-arms against its own clock.
		 */
		advance(ms: number) {
			const target = clockNow + ms;
			for (;;) {
				const due = listeners
					.filter((entry) => entry.dueAt <= target)
					.sort((a, b) => a.dueAt - b.dueAt)[0];
				if (!due) break;
				clockNow = due.dueAt;
				if (due.loop) {
					due.dueAt += due.intervalMs;
				} else {
					listeners.splice(listeners.indexOf(due), 1);
				}
				due.callback();
			}
			clockNow = target;
		},
		get liveTimers() {
			return listeners.length;
		},
	};
}

afterEach(() => {
	resetClock();
	jest.useRealTimers();
});

describe('AB clock, no engine', () => {
	beforeEach(() => {
		resetClock();
	});

	test('falls back to the host clock when no scene is registered', () => {
		// The unit suites and the simulation harness have no scene yet. They must
		// still get a monotonic-enough millisecond value rather than 0.
		expect(now()).toBeGreaterThan(0);
	});

	test('every() schedules repeatedly and stop() is idempotent', () => {
		jest.useFakeTimers();
		const callback = jest.fn();
		const timer = every(16, callback);

		jest.advanceTimersByTime(50);
		expect(callback.mock.calls.length).toBeGreaterThanOrEqual(3);

		timer.stop();
		const callsAtStop = callback.mock.calls.length;
		timer.stop();
		jest.advanceTimersByTime(100);
		expect(callback.mock.calls.length).toBe(callsAtStop);
	});

	test('after() fires once', () => {
		jest.useFakeTimers();
		const callback = jest.fn();
		after(20, callback);

		jest.advanceTimersByTime(19);
		expect(callback).not.toHaveBeenCalled();
		jest.advanceTimersByTime(2);
		expect(callback).toHaveBeenCalledTimes(1);
	});
});

describe('AB clock, scene registered', () => {
	test('now() reports the scene clock, not the wall clock', () => {
		const scene = createFakeScene();
		setClockScene(scene as never);

		const before = now();
		scene.advance(500);
		expect(now() - before).toBe(500);
	});

	test('every() becomes a scene timer, so virtual time drives it', () => {
		const scene = createFakeScene();
		setClockScene(scene as never);
		const callback = jest.fn();

		const timer = every(16, callback);
		expect(callback).not.toHaveBeenCalled();

		scene.advance(48);
		expect(callback).toHaveBeenCalledTimes(3);

		timer.stop();
		scene.advance(48);
		expect(callback).toHaveBeenCalledTimes(3);
		expect(scene.liveTimers).toBe(0);
	});
});

describe('frame delta', () => {
	test('is 0 before the first frame, so nothing is invented', () => {
		// There is no previous frame yet. Handing a smoothing term a spike on its
		// first tick would kick every frame-rate-dependent effect in the game.
		expect(deltaMs()).toBe(0);
	});

	test('reports the delta since the previous frame, not cumulative time', () => {
		advanceFrame(16);
		expect(deltaMs()).toBe(16);
		advanceFrame(16);
		expect(deltaMs()).toBe(16);
		// A long frame is reported as-is. Consumers clamp it themselves; clamping
		// here would make the clamp invisible and untestable.
		advanceFrame(250);
		expect(deltaMs()).toBe(250);
	});

	test('is cleared on teardown', () => {
		advanceFrame(16);
		resetClock();
		expect(deltaMs()).toBe(0);
	});
});

describe('runTimedAnimation', () => {
	test('draws the first frame immediately at progress 0', () => {
		// A loop that waited a full frame before its first draw would flash its
		// start state — a one-frame beam at full brightness before the real reveal.
		const frames: number[] = [];
		const handle = runTimedAnimation({
			durationMs: 1000,
			onFrame: (_elapsed, progress) => frames.push(progress),
		});

		expect(frames).toEqual([0]);
		handle.cancel();
	});

	test('progress is derived from elapsed time and clamped to 1', () => {
		const scene = createFakeScene();
		setClockScene(scene as never);
		const frames: number[] = [];

		runTimedAnimation({
			durationMs: 1000,
			onFrame: (elapsed, progress) => {
				frames.push(progress);
				// Monotonic, and never negative: the loop reads one clock, so a
				// frame can never report less time than the one before it.
				expect(elapsed).toBeGreaterThanOrEqual(0);
			},
			onDone: () => {},
		});

		// Half the duration in, the last frame is just short of half way — frames
		// land on the 16ms cadence, not on the exact midpoint.
		scene.advance(500);
		expect(frames.at(-1)).toBeGreaterThan(0.45);
		expect(frames.at(-1)).toBeLessThanOrEqual(0.5);
		expect(frames.every((p, i) => i === 0 || p >= frames[i - 1])).toBe(true);

		scene.advance(10_000);
		// Clamped: the last frame is 1, never past it, and the loop stopped.
		expect(frames.at(-1)).toBe(1);
		expect(frames.every((p) => p <= 1)).toBe(true);
		expect(scene.liveTimers).toBe(0);
	});

	test('onDone runs exactly once, on the frame that reaches 1', () => {
		const scene = createFakeScene();
		setClockScene(scene as never);
		const onDone = jest.fn();

		runTimedAnimation({ durationMs: 100, onFrame: () => {}, onDone });

		scene.advance(50);
		expect(onDone).not.toHaveBeenCalled();
		scene.advance(10_000);
		expect(onDone).toHaveBeenCalledTimes(1);
		// Stopped: the timer was removed, so nothing is left running.
		expect(scene.liveTimers).toBe(0);
	});

	test('cancel() stops the loop without running onDone', () => {
		const scene = createFakeScene();
		setClockScene(scene as never);
		const onDone = jest.fn();
		const onFrame = jest.fn();

		const handle = runTimedAnimation({ durationMs: 1000, onFrame, onDone });
		handle.cancel();
		scene.advance(10_000);

		expect(onDone).not.toHaveBeenCalled();
		expect(onFrame).toHaveBeenCalledTimes(1);
		expect(scene.liveTimers).toBe(0);
	});

	test('a zero duration completes on the first frame and starts no timer', () => {
		const scene = createFakeScene();
		setClockScene(scene as never);
		const onDone = jest.fn();

		runTimedAnimation({ durationMs: 0, onFrame: () => {}, onDone });

		expect(onDone).toHaveBeenCalledTimes(1);
		// Nothing was registered, so a failure settled inside the first frame
		// cannot leave a live timer redrawing over a destroyed sprite.
		expect(scene.liveTimers).toBe(0);
	});

	test('a frame that throws stops the loop and leaves no timer behind', () => {
		// The wall-print effect does this: any error in its draw calls finish(),
		// which settles the animation from inside the very first frame — before
		// runTimedAnimation has returned a handle the caller could cancel. If the
		// interval were registered before that frame, a repeating timer would keep
		// redrawing the beam over an already-destroyed wall.
		const scene = createFakeScene();
		setClockScene(scene as never);
		const onFrame = jest.fn(() => {
			throw new Error('sprite torn down');
		});

		expect(() => runTimedAnimation({ durationMs: 1000, onFrame })).toThrow('sprite torn down');

		expect(scene.liveTimers).toBe(0);

		// And it stays stopped: no timer, so no further frames.
		scene.advance(10_000);
		expect(onFrame).toHaveBeenCalledTimes(1);
	});

	test('errors from onFrame are rethrown, not swallowed', () => {
		// The clock does not decide what an exception means. The wall-print effect
		// reports and settles its own failures inside its draw; silently swallowing
		// here would turn a broken effect into an animation that quietly never
		// finishes.
		const scene = createFakeScene();
		setClockScene(scene as never);

		expect(() =>
			runTimedAnimation({
				durationMs: 1000,
				onFrame: () => {
					throw new Error('sprite torn down');
				},
			}),
		).toThrow('sprite torn down');
	});
});
