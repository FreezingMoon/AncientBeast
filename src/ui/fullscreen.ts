export class Fullscreen {
	private button: HTMLElement;
	private fullscreenElementId = 'AncientBeast';

	constructor(button: HTMLElement, isFullscreen = false) {
		this.button = button;
		if (isFullscreen) {
			button.classList.add('fullscreenMode');
		}
		this.preventEscExit();
	}

	toggle() {
		if (isAppInNativeFullscreenMode()) {
			this.button.classList.remove('fullscreenMode');
			this.button
				.querySelectorAll('.fullscreen__title')
				.forEach((el) => (el.textContent = 'FullScreen'));
			document.exitFullscreen();
		} else if (!isAppInNativeFullscreenMode() && window.innerHeight === screen.height) {
			alert('Use F11 to exit fullscreen');
		} else {
			this.enterFullscreen();
		}
	}

	private enterFullscreen() {
		this.button.classList.add('fullscreenMode');
		this.button
			.querySelectorAll('.fullscreen__title')
			.forEach((el) => (el.textContent = 'Contract'));
		document.getElementById(this.fullscreenElementId)?.requestFullscreen();
	}

	private preventEscExit() {
		document.addEventListener('fullscreenchange', () => {
			if (!isAppInNativeFullscreenMode()) {
				this.enterFullscreen();
			}
		});

		document.addEventListener('keydown', (event) => {
			if (event.key === 'Escape' || event.key === 'Esc') {
				event.preventDefault();
			}
		});
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
