// Define interfaces for vendor prefixed fullscreen methods
interface DocumentWithFullscreen extends Document {
	webkitFullscreenElement?: Element;
	mozFullScreenElement?: Element;
	msFullscreenElement?: Element;
	webkitExitFullscreen?: () => Promise<void>;
	mozCancelFullScreen?: () => Promise<void>;
	msExitFullscreen?: () => Promise<void>;
}

interface ElementWithFullscreen extends Element {
	webkitRequestFullscreen?: () => Promise<void>;
	mozRequestFullScreen?: () => Promise<void>;
	msRequestFullscreen?: () => Promise<void>;
}

interface WindowWithMSStream extends Window {
	MSStream?: unknown;
}

export class Fullscreen {
	public button: HTMLElement;
	private isIOS: boolean;

	constructor(button: HTMLElement, isFullscreen = false) {
		this.button = button;
		this.isIOS =
			/iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as WindowWithMSStream).MSStream;

		if (isFullscreen) {
			button.classList.add('fullscreenMode');
		}
		// Add listener for fullscreen changes to update UI state
		document.addEventListener('fullscreenchange', () => this.updateButtonState());
		document.addEventListener('webkitfullscreenchange', () => this.updateButtonState());
		document.addEventListener('mozfullscreenchange', () => this.updateButtonState());
	}

	toggle() {
		if (this.isFullscreen()) {
			this.exitFullscreen();
		} else {
			this.requestFullscreen();
		}

		// Update button state after a short delay
		setTimeout(() => this.updateButtonState(), 100);
	}

	// Check if the app is currently in fullscreen mode
	isFullscreen(): boolean {
		// For iOS devices, we check our custom class
		if (this.isIOS && document.documentElement.classList.contains('ios-fullscreen')) {
			return true;
		}

		// For standard browsers
		const doc = document as DocumentWithFullscreen;
		return !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement);
	}

	// Request fullscreen with vendor prefix handling
	requestFullscreen() {
		const gameElement = document.getElementById('AncientBeast');
		if (!gameElement) return;

		try {
			const element = gameElement as ElementWithFullscreen;
			// Try standard method first
			if (element.requestFullscreen) {
				element.requestFullscreen();
			}
			// Then try vendor prefixed versions
			else if (element.webkitRequestFullscreen) {
				element.webkitRequestFullscreen();
			} else if (element.mozRequestFullScreen) {
				element.mozRequestFullScreen();
			} else if (element.msRequestFullscreen) {
				element.msRequestFullscreen();
			}
		} catch (error) {
			// Fallback for iOS Safari which may not support fullscreen API
			if (this.isIOS) {
				// Apply iOS-specific fullscreen with CSS
				document.documentElement.classList.add('ios-fullscreen');
				// On iOS, we can try to use viewport meta tag approach
				const metaViewport = document.querySelector('meta[name=viewport]');
				if (metaViewport) {
					metaViewport.setAttribute(
						'content',
						'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover',
					);
				}
				// Force the element to take up full screen space via CSS
				this.button.classList.add('fullscreenMode');
			}
		}
	}

	// Exit fullscreen with vendor prefix handling
	exitFullscreen() {
		try {
			const doc = document as DocumentWithFullscreen;
			if (doc.exitFullscreen) {
				doc.exitFullscreen();
			} else if (doc.webkitExitFullscreen) {
				doc.webkitExitFullscreen();
			} else if (doc.mozCancelFullScreen) {
				doc.mozCancelFullScreen();
			} else if (doc.msExitFullscreen) {
				doc.msExitFullscreen();
			}
		} catch (error) {
			// Handle iOS fallback exit
			if (this.isIOS) {
				document.documentElement.classList.remove('ios-fullscreen');
				const metaViewport = document.querySelector('meta[name=viewport]');
				if (metaViewport) {
					metaViewport.setAttribute(
						'content',
						'width=device-width, initial-scale=1.0, viewport-fit=cover',
					);
				}
				this.button.classList.remove('fullscreenMode');
			}
		}
	}

	updateButtonState() {
		if (this.isFullscreen()) {
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
}
