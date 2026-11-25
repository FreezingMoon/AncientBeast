/**
 * Auto-hides the board cursor after a spell of pointer inactivity.
 *
 * This only runs in "bot only" matches — the local player is the sole human at
 * the table and the rest are AI, so long stretches of a turn are spent simply
 * watching the bot play. Blanking the pointer after a few seconds of no movement
 * gives that stretch a "watching video" feel; any nudge of the mouse restores it.
 *
 * The cursor is blanked by toggling {@link CURSOR_HIDDEN_CLASS} on the document
 * body and the game canvas. That class carries `cursor: none !important`, so it
 * wins over the inline `cursor` values the board's hover handlers and turn-state
 * logic keep writing (`pointer`, `wait`, `n-resize`, …). Removing the class lets
 * those values come back untouched on the next hover or turn change, so the
 * auto-hider never has to know what the "right" cursor for a moment is — it only
 * has to know when to step aside.
 */

/** Delay, in milliseconds, of inactivity before the cursor is blanked. */
export const CURSOR_HIDE_DELAY_MS = 3000;

/** CSS class that forces `cursor: none`, overriding inline cursor styles. */
export const CURSOR_HIDDEN_CLASS = 'ab-cursor-hidden';

/** The elements whose cursor the auto-hider toggles. */
const CURSOR_TARGETS = 'body, canvas';

/**
 * The live auto-hide state.
 *
 * Kept module-local (a singleton, like the pointer-within-board tracking in
 * `src/input/input.ts`) because the browser runs exactly one game at a time and
 * `Game` owns the start/stop cadence across setup and teardown.
 */
let timer: ReturnType<typeof setTimeout> | null = null;
let active = false;

function hasDom(): boolean {
	return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function clearHideTimer(): void {
	if (timer) {
		clearTimeout(timer);
		timer = null;
	}
}

function hideCursor(): void {
	if (!hasDom()) {
		return;
	}
	document.querySelectorAll<HTMLElement>(CURSOR_TARGETS).forEach((el) => {
		el.classList.add(CURSOR_HIDDEN_CLASS);
	});
}

function revealCursor(): void {
	if (!hasDom()) {
		return;
	}
	document.querySelectorAll<HTMLElement>(CURSOR_TARGETS).forEach((el) => {
		el.classList.remove(CURSOR_HIDDEN_CLASS);
	});
}

/**
 * Restore the cursor and restart the inactivity countdown.
 *
 * Wired to pointer movement: a single mouse nudge while the cursor is hidden
 * brings it back, and re-arms the timer so it fades out again a few seconds
 * after the next lull.
 */
function onPointerMove(): void {
	if (!active) {
		return;
	}
	revealCursor();
	clearHideTimer();
	timer = setTimeout(hideCursor, CURSOR_HIDE_DELAY_MS);
}

/**
 * Stop tracking pointer inactivity and reveal the cursor immediately.
 *
 * Safe to call when inactive (no-op), so `Game` can call it on teardown without
 * first checking whether the feature was ever started.
 */
export function stopCursorAutoHide(): void {
	if (!active) {
		return;
	}
	active = false;
	clearHideTimer();
	revealCursor();
	window.removeEventListener('pointermove', onPointerMove);
}

/**
 * Track pointer inactivity and blank the cursor when it runs out.
 *
 * Returns a teardown function (mirrors the `trackPointerWithinBoard` seam in
 * `src/input/input.ts`) so callers can release the listener without importing
 * the module's private state.
 */
export function startCursorAutoHide(): () => void {
	if (active) {
		// Already running in this match; returning a no-op teardown keeps the
		// start/stop pairing balanced if setup() fires more than once.
		return () => undefined;
	}
	active = true;
	clearHideTimer();
	timer = setTimeout(hideCursor, CURSOR_HIDE_DELAY_MS);
	window.addEventListener('pointermove', onPointerMove);
	return stopCursorAutoHide;
}
