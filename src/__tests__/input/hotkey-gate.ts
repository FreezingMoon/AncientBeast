/* global KeyboardEventInit */
import { describe, expect, test } from '@jest/globals';

import {
	isAudioModeHotkey,
	isScoreboardHotkey,
	isUtilityHotkey,
	type HotkeyGateContext,
} from '../../input/hotkey-gate';

/** A keydown as the hotkey gate sees it — a native event, since jQuery forwards the original. */
const key = (code: string, modifiers: Partial<KeyboardEventInit> = {}) =>
	new KeyboardEvent('keydown', { code, ...modifiers });

const shift = { shiftKey: true };

/** The gate's inputs for a match in progress with nothing open. */
const context = (overrides: Partial<HotkeyGateContext> = {}): HotkeyGateContext => ({
	dashOpen: false,
	interfaceViewOpen: false,
	scoreboardOpen: false,
	...overrides,
});

describe('isAudioModeHotkey', () => {
	test('claims bare A only', () => {
		expect(isAudioModeHotkey(key('KeyA'))).toBe(true);
		expect(isAudioModeHotkey(key('KeyA', shift))).toBe(false);
	});
});

describe('isUtilityHotkey', () => {
	// The reported bug: pressing A to step through the audio modes did nothing
	// during a bot match. `game.freezedInput` is true for every ability
	// animation and animation-queue drain, which is most of what a bot does,
	// and bare A was missing from the list of keys that survive it.
	test('lets bare A cycle the audio mode while input is frozen', () => {
		expect(isUtilityHotkey(key('KeyA'), context())).toBe(true);
	});

	// With the dash open the same key is `gridSelectLeft`, i.e. board
	// navigation. It has to answer to the freeze exactly like the arrow keys,
	// or a frozen turn would accept a move the hex grid refuses.
	test('withholds bare A while the dash is open', () => {
		expect(isUtilityHotkey(key('KeyA'), context({ dashOpen: true }))).toBe(false);
	});

	test('keeps the audio view toggle live, dashed or not', () => {
		// Shift+A opens the music player, which is a view and never board input.
		expect(isUtilityHotkey(key('KeyA', shift), context({ dashOpen: true }))).toBe(true);
	});

	test('keeps the other board-free hotkeys live', () => {
		// F11, Shift+F, Shift+T / Shift+S / Shift+D, the combat log, the
		// meta-powers panel, the log save shortcut and the meta-powers chord.
		for (const event of [
			key('F11'),
			key('KeyF', shift),
			key('KeyT'),
			key('KeyS', shift),
			key('KeyD', shift),
			key('Backquote'),
			key('Backspace'),
			key('KeyX', { shiftKey: true, ctrlKey: true }),
			key('KeyP', { metaKey: true, altKey: true }),
		]) {
			expect(isUtilityHotkey(event, context())).toBe(true);
		}
	});

	test('does not let gameplay keys through', () => {
		// Ability buttons, grid navigation, hex confirmation, delay/skip and
		// the meta-power number keys all act on the board or the turn.
		for (const code of ['KeyQ', 'KeyW', 'KeyE', 'KeyS', 'KeyR', 'ArrowUp', 'Space', 'Digit1']) {
			expect(isUtilityHotkey(key(code), context())).toBe(false);
		}
	});

	test('treats Escape as live only once a view is open', () => {
		expect(isUtilityHotkey(key('Escape'), context())).toBe(false);
		expect(isUtilityHotkey(key('Escape'), context({ interfaceViewOpen: true }))).toBe(true);
	});

	test('treats the scoreboard actions as live only while the scoreboard is open', () => {
		// Bare R/S/X double as ability, skip-turn and exit outside the
		// scoreboard, so they stay frozen-gated there.
		for (const code of ['KeyR', 'KeyS', 'KeyX']) {
			expect(isUtilityHotkey(key(code), context())).toBe(false);
			expect(isUtilityHotkey(key(code), context({ scoreboardOpen: true }))).toBe(true);
		}
	});
});

describe('isScoreboardHotkey', () => {
	test('keeps scoreboard actions, view switching, fullscreen and Escape', () => {
		for (const event of [
			key('Escape'),
			key('KeyS'),
			key('KeyR'),
			key('KeyX'),
			key('KeyT'),
			key('KeyS', shift),
			key('KeyA', shift),
			key('KeyD', shift),
			key('KeyF', shift),
		]) {
			expect(isScoreboardHotkey(event)).toBe(true);
		}
	});

	test('rejects the keys the scoreboard has no business answering', () => {
		// The scoreboard filter runs first and stops everything that is not
		// listed above — including bare A, which stays a gameplay-position key
		// there even though it cycles audio everywhere else.
		for (const code of ['KeyA', 'KeyQ', 'KeyW', 'KeyE', 'Space', 'Backquote']) {
			expect(isScoreboardHotkey(key(code))).toBe(false);
		}
	});
});
