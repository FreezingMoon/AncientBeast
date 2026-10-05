import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import {
	clearHoveredHex,
	getHoveredHex,
	isCanvasGesture,
	isInputAccepted,
	isPointerWithinBoard,
	onPointerDown,
	onPointerOut,
	onPointerOver,
	onPointerUp,
	rejectIfTurnFrozen,
	resetHoveredHexForTest,
	setHoveredHex,
	trackPointerWithinBoard,
} from '../../input/input';

/** A stand-in for a Phaser 4 game object, recording what was subscribed. */
function createGameObjectMock() {
	const handlers = new Map<string, ((...args: any[]) => void)[]>();
	return {
		handlers,
		input: { cursor: 'default' } as Record<string, unknown> | null,
		on(event: string, handler: (...args: any[]) => void) {
			const list = handlers.get(event) ?? [];
			list.push(handler);
			handlers.set(event, list);
			return this;
		},
		emit(event: string, ...args: unknown[]) {
			for (const handler of handlers.get(event) ?? []) handler(...args);
		},
	};
}

const canvasPointer = (button: number) => ({ button, downElement: { tagName: 'CANVAS' } });
const overlayPointer = (button: number) => ({ button, downElement: { tagName: 'DIV' } });

describe('isCanvasGesture', () => {
	test('accepts a primary-button gesture regardless of origin', () => {
		// A left-click on an overlay is already consumed by the overlay, and the
		// default button is how touch arrives, so the origin is not consulted.
		expect(isCanvasGesture({ button: 0, downElement: { tagName: 'DIV' } })).toBe(true);
		expect(isCanvasGesture({ button: 0 })).toBe(true);
	});

	test('accepts a secondary-button gesture that began on the canvas', () => {
		expect(isCanvasGesture(canvasPointer(2))).toBe(true);
		expect(isCanvasGesture(canvasPointer(1))).toBe(true);
	});

	test('rejects a secondary-button gesture that began on a DOM overlay', () => {
		// This is the case that would otherwise open a creature card from a
		// right-click on the scoreboard: Phaser listens on the window, so the
		// mouseup is hit-tested against canvas coordinates even though the mousedown
		// happened on the overlay.
		expect(isCanvasGesture(overlayPointer(2))).toBe(false);
		expect(isCanvasGesture(overlayPointer(1))).toBe(false);
	});

	test('rejects a secondary-button gesture with no recorded down element', () => {
		// No downElement at all is the same shape of problem as a non-canvas one.
		expect(isCanvasGesture({ button: 2 })).toBe(false);
		expect(isCanvasGesture({ button: 2, downElement: null })).toBe(false);
	});

	test('rejects nothing rather than throwing on a missing pointer', () => {
		expect(isCanvasGesture(null)).toBe(false);
		expect(isCanvasGesture(undefined)).toBe(false);
	});
});

describe('pointer subscriptions', () => {
	test('each helper subscribes to its own Phaser event', () => {
		const go = createGameObjectMock();
		onPointerDown(go, () => {});
		onPointerUp(go, () => {});
		onPointerOver(go, () => {});
		onPointerOut(go, () => {});

		expect([...go.handlers.keys()].sort()).toEqual([
			'pointerdown',
			'pointerout',
			'pointerover',
			'pointerup',
		]);
	});

	test('handlers receive Phaser 4 pointer arguments, not the adapter reorder', () => {
		const go = createGameObjectMock();
		const handler = jest.fn();
		onPointerUp(go, handler);

		const pointer = canvasPointer(0);
		go.emit('pointerup', pointer, 10, 20);

		// The first argument is the pointer itself. The adapter used to insert the
		// sprite ahead of it, and every migrated handler was updated to match.
		expect(handler).toHaveBeenCalledWith(pointer, 10, 20);
	});

	test('an overlay-originated right-click never reaches the handler', () => {
		const go = createGameObjectMock();
		const handler = jest.fn();
		onPointerUp(go, handler);

		go.emit('pointerup', overlayPointer(2), 0, 0);
		expect(handler).not.toHaveBeenCalled();

		// The same gesture on the canvas does reach it.
		go.emit('pointerup', canvasPointer(2), 0, 0);
		expect(handler).toHaveBeenCalledTimes(1);
	});

	test('a non-interactive object is ignored rather than throwing', () => {
		// The headless engine and the unit fixtures have no real game objects.
		expect(() => onPointerUp(null, () => {})).not.toThrow();
		expect(() => onPointerOver(undefined, () => {})).not.toThrow();
	});
});

describe('pointer within the board', () => {
	let unsubscribe: () => void = () => {};

	beforeEach(() => {
		unsubscribe = () => {};
	});

	afterEach(() => {
		unsubscribe();
	});

	function createSceneInputMock() {
		const handlers = new Map<string, ((...args: any[]) => void)[]>();
		return {
			on(event: string, handler: (...args: any[]) => void) {
				const list = handlers.get(event) ?? [];
				list.push(handler);
				handlers.set(event, list);
				return this;
			},
			off(event: string, handler: (...args: any[]) => void) {
				handlers.set(
					event,
					(handlers.get(event) ?? []).filter((h) => h !== handler),
				);
			},
			emit(event: string) {
				for (const handler of [...(handlers.get(event) ?? [])]) handler();
			},
		};
	}

	test('defaults to inside the board', () => {
		// Hex hover-out branches on this, so a match that never receives a
		// boundary event has to behave as if the pointer were on the board.
		expect(isPointerWithinBoard()).toBe(true);
	});

	test('follows the scene boundary events', () => {
		const input = createSceneInputMock();
		unsubscribe = trackPointerWithinBoard({ input } as never);

		input.emit('gameout');
		expect(isPointerWithinBoard()).toBe(false);

		input.emit('gameover');
		expect(isPointerWithinBoard()).toBe(true);
	});

	test('stops following once unsubscribed', () => {
		const input = createSceneInputMock();
		const stop = trackPointerWithinBoard({ input } as never);
		stop();
		unsubscribe = () => {};

		input.emit('gameout');
		expect(isPointerWithinBoard()).toBe(true);
	});

	test('is a no-op without a scene', () => {
		expect(() => trackPointerWithinBoard(null)()).not.toThrow();
	});
});

describe('hovered hex', () => {
	afterEach(() => {
		clearHoveredHex();
	});

	test('round-trips and clears', () => {
		expect(getHoveredHex()).toBeUndefined();
		const hex = { id: 7 };
		setHoveredHex(hex);
		expect(getHoveredHex()).toBe(hex);
		clearHoveredHex();
		expect(getHoveredHex()).toBeUndefined();
	});

	test('setting a nullish hex clears rather than storing it', () => {
		// `lastMouseHex` is assigned `undefined` in several places; storing that
		// would leave a "hovered" hex that is not there.
		setHoveredHex({ id: 1 });
		setHoveredHex(undefined);
		expect(getHoveredHex()).toBeUndefined();
		setHoveredHex({ id: 2 });
		setHoveredHex(null);
		expect(getHoveredHex()).toBeUndefined();
	});
});

describe('the input gate', () => {
	const idle = { freezedInput: false, botController: { isBotTurn: () => false } };

	test('accepts input on the local player turn', () => {
		expect(isInputAccepted(idle)).toBe(true);
		expect(rejectIfTurnFrozen(idle)).toBe(false);
	});

	test('rejects input while frozen', () => {
		expect(isInputAccepted({ freezedInput: true })).toBe(false);
	});

	test('rejects input during the bot turn', () => {
		expect(isInputAccepted({ freezedInput: false, botController: { isBotTurn: () => true } })).toBe(
			false,
		);
	});

	test('accepts input when there is no bot controller at all', () => {
		// Single-player and the headless runner have no BotController; treating its
		// absence as "not the bot's turn" is what keeps input alive there.
		expect(isInputAccepted({ freezedInput: false })).toBe(true);
	});

	test('rejects rather than throwing on a missing game', () => {
		expect(isInputAccepted(null)).toBe(false);
		expect(rejectIfTurnFrozen(undefined)).toBe(true);
	});

	test('a frozen turn shows the wait cursor, not a hand', () => {
		// The interesting failure is silent: handlers return quietly, so a frozen
		// turn that did not answer would leave a hand cursor over a board that is
		// not accepting input.
		document.body.innerHTML = '<canvas></canvas>';
		const canvas = document.querySelector('canvas');
		if (!canvas) throw new Error('test setup: no canvas element found');
		canvas.style.cursor = 'pointer';

		expect(rejectIfTurnFrozen(idle)).toBe(false);
		canvas.style.cursor = 'pointer';
		expect(rejectIfTurnFrozen({ freezedInput: true })).toBe(true);
		expect(canvas.style.cursor).toBe('wait');
	});

	test('a missing canvas is not an error', () => {
		document.body.innerHTML = '';
		expect(rejectIfTurnFrozen({ freezedInput: true })).toBe(true);
	});
});

describe('module reset', () => {
	test('resetHoveredHexForTest exists for suites that need a clean slate', () => {
		// Guards against the module drifting away from the test-only reset helper
		// other suites are expected to use.
		expect(typeof resetHoveredHexForTest).toBe('function');
		setHoveredHex({ id: 3 });
		resetHoveredHexForTest();
		expect(getHoveredHex()).toBeUndefined();
	});
});
