// Declare namespace for augmenting global types
declare global {
	interface Document {
		webkitFullscreenElement?: Element | null;
		mozFullScreenElement?: Element | null;
		webkitExitFullscreen?: () => Promise<void>;
	}

	interface HTMLElement {
		webkitRequestFullscreen?: () => Promise<void>;
	}
}

export class Fullscreen {
	private button: HTMLElement;

	constructor(button: HTMLElement, isFullscreen = false) {
		this.button = button;
		if (isFullscreen) {
			button.classList.add('fullscreenMode');
		}
	}

	toggle() {
		// Check if running on iOS
		const isIOS =
			/iPad|iPhone|iPod/.test(navigator.userAgent) ||
			(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

		if (isAppInNativeFullscreenMode()) {
			this.button.classList.remove('fullscreenMode');
			this.button
				.querySelectorAll('.fullscreen__title')
				.forEach((el) => (el.textContent = 'FullScreen'));

			// Exit fullscreen with iOS compatibility
			if (document.exitFullscreen) {
				document.exitFullscreen();
			} else if (document.webkitExitFullscreen) {
				document.webkitExitFullscreen();
			}
		} else if (!isAppInNativeFullscreenMode() && window.innerHeight === screen.height) {
			alert('Use F11 to exit fullscreen');
		} else {
			this.button.classList.add('fullscreenMode');
			this.button
				.querySelectorAll('.fullscreen__title')
				.forEach((el) => (el.textContent = 'Contract'));

			const gameElement = document.getElementById('AncientBeast');

			// Handle iOS fullscreen or fallback to standard methods
			if (isIOS) {
				// iOS Safari doesn't support standard fullscreen API
				// Apply CSS to mimic fullscreen
				if (gameElement) {
					this.applyIOSFullscreen(gameElement);
				}
			} else {
				// Standard fullscreen API with vendor prefixes
				if (gameElement && gameElement.requestFullscreen) {
					gameElement.requestFullscreen();
				} else if (gameElement && gameElement.webkitRequestFullscreen) {
					gameElement.webkitRequestFullscreen();
				}
			}
		}
	}

	private applyIOSFullscreen(element: HTMLElement) {
		// Save current body overflow setting
		const originalOverflow = document.body.style.overflow;
		const originalPosition = document.body.style.position;

		// Apply fullscreen-like styles
		document.body.style.overflow = 'hidden';
		document.body.style.position = 'fixed';
		document.body.style.width = '100%';
		document.body.style.height = '100%';

		element.style.position = 'fixed';
		element.style.top = '0';
		element.style.left = '0';
		element.style.width = '100%';
		element.style.height = '100%';
		element.style.zIndex = '9999';

		// Add event listener to exit iOS fullscreen on button click
		const exitIOSFullscreen = () => {
			document.body.style.overflow = originalOverflow;
			document.body.style.position = originalPosition;

			element.style.position = '';
			element.style.top = '';
			element.style.left = '';
			element.style.width = '';
			element.style.height = '';
			element.style.zIndex = '';

			this.button.removeEventListener('click', exitIOSFullscreen);
		};

		this.button.addEventListener('click', exitIOSFullscreen);
	}
}

/**
 * @returns {boolean} true if app is currently in [fullscreen mode using the native API](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API), else false.
 */
function isAppInNativeFullscreenMode(): boolean {
	// Check for fullscreen with vendor prefixes
	return Boolean(
		document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement,
	);
}
