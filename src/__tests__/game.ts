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

	test('confirmWindowUnload onbeforeunload handler uses active state for prompt and bypass', () => {
		jest.resetModules();
		let TestUI: typeof UI | undefined;
		jest.isolateModules(() => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			TestUI = require('../ui/interface').UI;
		});

		if (!TestUI) {
			throw new Error('Failed to load UI module');
		}

		const originalOnBeforeUnload = window.onbeforeunload;
		const firstUiState = { ignoreNextConfirmUnload: false };
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

	test('confirmWindowUnload dev message handler shows save prompt and dismisses cleanly', () => {
		jest.resetModules();
		const originalNodeEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = 'development';
		let TestUI: typeof UI | undefined;
		jest.isolateModules(() => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			TestUI = require('../ui/interface').UI;
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

		expect(promptVisibleUnloadEvent.preventDefault).toHaveBeenCalledTimes(1);
		expect(promptVisibleUnloadEvent.returnValue).toBe(
			'A game is in progress and cannot be restored, are you sure you want to leave?',
		);
		expect(promptVisibleUnloadResult).toBe(
			'A game is in progress and cannot be restored, are you sure you want to leave?',
		);

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

	test('confirmWindowUnload uses custom modal for manual refresh shortcuts', () => {
		jest.resetModules();
		const originalNodeEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = 'test';
		let TestUI: typeof UI | undefined;
		jest.isolateModules(() => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			TestUI = require('../ui/interface').UI;
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
