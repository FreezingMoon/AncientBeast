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
