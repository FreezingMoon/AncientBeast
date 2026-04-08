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
				// Unlock orientation when exiting fullscreen
				if (screen.orientation?.unlock) {
					screen.orientation.unlock();
				}
			} else {
				const gameElement = document.getElementById('AncientBeast');
				if (gameElement) {
					await gameElement.requestFullscreen();
					// Lock to landscape after entering fullscreen
					this.lockOrientation();
				}
			}

			setTimeout(() => this.updateButtonState(), 100);
		} catch (error) {
			console.error('Error toggling fullscreen:', error);
		}
	}

	private async lockOrientation() {
		// Lock orientation to landscape using Screen Orientation API
		// This requires fullscreen on most browsers (Chrome Android, etc.)
		if (screen.orientation?.lock) {
			try {
				await screen.orientation.lock('landscape');
			} catch (error) {
				// Lock may fail if not in fullscreen, not supported, or already locked
				console.warn('Orientation lock not available:', error);
			}
		}
	}

	updateButtonState() {
		if (document.fullscreenElement) {
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

function isAppInNativeFullscreenMode(): boolean {
	return !!(
		document.fullscreenElement ||
		(document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement ||
		(document as Document & { mozFullScreenElement?: Element }).mozFullScreenElement
	);
}
