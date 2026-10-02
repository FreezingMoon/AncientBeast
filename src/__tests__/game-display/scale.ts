/**
 * Cover for the board's scale rules over Phaser 4's `ScaleManager`.
 *
 * The migration replaced the engine adapter's `pageAlignHorizontally` /
 * `pageAlignVertically` pair with Phaser 4's single `autoCenter`. What matters
 * here is that the two states AB actually uses — "board fills the window" and
 * "narrow phone, board keeps its authored size" — still come out the same, and
 * that the portrait rules deliberately disagree with the default ones.
 */
import { jest, describe, expect, test, beforeEach, afterEach } from '@jest/globals';

jest.mock('phaser', () =>
	(
		jest.requireActual('../../../test/phaser-mock') as typeof import('../../../test/phaser-mock')
	).createPhaserMock(),
);

import { getPhaser, setPhaserNamespace } from '../../phaser/runtime';
import {
	applyBoardScale,
	applyPortraitScale,
	refreshScale,
	viewportTakesFullWindow,
} from '../../game-display/scale';

const { Scale } = getPhaser();

function makeScaleManager() {
	return {
		parentIsWindow: false,
		autoCenter: Scale.NO_CENTER,
		scaleMode: Scale.NONE,
		refreshCount: 0,
		refresh() {
			this.refreshCount++;
		},
	};
}

/** jsdom's window is read directly, so its size has to be set per test. */
function setViewport(width: number, height: number): void {
	Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
	Object.defineProperty(window, 'innerHeight', { value: height, configurable: true });
}

const originalWidth = window.innerWidth;
const originalHeight = window.innerHeight;

describe('viewportTakesFullWindow', () => {
	afterEach(() => {
		setViewport(originalWidth, originalHeight);
	});

	test('a desktop window takes the whole viewport', () => {
		setViewport(1920, 1080);
		expect(viewportTakesFullWindow()).toBe(true);
	});

	test('a tall-but-narrow window still qualifies, since the test is an or', () => {
		setViewport(480, 900);
		expect(viewportTakesFullWindow()).toBe(true);
	});

	test('a small landscape window does not', () => {
		setViewport(560, 640);
		expect(viewportTakesFullWindow()).toBe(false);
	});

	test('the boundaries are exclusive', () => {
		setViewport(600, 700);
		expect(viewportTakesFullWindow()).toBe(false);
		setViewport(601, 700);
		expect(viewportTakesFullWindow()).toBe(true);
	});
});

describe('applyBoardScale', () => {
	beforeEach(() => {
		setViewport(1920, 1080);
	});

	afterEach(() => {
		setViewport(originalWidth, originalHeight);
	});

	test('a normal window gets FIT, centred, parented to the window', () => {
		const scale = makeScaleManager();

		applyBoardScale(scale as never);

		expect(scale.scaleMode).toBe(Scale.FIT);
		expect(scale.autoCenter).toBe(Scale.CENTER_BOTH);
		expect(scale.parentIsWindow).toBe(true);
		expect(scale.refreshCount).toBe(1);
	});

	test('a narrow landscape window is not centred or window-parented', () => {
		setViewport(560, 640);
		const scale = makeScaleManager();

		applyBoardScale(scale as never);

		expect(scale.autoCenter).toBe(Scale.NO_CENTER);
		expect(scale.parentIsWindow).toBe(false);
	});

	test('it re-asserts FIT after a rematch, which reuses the manager', () => {
		const scale = makeScaleManager();
		// Left behind by a portrait match.
		scale.scaleMode = Scale.RESIZE;
		scale.autoCenter = Scale.NO_CENTER;

		applyBoardScale(scale as never);

		expect(scale.scaleMode).toBe(Scale.FIT);
		expect(scale.autoCenter).toBe(Scale.CENTER_BOTH);
	});

	test('a missing manager is a no-op, not a crash', () => {
		expect(() => applyBoardScale(undefined)).not.toThrow();
		expect(() => applyBoardScale(null)).not.toThrow();
	});
});

describe('applyPortraitScale', () => {
	beforeEach(() => {
		setViewport(1920, 1080);
	});

	afterEach(() => {
		setViewport(originalWidth, originalHeight);
	});

	test('landscape matches the default board scale', () => {
		const scale = makeScaleManager();

		applyPortraitScale(scale as never, false);

		expect(scale.parentIsWindow).toBe(true);
		expect(scale.autoCenter).toBe(Scale.CENTER_BOTH);
	});

	test('portrait detaches the canvas from the window and leaves it to the CSS shell', () => {
		const scale = makeScaleManager();

		applyPortraitScale(scale as never, true);

		// The board keeps its authored size; the shell's `portrait-mode` layout
		// places it, so auto-centring would fight the page chrome.
		expect(scale.parentIsWindow).toBe(false);
		expect(scale.autoCenter).toBe(Scale.NO_CENTER);
	});

	test('it deliberately disagrees with applyBoardScale on centring', () => {
		// The whole reason this is a separate function: a narrow landscape
		// viewport is "small" to `applyBoardScale` but not portrait, so the two
		// must not be collapsed into one decision.
		setViewport(560, 640);
		const board = makeScaleManager();
		const portrait = makeScaleManager();

		applyBoardScale(board as never);
		applyPortraitScale(portrait as never, false);

		expect(board.autoCenter).not.toBe(portrait.autoCenter);
	});

	test('it leaves the scale mode alone — portrait sizing is the CSS shell', () => {
		const scale = makeScaleManager();
		scale.scaleMode = Scale.RESIZE;

		applyPortraitScale(scale as never, true);

		expect(scale.scaleMode).toBe(Scale.RESIZE);
	});

	test('a missing manager is a no-op, not a crash', () => {
		expect(() => applyPortraitScale(undefined, true)).not.toThrow();
	});
});

describe('refreshScale', () => {
	test('it runs the layout pass once', () => {
		const scale = makeScaleManager();

		refreshScale(scale as never);

		expect(scale.refreshCount).toBe(1);
	});

	test('a missing manager is tolerated', () => {
		expect(() => refreshScale(undefined)).not.toThrow();
	});
});

describe('scale helpers without a Phaser runtime', () => {
	const mockNamespace = getPhaser();

	afterEach(() => {
		setPhaserNamespace(mockNamespace);
	});

	test('applyBoardScale reports the missing runtime rather than silently fitting', () => {
		setPhaserNamespace(undefined as never);
		expect(() => applyBoardScale(makeScaleManager() as never)).toThrow(/Phaser runtime/);
	});

	test('refreshScale still works — it reads no runtime value', () => {
		setPhaserNamespace(undefined as never);
		const scale = makeScaleManager();
		expect(() => refreshScale(scale as never)).not.toThrow();
		expect(scale.refreshCount).toBe(1);
	});
});
