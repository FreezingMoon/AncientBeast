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
		document.addEventListener('MSFullscreenChange', () => this.updateButtonState());
	}

	toggle() {
		if (this.isFullscreen()) {
			this.exitFullscreen();
		} else {
			const gameElement = document.getElementById('AncientBeast');
			if (gameElement) {
				this.requestFullscreen(gameElement);
				this.lockOrientation();
			}
		}

		// Update button state after a short delay
		setTimeout(() => this.updateButtonState(), 100);
	}

	isFullscreen(): boolean {
		return !!(
			document.fullscreenElement ||
			(document as any).webkitFullscreenElement ||
			(document as any).mozFullScreenElement ||
			(document as any).msFullscreenElement
		);
	}

	requestFullscreen(element: HTMLElement) {
		if (element.requestFullscreen) {
			element.requestFullscreen().catch(e => console.error('Fullscreen error:', e));
		} else if ((element as any).webkitRequestFullscreen) {
			(element as any).webkitRequestFullscreen();
		} else if ((element as any).mozRequestFullScreen) {
			(element as any).mozRequestFullScreen();
		} else if ((element as any).msRequestFullscreen) {
			(element as any).msRequestFullscreen();
		}
	}

	exitFullscreen() {
		if (document.exitFullscreen) {
			document.exitFullscreen();
		} else if ((document as any).webkitExitFullscreen) {
			(document as any).webkitExitFullscreen();
		} else if ((document as any).mozCancelFullScreen) {
			(document as any).mozCancelFullScreen();
		} else if ((document as any).msExitFullscreen) {
			(document as any).msExitFullscreen();
		}
	}

	lockOrientation() {
		try {
			// Try to lock screen orientation to landscape
			if ((screen as any).orientation && (screen as any).orientation.lock) {
				(screen as any).orientation.lock('landscape').catch(e => {
					console.error('Failed to lock orientation:', e);
				});
			} else if ((screen as any).lockOrientation) {
				(screen as any).lockOrientation('landscape');
			} else if ((screen as any).mozLockOrientation) {
				(screen as any).mozLockOrientation('landscape');
			} else if ((screen as any).msLockOrientation) {
				(screen as any).msLockOrientation('landscape');
			}
		} catch (e) {
			console.error('Error locking orientation:', e);
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

function isAppInNativeFullscreenMode(): boolean {
	return !!(
		document.fullscreenElement ||
		(document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement ||
		(document as Document & { mozFullScreenElement?: Element }).mozFullScreenElement
	);
}
