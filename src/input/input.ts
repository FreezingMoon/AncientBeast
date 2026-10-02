import type Phaser from 'phaser';

/**
 * AB's input layer: one place that owns the rules about what counts as a
 * gesture, what the board considers hovered, and when input is allowed at all.
 *
 * This is not a re-implementation of Phaser's input. Phaser already hit-tests and
 * dispatches; what it does not know is Ancient Beast's rules — that a right-click
 * which began on a DOM overlay is not a board gesture, that hovering must be
 * remembered so it can be re-evaluated when a frozen turn thaws, and that a click
 * during the opponent's turn should show a wait cursor rather than doing nothing.
 * Those rules were scattered across the Phaser 2 CE adapter and four call sites;
 * they live here now.
 */

type GameObject = Phaser.GameObjects.GameObject;
type Scene = Phaser.Scene;

/**
 * What these helpers need from a game object.
 *
 * Deliberately structural, and deliberately satisfied by an adapter handle as
 * well as a real Phaser 4 game object: the handle's proxy forwards `on` and
 * `input` straight to the object it wraps, so the helpers work on both. Typing
 * the parameter as the concrete Phaser class instead would force every call site
 * to unwrap, and would break the unit suites, which have neither.
 */
export interface InteractiveTarget {
	on(event: string, handler: (...args: any[]) => void, context?: unknown): unknown;
	input?: {
		cursor?: string;
		hitArea?: unknown;
		hitAreaCallback?: (hitArea: unknown, x: number, y: number, gameObject?: unknown) => boolean;
		customHitArea?: boolean;
	} | null;
}

/** Middle button, as Phaser reports it. */
const MIDDLE_BUTTON = 1;
/** Right button, as Phaser reports it. */
const RIGHT_BUTTON = 2;

/**
 * The parts of `Phaser.Input.Pointer` this module and its callers rely on.
 *
 * Structural rather than the concrete class so the test suites and the headless
 * runner can stand in a pointer without constructing Phaser input state.
 */
export interface BoardPointer {
	button?: number;
	downElement?: unknown;
}

// ─── Gesture recognition ─────────────────────────────────────────────────────

/**
 * Whether a pointer event began on the game canvas.
 *
 * Phaser attaches its mouse handlers to the window, not the canvas, so a
 * right-click on a DOM overlay — the scoreboard, the music player — reaches
 * canvas listeners as a normal pointer event: the mousedown is consumed by the
 * overlay, the pointer never records a canvas downElement, and the subsequent
 * mouseup is hit-tested against canvas coordinates. The board would then open a
 * creature card from a click the user made on the scoreboard.
 *
 * A genuine board gesture always has a canvas downElement, so requiring one is
 * what separates the two. Only the secondary buttons need this: a left-click on
 * an overlay is already swallowed by the overlay, and the default button is used
 * for touch, where `downElement` handling differs.
 */
export function isCanvasGesture(pointer: BoardPointer | null | undefined): boolean {
	if (!pointer || typeof pointer !== 'object') {
		return false;
	}
	if (pointer.button !== RIGHT_BUTTON && pointer.button !== MIDDLE_BUTTON) {
		return true;
	}
	const element = pointer.downElement as { tagName?: string } | undefined;
	return Boolean(element && element.tagName === 'CANVAS');
}

// ─── Subscriptions ───────────────────────────────────────────────────────────

/**
 * Subscribe to a pointer event on a game object, applying AB's gesture rules.
 *
 * The handler receives Phaser's own `(pointer, localX, localY)` arguments. The
 * adapter used to re-order these to Phaser 2 CE's `(sprite, pointer, …)`; there
 * is no reason to keep the old shape, and preserving it would have meant every
 * migrated handler taking a first argument it never used.
 */
function subscribe(
	gameObject: InteractiveTarget | null | undefined,
	event: string,
	handler: (pointer: BoardPointer, localX: number, localY: number) => void,
): void {
	if (!gameObject || typeof gameObject.on !== 'function') {
		return;
	}
	gameObject.on(event, (pointer: unknown, localX: number, localY: number) => {
		if (!isCanvasGesture(pointer as BoardPointer)) {
			return;
		}
		handler(pointer as BoardPointer, localX, localY);
	});
}

/** Subscribe to pointer-up on a game object. */
export function onPointerUp(
	gameObject: InteractiveTarget | null | undefined,
	handler: (pointer: BoardPointer, localX: number, localY: number) => void,
): void {
	subscribe(gameObject, 'pointerup', handler);
}

/** Subscribe to pointer-down on a game object. */
export function onPointerDown(
	gameObject: InteractiveTarget | null | undefined,
	handler: (pointer: BoardPointer, localX: number, localY: number) => void,
): void {
	subscribe(gameObject, 'pointerdown', handler);
}

/** Subscribe to pointer-over on a game object. */
export function onPointerOver(
	gameObject: InteractiveTarget | null | undefined,
	handler: (pointer: BoardPointer, localX: number, localY: number) => void,
): void {
	subscribe(gameObject, 'pointerover', handler);
}

/** Subscribe to pointer-out on a game object. */
export function onPointerOut(
	gameObject: InteractiveTarget | null | undefined,
	handler: (pointer: BoardPointer, localX: number, localY: number) => void,
): void {
	subscribe(gameObject, 'pointerout', handler);
}

// ─── Pointer-inside-the-board tracking ───────────────────────────────────────

/**
 * Whether the pointer is currently over the game canvas.
 *
 * Phaser 2 CE published this as `pointer.withinGame`; Phaser 4 dropped it and
 * exposes the boundary as scene events instead. Hex hover-out has to distinguish
 * "moved to the next hex" from "left the board entirely" — the first clears
 * dashed overlays and the second only tidies up, without touching the board's
 * reachable highlighting — so the distinction has to survive the migration.
 */
let pointerWithinBoard = true;

export function isPointerWithinBoard(): boolean {
	return pointerWithinBoard;
}

/** Reset the boundary state. Called on teardown and between matches. */
export function resetPointerWithinBoard(): void {
	pointerWithinBoard = true;
}

/**
 * Track the pointer crossing the canvas boundary from the scene's input events.
 *
 * Returns a teardown function. Without a scene — the unit suites, the headless
 * runner — the state simply stays at its default, which is what those paths
 * already assumed.
 */
export function trackPointerWithinBoard(scene: Scene | null | undefined): () => void {
	const input = scene?.input;
	if (!input || typeof input.on !== 'function') {
		return () => {};
	}
	const onOver = () => {
		pointerWithinBoard = true;
	};
	const onOut = () => {
		pointerWithinBoard = false;
	};
	input.on('gameover', onOver);
	input.on('gameout', onOut);
	return () => {
		input.off('gameover', onOver);
		input.off('gameout', onOut);
	};
}

// ─── Hovered-hex tracking ────────────────────────────────────────────────────

/**
 * The hex the pointer is over, if any.
 *
 * Tracked even while input is frozen, so that clearing the freeze can
 * re-evaluate the hover the player already has rather than waiting for them to
 * move the mouse. The pointer position is the source of truth here; the hover
 * visuals are the thing that has to be rebuilt, and they are.
 */
let hoveredHex: unknown;

export function setHoveredHex(hex: unknown): void {
	hoveredHex = hex ?? undefined;
}

export function getHoveredHex(): unknown {
	return hoveredHex;
}

export function clearHoveredHex(): void {
	hoveredHex = undefined;
}

/** Test-only: clear hover state without knowing the module's internals. */
export function resetHoveredHexForTest(): void {
	clearHoveredHex();
}

// ─── The input gate ──────────────────────────────────────────────────────────

/** The slice of `Game` this module needs, so it does not depend on the class. */
export interface InputGateSource {
	freezedInput: boolean;
	botController?: { isBotTurn?: () => boolean } | null;
}

/**
 * Whether the local player may act right now.
 *
 * A turn is frozen during animations, replays, and the opponent's turn. Every
 * board handler has to check this before doing anything visible, because the
 * interesting failure is not "the action is refused" — handlers here return
 * quietly — it is that a frozen turn which does not answer leaves the cursor
 * showing a hand over a board that is not accepting input.
 */
export function isInputAccepted(game: InputGateSource | null | undefined): boolean {
	if (!game) {
		return false;
	}
	if (game.freezedInput) {
		return false;
	}
	return !game.botController?.isBotTurn?.();
}

/** Set the board cursor to the browser's wait cursor. */
export function showWaitingCursor(): void {
	if (typeof document !== 'undefined') {
		const canvas = document.querySelector('canvas');
		if (canvas) {
			canvas.style.cursor = 'wait';
		}
	}
}

/**
 * The standard turn guard.
 *
 * Returns `true` when the handler should stop. This collapsed four copies of
 * the same three-line check — frozen, or the bot's turn, so show `wait` and
 * return — that had drifted apart across the hex handlers and the board backdrop.
 */
export function rejectIfTurnFrozen(game: InputGateSource | null | undefined): boolean {
	if (isInputAccepted(game)) {
		return false;
	}
	showWaitingCursor();
	return true;
}
