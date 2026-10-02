import { advanceFrame, resetClock, setClockScene } from '../src/timing/clock';

/**
 * A controllable clock for tests that drive frame-by-frame effect code.
 *
 * Effect code reads time from the AB clock, not the engine, so a test that wants
 * to place a frame at a known instant has to move the AB clock too. Registering a
 * fake scene is what makes `now()` controllable at all — with no scene it falls
 * back to the host clock, which a test cannot pin.
 *
 * The scheduling methods delegate to real host timers. Effects reach the clock
 * both to read the time and to schedule retries, and a test that faked
 * scheduling too would silently stop exercising the retry paths.
 */

let clockNow = 0;

const fakeScene = {
	time: {
		get now() {
			return clockNow;
		},
		addEvent(cfg: { delay: number; loop?: boolean; callback: () => void }) {
			return cfg.loop ? setInterval(cfg.callback, cfg.delay) : setTimeout(cfg.callback, cfg.delay);
		},
		removeEvent(handle: unknown) {
			clearTimeout(handle as ReturnType<typeof setTimeout>);
			clearInterval(handle as ReturnType<typeof setInterval>);
		},
	},
};

/** Install the fake clock. Call from `beforeEach`. */
export function installAbClock(): void {
	clockNow = 0;
	setClockScene(fakeScene as never);
}

/** Remove the fake clock and the last frame delta. Call from `afterEach`. */
export function uninstallAbClock(): void {
	resetClock();
}

/**
 * Rewind the clock to its start without uninstalling it.
 *
 * Needed by a test that builds more than one fixture in the same test: effect
 * state is seeded from the current time, so a second fixture created while the
 * clock is already at 2000ms schedules its first event 2000ms out — and a
 * replay that then walks the clock forward from 0 never reaches it. Each fresh
 * fixture should start at time 0, the way a real match does.
 */
export function resetAbClockTime(): void {
	clockNow = 0;
	advanceFrame(0);
}

/**
 * Place the clock at `nowMs` and record a frame of `deltaMs`.
 *
 * This is the AB-clock counterpart of the old
 * `engine.time.now = x; engine.time.elapsedMS = 16` pair, and replaces both.
 */
export function setAbClockTime(nowMs: number, deltaMs = 16): void {
	clockNow = nowMs;
	advanceFrame(deltaMs);
}
