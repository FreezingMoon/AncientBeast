import { getPhaser } from '../phaser/runtime';
import type Phaser from 'phaser';

type ScaleManager = Phaser.Scale.ScaleManager;

/**
 * Whether the board should be laid out against the window.
 *
 * A viewport narrower than 600px or shorter than 700px is treated as a phone in
 * portrait, where the board is drawn at its authored size and the page scrolls
 * rather than the canvas being letterboxed into a sliver. This threshold is AB's
 * own idea of "small enough to be a phone"; Phaser has no equivalent concept.
 */
export function viewportTakesFullWindow(): boolean {
	return window.innerWidth > 600 || window.innerHeight > 700;
}

/**
 * Put the board's scale into the state a match expects.
 *
 * `createGameConfig` already sets `Scale.FIT` with centring, so this repeats it
 * rather than trusting it: a rematch reuses the game instance whose scale manager
 * was last touched by `applyPortraitMode`, and the two disagree by design.
 *
 * Centring and window-parenting are one setting in Phaser 4 (`autoCenter`), not
 * the separate horizontal and vertical flags the old engine adapter carried. AB
 * set both to the same value everywhere, so collapsing them changes nothing.
 */
export function applyBoardScale(scale: ScaleManager | null | undefined): void {
	if (!scale) {
		return;
	}

	const { Scale } = getPhaser();
	const fillWindow = viewportTakesFullWindow();

	scale.parentIsWindow = fillWindow;
	scale.autoCenter = fillWindow ? Scale.CENTER_BOTH : Scale.NO_CENTER;
	scale.scaleMode = Scale.FIT;
	scale.refresh();
}

/**
 * Apply the portrait-viewport rules, which deliberately disagree with
 * {@link applyBoardScale}: in portrait the canvas keeps its authored size, is
 * detached from the window, and is left for the CSS shell's `portrait-mode`
 * layout to place — so the board stays legible instead of shrinking into a
 * strip between the phone's system bars and the page chrome.
 *
 * `isPortrait` is passed in rather than measured here — the CSS side decides what
 * portrait means with a media query, and the engine and the page have to agree or
 * the canvas ends up under the wrong panel.
 */
export function applyPortraitScale(
	scale: ScaleManager | null | undefined,
	isPortrait: boolean,
): void {
	if (!scale) {
		return;
	}

	const { Scale } = getPhaser();

	scale.parentIsWindow = !isPortrait;
	scale.autoCenter = isPortrait ? Scale.NO_CENTER : Scale.CENTER_BOTH;
	scale.refresh();
}

/** Re-run the scale manager's layout pass, e.g. after a window resize. */
export function refreshScale(scale: ScaleManager | null | undefined): void {
	scale?.refresh();
}
