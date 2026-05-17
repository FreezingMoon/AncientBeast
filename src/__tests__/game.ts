import { jest, expect, describe, test, beforeEach, afterEach } from '@jest/globals';

jest.mock('pixi', () => ({}), { virtual: true });
jest.mock('p2', () => ({}), { virtual: true });
jest.mock('phaser-ce', () => ({
	Point: class PointMock {},
	Polygon: class PolygonMock {},
	default: class PhaserMock {},
}));
jest.mock(
	'phaser',
	() => ({
		Signal: class SignalMock {},
		default: class PhaserMock {},
	}),
	{ virtual: true },
);

import Game from '../game';
import { UI } from '../ui/interface';

describe('Game replay completion', () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	test('onLogLoad restores interactive input after replay finishes', () => {
		const queryMove = jest.fn();
		const refreshHoverState = jest.fn();

		const game = {
			gameState: 'initialized',
			pause: false,
			activeCreature: { queryMove },
			grid: { refreshHoverState },
			configData: {},
			_deferredQueryMovePending: 3,
			turnThrottle: true,
			freezedInput: true,
			loadGame: jest.fn(
				(
					_configData: unknown,
					_matchInitialized: unknown,
					_matchid: unknown,
					onLoadCompleteFn: () => void,
				) => {
					game.gameState = 'playing';
					onLoadCompleteFn();
				},
			),
		} as unknown as Game;

		const log = {
			actions: [],
			custom: {
				configData: {
					gameMode: 2,
				},
			},
		};

		Game.prototype.onLogLoad.call(game, log);
		jest.advanceTimersByTime(3000);
		jest.runAllTimers();

		expect(game.freezedInput).toBe(false);
		expect(game.turnThrottle).toBe(false);
		expect(game._deferredQueryMovePending).toBe(0);
		expect(refreshHoverState).toHaveBeenCalledTimes(1);
		expect(queryMove).toHaveBeenCalledTimes(1);
	});

	test('onLogLoad does not force duplicate query when active query already exists', () => {
		const queryMove = jest.fn();
		const refreshHoverState = jest.fn();
		const activeCreatureId = 77;

		const game = {
			gameState: 'initialized',
			pause: false,
			activeCreature: { id: activeCreatureId, queryMove },
			grid: {
				refreshHoverState,
				lastQueryOpt: { id: activeCreatureId },
			},
			configData: {},
			_deferredQueryMovePending: 2,
			turnThrottle: true,
			freezedInput: true,
			loadGame: jest.fn(
				(
					_configData: unknown,
					_matchInitialized: unknown,
					_matchid: unknown,
					onLoadCompleteFn: () => void,
				) => {
					game.gameState = 'playing';
					onLoadCompleteFn();
				},
			),
		} as unknown as Game;

		const log = {
			actions: [],
			custom: {
				configData: {
					gameMode: 2,
				},
			},
		};

		Game.prototype.onLogLoad.call(game, log);
		jest.advanceTimersByTime(3000);
		jest.runAllTimers();

		expect(game.freezedInput).toBe(false);
		expect(game.turnThrottle).toBe(false);
		expect(game._deferredQueryMovePending).toBe(0);
		expect(refreshHoverState).toHaveBeenCalledTimes(1);
		expect(queryMove).toHaveBeenCalledTimes(0);
	});
});

describe('Game unload confirmation integration', () => {
	test('confirmWindowUnload registers one beforeunload listener across repeated setup calls', () => {
		const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
		const firstUiState = { ignoreNextConfirmUnload: true };
		const secondUiState = { ignoreNextConfirmUnload: true };

		UI.prototype.confirmWindowUnload.call(firstUiState as UI);
		UI.prototype.confirmWindowUnload.call(secondUiState as UI);

		const beforeUnloadCalls = addEventListenerSpy.mock.calls.filter(
			([eventName]) => eventName === 'beforeunload',
		);

		expect(beforeUnloadCalls).toHaveLength(1);
		expect(firstUiState.ignoreNextConfirmUnload).toBe(false);
		expect(secondUiState.ignoreNextConfirmUnload).toBe(false);

		addEventListenerSpy.mockRestore();
	});

	test('confirmWindowUnload listener uses active state for prompt and bypass', () => {
		jest.resetModules();
		let TestUI: typeof UI | undefined;
		jest.isolateModules(() => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			TestUI = require('../ui/interface').UI;
		});

		if (!TestUI) {
			throw new Error('Failed to load UI module');
		}

		const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
		const firstUiState = { ignoreNextConfirmUnload: false };
		const secondUiState = { ignoreNextConfirmUnload: false };

		TestUI.prototype.confirmWindowUnload.call(firstUiState as UI);
		TestUI.prototype.confirmWindowUnload.call(secondUiState as UI);

		const beforeUnloadCall = addEventListenerSpy.mock.calls.find(
			([eventName]) => eventName === 'beforeunload',
		);
		const beforeUnloadListener = beforeUnloadCall?.[1] as
			| ((event: BeforeUnloadEvent) => string | void)
			| undefined;

		expect(beforeUnloadListener).toBeDefined();

		const unloadEvent = {
			preventDefault: jest.fn(),
			returnValue: undefined,
		} as unknown as BeforeUnloadEvent;
		if (!beforeUnloadListener) {
			throw new Error('beforeunload listener should be defined');
		}
		const result = beforeUnloadListener(unloadEvent);

		expect(unloadEvent.preventDefault).toHaveBeenCalledTimes(1);
		expect(unloadEvent.returnValue).toBe(
			'A game is in progress and cannot be restored, are you sure you want to leave?',
		);
		expect(result).toBe(
			'A game is in progress and cannot be restored, are you sure you want to leave?',
		);

		secondUiState.ignoreNextConfirmUnload = true;
		const bypassEvent = {
			preventDefault: jest.fn(),
			returnValue: 'existing',
		} as unknown as BeforeUnloadEvent;
		const bypassResult = beforeUnloadListener(bypassEvent);

		expect(bypassEvent.preventDefault).not.toHaveBeenCalled();
		expect((bypassEvent as unknown as { returnValue?: string }).returnValue).toBeUndefined();
		expect(bypassResult).toBeUndefined();

		addEventListenerSpy.mockRestore();
	});
});
