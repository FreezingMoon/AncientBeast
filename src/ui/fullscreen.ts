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
					// Lock to landscape after entering fullscreen
					Fullscreen.lockLandscapeOrientation();
				}
			}

			setTimeout(() => this.updateButtonState(), 100);
		} catch (error) {
			console.error('Error toggling fullscreen:', error);
		}
	}

	/**
	 * Attempts to lock the screen orientation to landscape.
	 * Most browsers require fullscreen to be active before locking orientation.
	 * Sets up a listener to re-lock on orientation changes.
	 */
	static lockLandscapeOrientation() {
		const screenOrientation = screen as Screen & { orientation?: ScreenOrientation };
		if (screenOrientation.orientation && 'lock' in screenOrientation.orientation) {
			(screenOrientation.orientation as ScreenOrientation).lock('landscape').catch((err) => {
				console.warn('Could not lock screen orientation:', err);
			});
			// Re-lock whenever the orientation changes (e.g. user rotates device)
			screenOrientation.orientation.addEventListener('change', () => {
				(screenOrientation.orientation as ScreenOrientation).lock('landscape').catch((err) => {
					console.warn('Could not lock screen orientation on change:', err);
				});
			});
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
