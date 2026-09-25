const FULLSCREEN_VIEW_CLASS = 'interface-view-open';

const isOpen = (selector: string, openClass: string) =>
	document.querySelector(selector)?.classList.contains(openClass) ?? false;

const isVisible = (selector: string, hiddenClass: string) => {
	const view = document.querySelector(selector);
	return view !== null && !view.classList.contains(hiddenClass);
};

/**
 * Keep the gameplay HUD visually quiet while a full-screen interface view is open.
 *
 * Full-screen views live alongside the HUD in `#ui`, so their modal backdrop is not
 * enough to stop the fixed panels from competing for attention. The class is applied
 * to the shared root instead of each individual view, which also makes view switches
 * restore the HUD reliably.
 */
export const syncFullscreenViewHud = () => {
	const ui = document.getElementById('ui');
	if (!ui) {
		return false;
	}

	const fullscreenViewOpen =
		isOpen('#dash', 'active') ||
		isVisible('#scoreboard', 'hide') ||
		isVisible('#musicplayerwrapper', 'hide') ||
		isVisible('#meta-powers', 'hide') ||
		document.getElementById('ab-secret-view')?.style.display === 'flex';

	ui.classList.toggle(FULLSCREEN_VIEW_CLASS, fullscreenViewOpen);
	return fullscreenViewOpen;
};
