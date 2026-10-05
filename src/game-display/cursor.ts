/**
 * What these helpers need from a game object.
 *
 * Structural so that an adapter handle works here too: its proxy forwards
 * `input` to the Phaser object it wraps. Typing it as the concrete Phaser class
 * would force every caller to unwrap, and would not typecheck in the unit
 * suites, which run without Phaser loaded.
 */
export interface CursorTarget {
	input?: { cursor?: string } | null;
}

/**
 * Cursor names and the CSS/game-object helpers that apply them.
 *
 * Ancient Beast drives the cursor from two places that used to be separate:
 * per-object intent (`input.useHandCursor`, Phaser 2 CE) and the board itself
 * (`$j('canvas').css('cursor', …)`, because the hover handlers need to express
 * more than "hand" — `n-resize` over an unreachable unit, `progress` while a
 * unit has no action left, `wait` on the opponent's turn).
 *
 * Phaser 4 has one mechanism: `gameObject.input.cursor`, which takes a CSS
 * cursor string. `'pointer'` is the hand cursor, so the old boolean maps onto a
 * named string. Everything else stays a CSS name, which means the two paths
 * converge here rather than each having its own vocabulary.
 */

/** Phaser 4's name for the hand cursor. */
export const HAND_CURSOR = 'pointer';

/** Phaser 4's neutral cursor. */
export const DEFAULT_CURSOR = 'default';

/**
 * Set — or clear — the hand cursor on a game object.
 *
 * `false` restores the object's neutral cursor rather than blanking it, because
 * Phaser only re-applies `input.cursor` on a pointer transition it observes; an
 * object that was left on `'pointer'` keeps showing a hand after the intent is
 * withdrawn.
 */
export function setHandCursor(gameObject: CursorTarget | undefined | null, enabled: boolean): void {
	const input = gameObject?.input;
	if (!input) {
		return;
	}
	input.cursor = enabled ? HAND_CURSOR : DEFAULT_CURSOR;
}

/** Whether a game object is currently showing the hand cursor. */
export function hasHandCursor(gameObject: CursorTarget | undefined | null): boolean {
	const input = gameObject?.input;
	return input?.cursor === HAND_CURSOR;
}

/** Every cursor name the board uses, as a CSS `cursor` value. */
export type BoardCursor =
	| 'default'
	| 'pointer'
	| 'wait'
	| 'progress'
	| 'not-allowed'
	| 'n-resize'
	| 's-resize'
	| 'help'
	| 'no-drop'
	| 'alias';

/**
 * The cursor to show for a hover, given whether it is the local player's turn.
 *
 * Multiplayer replaces the board's cursor with `wait` on the opponent's turn, so
 * every hover that would otherwise set a cursor has to route through here or the
 * `wait` gets overwritten by the hover that follows it.
 */
export function cursorForTurn(cursor: BoardCursor, isLocalPlayerTurn: boolean): string {
	return isLocalPlayerTurn ? cursor : 'wait';
}
