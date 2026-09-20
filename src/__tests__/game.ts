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

describe('Game reset lifecycle', () => {
	const makeMockGame = (overrides = {}): Game =>
		({
			UI: {
				metaPowers: { _clearPowers: jest.fn() },
				showGameSetup: jest.fn(),
			},
			stopTimer: jest.fn(),
			players: [],
			creatures: [],
			effects: [],
			activeCreature: undefined,
			matchid: null,
			playersReady: false,
			preventSetup: false,
			animations: {},
			queue: {},
			creatureData: [],
			pause: false,
			gameState: 'ended',
			availableCreatures: [],
			animationQueue: [],
			configData: {},
			match: {},
			firstKill: true,
			freezedInput: true,
			isReplayInProgress: true,
			turnThrottle: true,
			turn: 7,
			traps: [],
			drops: [],
			gamelog: { reset: jest.fn() },
			signals: {
				ui: { add: jest.fn(), dispatch: jest.fn() },
				metaPowers: { add: jest.fn(), dispatch: jest.fn() },
				creature: { add: jest.fn(), dispatch: jest.fn() },
				hex: { add: jest.fn(), dispatch: jest.fn() },
			},
			setupSignalChannels: jest.fn(() => ({
				ui: { add: jest.fn(), dispatch: jest.fn() },
				metaPowers: { add: jest.fn(), dispatch: jest.fn() },
				creature: { add: jest.fn(), dispatch: jest.fn() },
				hex: { add: jest.fn(), dispatch: jest.fn() },
			})),
			botController: {},
			...overrides,
		} as unknown as Game);

	test('resetGame recreates signal channels to avoid listener accumulation after restart', () => {
		const game = makeMockGame();
		Game.prototype.resetGame.call(game);
		expect(game.signals.creature.add).toHaveBeenCalledTimes(1);
	});

	test('resetGame destroys existing traps and drops', () => {
		const trapDestroy = jest.fn();
		const dropDestroy = jest.fn();
		const game = makeMockGame({
			traps: [{ destroy: trapDestroy }, { destroy: trapDestroy }],
			drops: [{ destroy: dropDestroy }],
		});

		Game.prototype.resetGame.call(game);

		expect(trapDestroy).toHaveBeenCalledTimes(2);
		expect(dropDestroy).toHaveBeenCalledTimes(1);
		expect(game.traps).toEqual([]);
		expect(game.drops).toEqual([]);
	});
});

describe('Game Phaser boot timing', () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	test('whenPhaserBooted waits until the current Phaser instance exposes its loader', () => {
		const onBooted = jest.fn();
		const phaser = {
			isBooted: false,
			load: null,
		} as unknown as Game['Phaser'];
		const game = {
			Phaser: phaser,
			whenPhaserBooted: Game.prototype.whenPhaserBooted,
		} as unknown as Game;

		Game.prototype.whenPhaserBooted.call(game, phaser, onBooted);

		expect(onBooted).not.toHaveBeenCalled();

		(phaser as { isBooted: boolean; load: object | null }).isBooted = true;
		(phaser as { isBooted: boolean; load: object | null }).load = {};
		jest.runOnlyPendingTimers();

		expect(onBooted).toHaveBeenCalledTimes(1);
		expect(onBooted).toHaveBeenCalledWith(phaser);
	});
});

describe('Game unload confirmation integration', () => {
	test('confirmWindowUnload sets window.onbeforeunload (single registration) and updates active state', () => {
		const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
		const originalNodeEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = 'development';
		const originalOnBeforeUnload = window.onbeforeunload;
		const firstUiState = { ignoreNextConfirmUnload: true };
		const secondUiState = { ignoreNextConfirmUnload: true };

		UI.prototype.confirmWindowUnload.call(firstUiState as UI);
		const firstHandler = window.onbeforeunload;
		UI.prototype.confirmWindowUnload.call(secondUiState as UI);
		const secondHandler = window.onbeforeunload;

		expect(firstHandler).toBeDefined();
		expect(secondHandler).toBeDefined();
		expect(secondHandler).toBe(firstHandler);
		expect(
			addEventListenerSpy.mock.calls.filter(([eventName]) => eventName === 'beforeunload'),
		).toHaveLength(0);
		expect(
			addEventListenerSpy.mock.calls.filter(([eventName]) => eventName === 'message'),
		).toHaveLength(1);
		expect(firstUiState.ignoreNextConfirmUnload).toBe(false);
		expect(secondUiState.ignoreNextConfirmUnload).toBe(false);

		addEventListenerSpy.mockRestore();
		process.env.NODE_ENV = originalNodeEnv;
		window.onbeforeunload = originalOnBeforeUnload;
	});

	test('confirmWindowUnload onbeforeunload handler uses active state for prompt and bypass', async () => {
		jest.resetModules();
		let TestUI: typeof UI | undefined;
		await jest.isolateModulesAsync(async () => {
			const mod = await import('../ui/interface');
			TestUI = mod.UI;
		});

		if (!TestUI) {
			throw new Error('Failed to load UI module');
		}

		const originalOnBeforeUnload = window.onbeforeunload;
		const secondUiState = { ignoreNextConfirmUnload: false };

		TestUI.prototype.confirmWindowUnload.call(secondUiState as UI);

		const beforeUnloadListener = window.onbeforeunload as
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

		window.onbeforeunload = originalOnBeforeUnload;
	});

	test('confirmWindowUnload dev message handler shows save prompt and dismisses cleanly', async () => {
		jest.resetModules();
		const originalNodeEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = 'development';
		let TestUI: typeof UI | undefined;
		await jest.isolateModulesAsync(async () => {
			const mod = await import('../ui/interface');
			TestUI = mod.UI;
		});

		if (!TestUI) {
			throw new Error('Failed to load UI module');
		}

		const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
		const originalAB = window.AB;
		const originalOnBeforeUnload = window.onbeforeunload;
		const saveLog = jest.fn();
		const leakedHotkeyHandler = jest.fn();
		window.AB = { saveLog };
		document.addEventListener('keydown', leakedHotkeyHandler);
		const uiState = { ignoreNextConfirmUnload: false };

		TestUI.prototype.confirmWindowUnload.call(uiState as UI);

		const messageListenerCall = addEventListenerSpy.mock.calls.find(
			([eventName]) => eventName === 'message',
		);
		const messageListener = messageListenerCall?.[1] as ((event: MessageEvent) => void) | undefined;

		expect(messageListener).toBeDefined();
		if (!messageListener) {
			throw new Error('message listener should be defined');
		}

		messageListener({ data: { type: 'webpackInvalid' } } as MessageEvent);

		const prompt = document.getElementById('ab-dev-reload-prompt');
		const beforeUnloadListener = window.onbeforeunload as
			| ((event: BeforeUnloadEvent) => string | void)
			| undefined;
		expect(prompt).toBeDefined();
		expect(beforeUnloadListener).toBeDefined();

		const promptVisibleUnloadEvent = {
			preventDefault: jest.fn(),
			returnValue: 'existing',
		} as unknown as BeforeUnloadEvent;
		const promptVisibleUnloadResult = beforeUnloadListener?.(promptVisibleUnloadEvent);

		expect(promptVisibleUnloadEvent.preventDefault).not.toHaveBeenCalled();
		expect(
			(promptVisibleUnloadEvent as unknown as { returnValue?: string }).returnValue,
		).toBeUndefined();
		expect(promptVisibleUnloadResult).toBeUndefined();

		const buttons = Array.from(prompt?.querySelectorAll('button') ?? []);
		const closeButton = buttons.find((button) => button.classList.contains('close-button')) as
			| HTMLButtonElement
			| undefined;
		const actionButtons = buttons.filter((button) => !button.classList.contains('close-button'));
		const saveButton = actionButtons[0] as HTMLButtonElement | undefined;
		const reloadButton = actionButtons[1] as HTMLButtonElement | undefined;
		const keepButton = actionButtons[2] as HTMLButtonElement | undefined;

		expect(closeButton).toBeDefined();
		expect(closeButton?.closest('.framed-modal')).toBeNull();
		expect(saveButton).toBeDefined();
		expect(reloadButton).toBeDefined();
		expect(keepButton).toBeDefined();
		expect(saveButton?.dataset.devReloadHotkey).toBe('s');
		expect(reloadButton?.dataset.devReloadHotkey).toBe('r');
		expect(keepButton?.dataset.devReloadHotkey).toBe('c');
		expect(saveButton?.getAttribute('aria-keyshortcuts')).toBe('S');
		expect(reloadButton?.getAttribute('aria-keyshortcuts')).toBe('R');
		expect(keepButton?.getAttribute('aria-keyshortcuts')).toBe('C');
		expect(saveButton?.querySelector('span')?.textContent).toBe('S');
		expect(reloadButton?.querySelector('span')?.textContent).toBe('R');
		expect(keepButton?.querySelector('span')?.textContent).toBe('C');
		closeButton?.click();
		expect(document.getElementById('ab-dev-reload-prompt')).toBeNull();

		messageListener({ data: { type: 'webpackInvalid' } } as MessageEvent);
		expect(document.getElementById('ab-dev-reload-prompt')).toBeDefined();

		document.dispatchEvent(
			new KeyboardEvent('keydown', {
				key: 'Escape',
				bubbles: true,
				cancelable: true,
			}),
		);
		expect(document.getElementById('ab-dev-reload-prompt')).toBeNull();
		expect(leakedHotkeyHandler).not.toHaveBeenCalled();

		messageListener({ data: { type: 'webpackInvalid' } } as MessageEvent);
		expect(document.getElementById('ab-dev-reload-prompt')).toBeDefined();

		document
			.getElementById('ab-dev-reload-prompt')
			?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
		expect(document.getElementById('ab-dev-reload-prompt')).toBeNull();

		messageListener({ data: { type: 'webpackInvalid' } } as MessageEvent);
		expect(document.getElementById('ab-dev-reload-prompt')).toBeDefined();

		document.dispatchEvent(
			new KeyboardEvent('keydown', {
				key: 's',
				bubbles: true,
				cancelable: true,
			}),
		);
		expect(saveLog).toHaveBeenCalledTimes(1);
		expect(document.getElementById('ab-dev-reload-prompt')).toBeDefined();
		expect(leakedHotkeyHandler).not.toHaveBeenCalled();

		document.dispatchEvent(
			new KeyboardEvent('keydown', {
				key: 'x',
				bubbles: true,
				cancelable: true,
			}),
		);
		expect(document.getElementById('ab-dev-reload-prompt')).toBeDefined();
		expect(leakedHotkeyHandler).not.toHaveBeenCalled();

		document.dispatchEvent(
			new KeyboardEvent('keydown', {
				key: 'c',
				bubbles: true,
				cancelable: true,
			}),
		);
		expect(document.getElementById('ab-dev-reload-prompt')).toBeNull();
		expect(uiState.ignoreNextConfirmUnload).toBe(false);
		expect(leakedHotkeyHandler).not.toHaveBeenCalled();

		messageListener({ data: { type: 'webpackInvalid' } } as MessageEvent);
		expect(document.getElementById('ab-dev-reload-prompt')).toBeDefined();

		try {
			document.dispatchEvent(
				new KeyboardEvent('keydown', {
					key: 'r',
					bubbles: true,
					cancelable: true,
				}),
			);
		} catch (error) {
			expect(String(error)).toContain('Not implemented: navigation');
		}
		expect(document.getElementById('ab-dev-reload-prompt')).toBeNull();
		expect(window.onbeforeunload).toBeNull();
		expect(uiState.ignoreNextConfirmUnload).toBe(true);
		expect(leakedHotkeyHandler).not.toHaveBeenCalled();

		const reloadBypassUnloadEvent = {
			preventDefault: jest.fn(),
			returnValue: 'existing',
		} as unknown as BeforeUnloadEvent;
		const reloadBypassUnloadResult = beforeUnloadListener?.(reloadBypassUnloadEvent);
		expect(reloadBypassUnloadEvent.preventDefault).not.toHaveBeenCalled();
		expect(
			(reloadBypassUnloadEvent as unknown as { returnValue?: string }).returnValue,
		).toBeUndefined();
		expect(reloadBypassUnloadResult).toBeUndefined();
		uiState.ignoreNextConfirmUnload = false;

		const promptClosedUnloadEvent = {
			preventDefault: jest.fn(),
			returnValue: undefined,
		} as unknown as BeforeUnloadEvent;
		const promptClosedUnloadResult = beforeUnloadListener?.(promptClosedUnloadEvent);

		expect(promptClosedUnloadEvent.preventDefault).toHaveBeenCalledTimes(1);
		expect(promptClosedUnloadEvent.returnValue).toBe(
			'A game is in progress and cannot be restored, are you sure you want to leave?',
		);
		expect(promptClosedUnloadResult).toBe(
			'A game is in progress and cannot be restored, are you sure you want to leave?',
		);

		addEventListenerSpy.mockRestore();
		document.removeEventListener('keydown', leakedHotkeyHandler);
		window.AB = originalAB;
		window.onbeforeunload = originalOnBeforeUnload;
		process.env.NODE_ENV = originalNodeEnv;
	});

	test('confirmWindowUnload uses custom modal for manual refresh shortcuts', async () => {
		jest.resetModules();
		const originalNodeEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = 'test';
		let TestUI: typeof UI | undefined;
		await jest.isolateModulesAsync(async () => {
			const mod = await import('../ui/interface');
			TestUI = mod.UI;
		});

		if (!TestUI) {
			throw new Error('Failed to load UI module');
		}

		const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
		const originalOnBeforeUnload = window.onbeforeunload;
		const uiState = { ignoreNextConfirmUnload: false };

		TestUI.prototype.confirmWindowUnload.call(uiState as UI);

		const refreshKeydownListenerCall = addEventListenerSpy.mock.calls.find(
			([eventName]) => eventName === 'keydown',
		);
		const refreshKeydownListener = refreshKeydownListenerCall?.[1] as
			| ((event: KeyboardEvent) => void)
			| undefined;

		expect(refreshKeydownListener).toBeDefined();
		if (!refreshKeydownListener) {
			throw new Error('refresh keydown listener should be defined');
		}

		const refreshShortcutEvent = {
			key: 'r',
			ctrlKey: true,
			metaKey: false,
			altKey: false,
			preventDefault: jest.fn(),
			stopPropagation: jest.fn(),
			stopImmediatePropagation: jest.fn(),
		} as unknown as KeyboardEvent;
		refreshKeydownListener(refreshShortcutEvent);

		expect(refreshShortcutEvent.preventDefault).toHaveBeenCalledTimes(1);
		expect(refreshShortcutEvent.stopPropagation).toHaveBeenCalledTimes(1);
		expect(refreshShortcutEvent.stopImmediatePropagation).toHaveBeenCalledTimes(1);
		expect(document.getElementById('ab-dev-reload-prompt')).toBeDefined();

		const beforeUnloadListener = window.onbeforeunload as
			| ((event: BeforeUnloadEvent) => string | void)
			| undefined;
		expect(beforeUnloadListener).toBeDefined();

		const actionButtons = Array.from(
			document.querySelectorAll('#ab-dev-reload-prompt .dev-reload-button'),
		) as HTMLButtonElement[];
		const reloadButton = actionButtons[1] as HTMLButtonElement | undefined;
		expect(reloadButton).toBeDefined();

		try {
			reloadButton?.click();
		} catch (error) {
			expect(String(error)).toContain('Not implemented: navigation');
		}

		expect(document.getElementById('ab-dev-reload-prompt')).toBeNull();
		expect(uiState.ignoreNextConfirmUnload).toBe(true);

		const bypassEvent = {
			preventDefault: jest.fn(),
			returnValue: 'existing',
		} as unknown as BeforeUnloadEvent;
		const bypassResult = beforeUnloadListener?.(bypassEvent);
		expect(bypassEvent.preventDefault).not.toHaveBeenCalled();
		expect((bypassEvent as unknown as { returnValue?: string }).returnValue).toBeUndefined();
		expect(bypassResult).toBeUndefined();

		addEventListenerSpy.mockRestore();
		window.onbeforeunload = originalOnBeforeUnload;
		process.env.NODE_ENV = originalNodeEnv;
	});
});

describe('Game multiplayer turn ownership guard', () => {
	// Regression coverage for turns desyncing between Devvit 1v1 players:
	// automatic turn-ending triggers (turn timer expiry, frozen/dizzy/dazzled/
	// BRB status in Creature.activate()) run locally on every client. Without
	// gating them by which player actually owns the active creature, BOTH
	// clients could independently skip/delay and broadcast for the same turn
	// transition, double-advancing the queue on whichever client applies both
	// its own local skip and the echoed remote one.
	const makeSkipDelayMockGame = (overrides: Record<string, unknown> = {}): Game =>
		({
			isOtherPlayersTurn: Game.prototype['isOtherPlayersTurn' as keyof Game],
			multiplayer: true,
			turnThrottle: false,
			pauseTime: 0,
			creatures: [],
			activeCreature: {
				player: { controller: 'human', startTime: new Date() },
				canWait: true,
				id: 1,
			},
			queue: { queue: [1, 2], isCurrentEmpty: jest.fn(() => false) },
			lobby: {
				isMyTurn: jest.fn(() => false),
				getLocalPlayer: jest.fn(() => ({ playerId: 'p1', playerIndex: 0 })),
				sendAction: jest.fn(),
			},
			UI: {
				btnSkipTurn: { changeState: jest.fn() },
				btnDelay: { changeState: jest.fn() },
			},
			...overrides,
		} as unknown as Game);

	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	test('skipTurn is ignored when the active creature belongs to the other player', () => {
		const game = makeSkipDelayMockGame();

		Game.prototype.skipTurn.call(game);

		expect(game.lobby.sendAction as jest.Mock).not.toHaveBeenCalled();
		expect(game.UI.btnSkipTurn.changeState as jest.Mock).not.toHaveBeenCalled();
	});

	test("skipTurn proceeds and broadcasts when it is the local player's turn", () => {
		const game = makeSkipDelayMockGame({
			activeCreature: {
				player: { controller: 'human', id: 0, startTime: new Date() },
				canWait: true,
				id: 1,
				facePlayerDefault: jest.fn(),
				deactivate: jest.fn(),
			},
			lobby: {
				isMyTurn: jest.fn(() => true),
				getLocalPlayer: jest.fn(() => ({ playerId: 'p1', playerIndex: 0 })),
				sendAction: jest.fn(),
			},
			nextCreature: jest.fn(),
		});

		Game.prototype.skipTurn.call(game);

		expect(game.lobby.sendAction as jest.Mock).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'action-end', action: 'skip' }),
		);
	});

	test('skipTurn is not blocked for a bot-controlled creature even if isMyTurn is false', () => {
		const game = makeSkipDelayMockGame({
			activeCreature: {
				player: { controller: 'bot', id: 1, startTime: new Date() },
				canWait: true,
				id: 1,
				facePlayerDefault: jest.fn(),
				deactivate: jest.fn(),
			},
			nextCreature: jest.fn(),
		});

		Game.prototype.skipTurn.call(game);

		expect(game.lobby.sendAction as jest.Mock).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'action-end', action: 'skip' }),
		);
	});

	test('skipTurn applies a remote action-end message regardless of local turn ownership', () => {
		const game = makeSkipDelayMockGame({
			activeCreature: {
				player: { controller: 'human', id: 1, startTime: new Date() },
				canWait: true,
				id: 1,
				facePlayerDefault: jest.fn(),
				deactivate: jest.fn(),
			},
			nextCreature: jest.fn(),
		});

		Game.prototype.skipTurn.call(game, undefined, true);

		expect(game.lobby.sendAction as jest.Mock).not.toHaveBeenCalled();
		expect(game.nextCreature as jest.Mock).toHaveBeenCalledWith(true);
	});

	test('delayCreature is ignored when the active creature belongs to the other player', () => {
		const game = makeSkipDelayMockGame();

		Game.prototype.delayCreature.call(game);

		expect(game.lobby.sendAction as jest.Mock).not.toHaveBeenCalled();
	});

	test("delayCreature proceeds and broadcasts when it is the local player's turn", () => {
		const game = makeSkipDelayMockGame({
			activeCreature: {
				player: { controller: 'human', id: 0, startTime: new Date() },
				canWait: true,
				id: 1,
				wait: jest.fn(),
			},
			lobby: {
				isMyTurn: jest.fn(() => true),
				getLocalPlayer: jest.fn(() => ({ playerId: 'p1', playerIndex: 0 })),
				sendAction: jest.fn(),
			},
			nextCreature: jest.fn(),
		});

		Game.prototype.delayCreature.call(game);

		expect(game.lobby.sendAction as jest.Mock).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'action-end', action: 'delay' }),
		);
	});
});

describe('Game nextCreature turn-update broadcast ownership', () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	const makeNextCreatureMockGame = (overrides: Record<string, unknown> = {}): Game =>
		({
			UI: {
				closeDash: jest.fn(),
				btnToggleDash: { changeState: jest.fn() },
				updateActivebox: jest.fn(),
				updateQueueDisplay: jest.fn(),
				_abilityPanelAnimating: false,
			},
			grid: { clearAllXray: jest.fn(), suppressNextHoverRefresh: false },
			gameState: 'playing',
			stopTimer: jest.fn(),
			queue: {
				isCurrentEmpty: jest.fn(() => false),
				queue: [
					{
						id: 2,
						player: { id: 1 },
						activate: jest.fn(),
					},
				],
			},
			turn: 1,
			activeCreature: {
				id: 1,
				dead: false,
				player: { id: 0 },
				updateHealth: jest.fn(),
			},
			soundsys: { playHeartBeat: jest.fn() },
			log: jest.fn(),
			signals: { creature: { dispatch: jest.fn() } },
			multiplayer: true,
			playersReady: true,
			lobby: {
				getLocalPlayer: jest.fn(() => ({ playerId: 'local', playerIndex: 0 })),
				sendAction: jest.fn(),
			},
			updateQueueDisplay: jest.fn(),
			...overrides,
		} as unknown as Game);

	test('does not broadcast turn-update when the outgoing creature belonged to the other player', () => {
		// Simulates a locally-replayed remote ability that kills the opponent's
		// own active creature (Creature.die() calling nextCreature() with no
		// `remote` flag threaded through). This client must not also broadcast
		// its own turn-update for a transition it doesn't own.
		const game = makeNextCreatureMockGame({
			activeCreature: {
				id: 1,
				dead: false,
				player: { id: 1 }, // owned by the OTHER player (local playerIndex is 0)
				updateHealth: jest.fn(),
			},
		});

		Game.prototype.nextCreature.call(game);
		jest.runAllTimers();

		expect(game.lobby.sendAction as jest.Mock).not.toHaveBeenCalled();
	});

	test('broadcasts turn-update when the outgoing creature belonged to the local player', () => {
		const game = makeNextCreatureMockGame();

		Game.prototype.nextCreature.call(game);
		jest.runAllTimers();

		expect(game.lobby.sendAction as jest.Mock).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'turn-update', creatureId: 2, turn: 1 }),
		);
	});
});

describe('Game.applyMoveRecord — shared by action() replay and live multiplayer relay', () => {
	// Regression coverage for movement desyncing: this is the single place that
	// turns a recorded/relayed "move" action into a real Creature.moveTo() call,
	// used both by action() (saved gamelog replay) and by
	// handleLobbyMessage()'s 'action-move' case (live Devvit relay). It must
	// replay the exact recorded path — resolved against THIS client's own
	// grid.hexes — rather than letting moveTo() recalculate pathfinding, which
	// can diverge between clients on drifted grid state.
	const makeMoveRecordMockGame = (overrides: Record<string, unknown> = {}): Game =>
		({
			grid: {
				hexes: Array.from({ length: 3 }, (_, y) => Array.from({ length: 3 }, (_, x) => ({ x, y }))),
			},
			activeCreature: {
				moveTo: jest.fn(),
			},
			...overrides,
		} as unknown as Game);

	test("resolves a recorded path into this client's own live Hex instances", () => {
		const game = makeMoveRecordMockGame();
		const callback = jest.fn();

		(
			Game.prototype as unknown as {
				applyMoveRecord: (
					record: { target: { x: number; y: number }; path?: Array<{ x: number; y: number }> },
					cb?: () => void,
				) => void;
			}
		).applyMoveRecord.call(
			game,
			{
				target: { x: 2, y: 1 },
				path: [
					{ x: 1, y: 1 },
					{ x: 2, y: 1 },
				],
			},
			callback,
		);

		const moveTo = game.activeCreature.moveTo as jest.Mock;
		expect(moveTo).toHaveBeenCalledTimes(1);
		const [hexArg, optsArg] = moveTo.mock.calls[0] as [
			unknown,
			{ path?: unknown[]; callback: unknown },
		];
		expect(hexArg).toBe(game.grid.hexes[1][2]);
		expect(optsArg.path).toEqual([game.grid.hexes[1][1], game.grid.hexes[1][2]]);
		expect(optsArg.callback).toBe(callback);
	});

	test('falls back to undefined path (letting moveTo recalculate) when no path was recorded', () => {
		const game = makeMoveRecordMockGame();

		(
			Game.prototype as unknown as {
				applyMoveRecord: (record: { target: { x: number; y: number } }, cb?: () => void) => void;
			}
		).applyMoveRecord.call(game, { target: { x: 0, y: 0 } });

		const moveTo = game.activeCreature.moveTo as jest.Mock;
		const [, optsArg] = moveTo.mock.calls[0] as [unknown, { path?: unknown[] }];
		expect(optsArg.path).toBeUndefined();
	});
});

describe('Game Undo Move', () => {
	const makeUndoMockGame = (overrides: Record<string, unknown> = {}): Game =>
		({
			gameState: 'playing',
			multiplayer: false,
			isReplayInProgress: false,
			undoReplayPending: false,
			undoUsedTurn: null,
			turnThrottle: false,
			freezedInput: false,
			pause: false,
			turn: 4,
			gamelog: {
				actions: [{ action: 'move' }, { action: 'ability' }],
				load: jest.fn(),
				reset: jest.fn(),
			},
			configData: { gameMode: 2, players: [{ name: 'A' }, { name: 'B' }] },
			botController: { isBotTurn: jest.fn(() => false) },
			UI: { updateUndoButton: jest.fn() },
			resetGame: jest.fn(),
			hasUndoMove: Game.prototype.hasUndoMove,
			canUndoLastAction: Game.prototype.canUndoLastAction,
			...overrides,
		} as unknown as Game);

	test('offers undo for a recorded local action until it is used in that round', () => {
		const game = makeUndoMockGame();

		expect(Game.prototype.hasUndoMove.call(game)).toBe(true);
		game.undoUsedTurn = 4;
		expect(Game.prototype.hasUndoMove.call(game)).toBe(false);
	});

	test('does not offer client-local undo during multiplayer matches', () => {
		const game = makeUndoMockGame({ multiplayer: true });

		expect(Game.prototype.hasUndoMove.call(game)).toBe(false);
	});

	test('rebuilds the match from every recorded action except the latest one', () => {
		const game = makeUndoMockGame();

		const undone = Game.prototype.undoLastAction.call(game);

		expect(undone).toBe(true);
		expect(game.undoReplayPending).toBe(true);
		expect(game.resetGame as jest.Mock).toHaveBeenCalledTimes(1);
		expect(game.gamelog.load as jest.Mock).toHaveBeenCalledTimes(1);
		const rollbackLog = (game.gamelog.load as jest.Mock).mock.calls[0][0] as {
			actions: unknown[];
			custom: { configData: unknown };
		};
		expect(rollbackLog.actions).toEqual([{ action: 'move' }]);
		expect(rollbackLog.custom.configData).toEqual(game.configData);
	});

	test('consumes undo in the round restored by replay', () => {
		const game = makeUndoMockGame({
			turn: 3,
			isReplayInProgress: true,
			undoReplayPending: true,
		});

		(
			Game.prototype as unknown as {
				finishLogReplay: () => void;
			}
		).finishLogReplay.call(game);

		expect(game.isReplayInProgress).toBe(false);
		expect(game.undoReplayPending).toBe(false);
		expect(game.undoUsedTurn).toBe(3);
		expect(game.UI.updateUndoButton as jest.Mock).toHaveBeenCalledTimes(1);
	});
});

