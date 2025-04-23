export class Fullscreen {
	private button: HTMLElement;

	constructor(button: HTMLElement, isFullscreen = false) {
		this.button = button;
		if (isFullscreen) {
			button.classList.add('fullscreenMode');
		}

		document.addEventListener('fullscreenchange', () => this.updateButtonState());
		window.addEventListener('resize', () => this.updateButtonState());
	}

	updateButtonState() {
		const isFullscreen = this.isFullscreenMode();

		if (isFullscreen) {
			this.button.classList.add('fullscreenMode');
			this.button
				.querySelectorAll('.fullscreen__title')
				.forEach((el) => (el.textContent = 'Contract'));
		} else {
			this.button.classList.remove('fullscreenMode');
			this.button
				.querySelectorAll('.fullscreen__title')
				.forEach((el) => (el.textContent = 'FullScreen'));
		}
	}

	isFullscreenMode() {
		return isAppInNativeFullscreenMode() || window.innerHeight === screen.height;
	}

	toggle() {
		if (isAppInNativeFullscreenMode()) {
			this.button.classList.remove('fullscreenMode');
			this.button
				.querySelectorAll('.fullscreen__title')
				.forEach((el) => (el.textContent = 'FullScreen'));
			document.exitFullscreen();
		} else if (!isAppInNativeFullscreenMode() && window.innerHeight === screen.height) {
			const f11Event = new KeyboardEvent('keydown', {
				key: 'F11',
				code: 'F11',
				keyCode: 122,
				which: 122,
			});
			window.dispatchEvent(f11Event);
		} else {
			this.button.classList.add('fullscreenMode');
			this.button
				.querySelectorAll('.fullscreen__title')
				.forEach((el) => (el.textContent = 'Contract'));
			document.getElementById('AncientBeast').requestFullscreen();
		}
	}
}

/**
 * @returns {boolean} true if app is currently in [fullscreen mode using the native API](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API), else false.
 */
function isAppInNativeFullscreenMode(): boolean {
	// NOTE: These properties were vendor-prefixed until very recently.
	// Keeping vendor prefixes, though they make TS report an error.
	return (
		// @ts-expect-error 2551
		document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement
	);
}
