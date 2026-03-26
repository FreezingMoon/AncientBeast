export class Fullscreen {
	public button: HTMLElement;

	constructor(button: HTMLElement, isFullscreen = false) {
		this.button = button;
		if (isFullscreen) {
			button.classList.add('fullscreenMode');
		}
		// Add listener for fullscreen changes to update UI state
		document.addEventListener('fullscreenchange', () => this.updateButtonState());
		document.addEventListener('webkitfullscreenchange', () => this.updateButtonState());
		document.addEventListener('mozfullscreenchange', () => this.updateButtonState());
	}

	async toggle() {
		try {
			if (document.fullscreenElement) {
				await document.exitFullscreen();
			} else {
				const gameElement = document.getElementById('AncientBeast');
				if (gameElement) {
					await gameElement.requestFullscreen();
				}
			}

			setTimeout(() => this.updateButtonState(), 100);
		} catch (error) {
			console.error('Error toggling fullscreen:', error);
		}
	}

	updateButtonState() {
		if (document.fullscreenElement) {
			this.button.classList.add('fullscreenMode');
			this.button
				.querySelectorAll('.fullscreen__title')
				.forEach((el) => (el.textContent = 'Contract'));
			// Lock orientation to landscape when entering fullscreen on mobile
			this.lockOrientation();
		} else {
			this.button.classList.remove('fullscreenMode');
			this.button
				.querySelectorAll('.fullscreen__title')
				.forEach((el) => (el.textContent = 'FullScreen'));
			// Unlock orientation when exiting fullscreen
			this.unlockOrientation();
		}
	}

	/**
	 * Lock screen orientation to landscape using the Screen Orientation API.
	 * This requires fullscreen mode on most mobile browsers.
	 */
	private async lockOrientation() {
		const screen = window.screen;
		if (screen?.orientation?.lock) {
			try {
				await screen.orientation.lock('landscape');
			} catch (error) {
				// Orientation lock is not supported or blocked (e.g., not in fullscreen yet,
				// or the device doesn't support locking). Silently ignore.
				console.debug('Screen orientation lock not available:', error);
			}
		}
	}

	/**
	 * Unlock screen orientation.
	 */
	private unlockOrientation() {
		const screen = window.screen;
		if (screen?.orientation?.unlock) {
			screen.orientation.unlock();
		}
	}
}

function isAppInNativeFullscreenMode(): boolean {
	return !!(
		document.fullscreenElement ||
		(document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement ||
		(document as Document & { mozFullScreenElement?: Element }).mozFullScreenElement
	);
}
