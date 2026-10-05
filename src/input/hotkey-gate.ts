/**
 * Which keys are allowed through the in-game hotkey gate.
 *
 * A keydown reaches its handler in `Hotkeys` only after passing two filters:
 * the scoreboard filter, which keeps just the actions that belong to the open
 * scoreboard, and the frozen-input filter, which keeps just the keys that do
 * not act on the board. `game.freezedInput` goes true for animations, replays
 * and another seat's turn, so during a bot match most of the match is spent
 * frozen and anything left out of these lists reads as a dead key.
 *
 * These predicates are the single source of truth for both filters, kept pure
 * and apart from `UI` so a new hotkey cannot be wired up without a decision
 * here — the drift this module exists to prevent is exactly what made `A`
 * (audio mode) silently stop working once a bot started resolving abilities.
 */

/** What a keydown cannot be classified without: the views currently showing. */
export interface HotkeyGateContext {
	/** Whether the dash view is open, i.e. the board is taking movement input. */
	dashOpen: boolean;
	/** Whether any interface view — the combat log included — is showing. */
	interfaceViewOpen: boolean;
	/** Whether the scoreboard is showing. */
	scoreboardOpen: boolean;
}

const hasNoModifierKeys = (event: KeyboardEvent) =>
	!event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey;

/** Shift alone: the modifier the view-switching hotkeys are built on. */
const isShiftOnly = (event: KeyboardEvent) =>
	event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey;

export const isFullscreenHotkey = (event: KeyboardEvent) =>
	event.code === 'KeyF' && isShiftOnly(event);

export const isDashViewHotkey = (event: KeyboardEvent) =>
	event.code === 'KeyD' && isShiftOnly(event);

export const isScoreViewHotkey = (event: KeyboardEvent) =>
	(event.code === 'KeyT' && hasNoModifierKeys(event)) ||
	(event.code === 'KeyS' && isShiftOnly(event));

/** Shift+A, which opens and closes the audio view. */
export const isAudioViewHotkey = (event: KeyboardEvent) =>
	event.code === 'KeyA' && isShiftOnly(event);

export const isViewSwitchHotkey = (event: KeyboardEvent) =>
	isDashViewHotkey(event) || isScoreViewHotkey(event) || isAudioViewHotkey(event);

export const isScoreboardActionHotkey = (event: KeyboardEvent) =>
	(event.code === 'KeyS' || event.code === 'KeyR' || event.code === 'KeyX') &&
	hasNoModifierKeys(event);

/**
 * Bare `A`, which cycles the audio mode full → sfx → muted.
 *
 * Mirrors `Hotkeys#pressA`, which reads anything but Shift as the audio cycle;
 * the dash branch is the part that decides whether that cycle happens, and
 * lives in {@link isUtilityHotkey}.
 */
export const isAudioModeHotkey = (event: KeyboardEvent) => event.code === 'KeyA' && !event.shiftKey;

/**
 * Keys the open scoreboard still answers: closing it, switching views,
 * fullscreen, and the actions the scoreboard itself owns.
 */
export const isScoreboardHotkey = (event: KeyboardEvent) =>
	event.code === 'Escape' ||
	isViewSwitchHotkey(event) ||
	isFullscreenHotkey(event) ||
	isScoreboardActionHotkey(event);

/**
 * Keys that stay live while `game.freezedInput` is true, because none of them
 * act on the board: view toggles, fullscreen, the combat log, and the score
 * actions of an open scoreboard.
 *
 * Bare `A` belongs here for the same reason the audio button carries
 * `overridefreeze` — cycling the mode only moves volume and the icon, so a
 * frozen turn is exactly when a player reaches for it. It is withheld while
 * the dash is open, where the same key moves the grid cursor instead and has
 * to answer to the freeze like the arrow keys do.
 */
export const isUtilityHotkey = (event: KeyboardEvent, context: HotkeyGateContext): boolean =>
	event.code === 'F11' ||
	isFullscreenHotkey(event) ||
	isViewSwitchHotkey(event) ||
	(event.code === 'Escape' && context.interfaceViewOpen) ||
	(isScoreboardActionHotkey(event) && context.scoreboardOpen) ||
	(event.code === 'KeyX' && event.shiftKey && event.ctrlKey && !event.metaKey && !event.altKey) ||
	event.code === 'Backquote' ||
	event.code === 'Backspace' ||
	(event.code === 'KeyP' && event.metaKey && event.altKey && !event.ctrlKey && !event.shiftKey) ||
	(isAudioModeHotkey(event) && !context.dashOpen);
