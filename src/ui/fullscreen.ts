export class Fullscreen {
	private button: HTMLElement;

	constructor(button: HTMLElement, isFullscreen = false) {
		this.button = button;
		if (isFullscreen) {
			button.classList.add('fullscreenMode');
		}
		if (window.innerHeight === screen.height) {
			this.button.style.pointerEvents = 'none';
			this.button.style.opacity = '0.3';
			return;
		}
	}

	toggle() {
		if (isAppInNativeFullscreenMode()) {
			this.button.classList.remove('fullscreenMode');
			this.button
				.querySelectorAll('.fullscreen__title')
				.forEach((el) => (el.textContent = 'FullScreen'));
			document.exitFullscreen();
			return;
		}
		this.button.classList.add('fullscreenMode');
		this.button
			.querySelectorAll('.fullscreen__title')
			.forEach((el) => (el.textContent = 'Contract'));
		document.getElementById('AncientBeast').requestFullscreen();
	}
}

/**
 * @returns {boolean} true if app is currently in [fullscreen mode using the native API](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API), else false.
 */
function isAppInNativeFullscreenMode(): boolean {
	return !!(
		document.fullscreenElement ||
		// @ts-expect-error 2551
		document.webkitFullscreenElement ||
		// @ts-expect-error 2551
		document.mozFullScreenElement ||
		// @ts-expect-error 2551
		document.msFullscreenElement
	);
}
