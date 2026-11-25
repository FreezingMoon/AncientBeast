/**
 * HUD sync for full-screen interface views (issue #2092).
 *
 * When a full-screen view (dash, scoreboard, music player, meta powers,
 * hotkeys) opens over combat mode, the gameplay HUD sitting behind it is
 * just clutter, so it fades well back. The dim state keys off each view's
 * own open state (re-checked after every open/close path) instead of a flag
 * set at individual call sites, so no close path can leave the HUD stuck dim.
 *
 * The HUD elements live in different parents (`#bottompanel` nests the side
 * panels; `#chat` and the hover panel sit beside them), hence the explicit
 * selector list rather than a single container rule.
 */

const DIM_CLASS = 'interface-view-open';

function viewOpen(selector: string, openClass: string): boolean {
	const view = document.querySelector(selector);
	return view !== null && view.classList.contains(openClass);
}

function wrapperVisible(selector: string): boolean {
	const view = document.querySelector(selector);
	return view !== null && !view.classList.contains('hide');
}

/**
 * Re-check every full-screen view and dim or restore the HUD accordingly.
 * Safe to call when `#ui` is absent (returns false); safe to call on every
 * open/close path since it derives state instead of toggling blindly.
 */
export function syncFullscreenViewHud(): boolean {
	const ui = document.getElementById('ui');
	if (!ui) {
		return false;
	}

	const fullscreenViewOpen =
		viewOpen('#dash', 'active') ||
		wrapperVisible('#scoreboard') ||
		wrapperVisible('#musicplayerwrapper') ||
		wrapperVisible('#meta-powers') ||
		wrapperVisible('#hotkeys');

	ui.classList.toggle(DIM_CLASS, fullscreenViewOpen);
	return fullscreenViewOpen;
}
