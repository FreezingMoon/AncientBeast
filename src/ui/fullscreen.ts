export class Fullscreen {
	public button: HTMLElement;
	private isIOS: boolean;

	constructor(button: HTMLElement, isFullscreen = false) {
		this.button = button;
		if (isFullscreen) {
			button.classList.add('fullscreenMode');
		}

		// Check if we're on iOS
		this.isIOS = this.detectIOS();

		// Add listener for fullscreen changes to update UI state
		document.addEventListener('fullscreenchange', () => this.updateButtonState());
		document.addEventListener('webkitfullscreenchange', () => this.updateButtonState());
		document.addEventListener('mozfullscreenchange', () => this.updateButtonState());
	}

	private detectIOS(): boolean {
		return (
			/iPad|iPhone|iPod/.test(navigator.userAgent) ||
			(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
		);
	}

	toggle() {
		// Special handling for iOS
		if (this.isIOS) {
			this.handleIOSFullscreen();
			return;
		}

		// Standard fullscreen API for other platforms
		try {
			if (this.isInFullscreenMode()) {
				this.exitFullscreen();
			} else {
				const gameElement = document.getElementById('AncientBeast');
				if (gameElement) {
					this.requestFullscreen(gameElement);
				}
			}
		} catch (err) {
			console.error('Error attempting to toggle fullscreen:', err);
		}

		// Update button state after a short delay
		setTimeout(() => this.updateButtonState(), 100);
	}

	private isInFullscreenMode(): boolean {
		return !!(
			document.fullscreenElement ||
			(document as any).webkitFullscreenElement ||
			(document as any).mozFullScreenElement
		);
	}

	private handleIOSFullscreen() {
		// For iOS we'll use a different approach - toggling a class for CSS-based fullscreen
		const gameElement = document.getElementById('AncientBeast');
		if (gameElement) {
			const isCurrentlyFullscreen = gameElement.classList.contains('ios-fullscreen');

			if (isCurrentlyFullscreen) {
				// Exit iOS "fullscreen"
				gameElement.classList.remove('ios-fullscreen');
				document.body.classList.remove('ios-fullscreen-body');
				this.button.classList.remove('fullscreenMode');
				this.button
					.querySelectorAll('.fullscreen__title')
					.forEach((el) => (el.textContent = 'FullScreen'));
			} else {
				// Enter iOS "fullscreen"
				gameElement.classList.add('ios-fullscreen');
				document.body.classList.add('ios-fullscreen-body');
				this.button.classList.add('fullscreenMode');
				this.button
					.querySelectorAll('.fullscreen__title')
					.forEach((el) => (el.textContent = 'Contract'));
			}
		}
	}

	private requestFullscreen(element: HTMLElement) {
		if (element.requestFullscreen) {
			element.requestFullscreen();
		} else if ((element as any).webkitRequestFullscreen) {
			(element as any).webkitRequestFullscreen();
		} else if ((element as any).mozRequestFullScreen) {
			(element as any).mozRequestFullScreen();
		} else if ((element as any).msRequestFullscreen) {
			(element as any).msRequestFullscreen();
		}
	}

	private exitFullscreen() {
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

	updateButtonState() {
		if (this.isIOS) {
			// iOS state is managed separately in handleIOSFullscreen
			return;
		}

		if (this.isInFullscreenMode()) {
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

export function isAppInNativeFullscreenMode(): boolean {
	return !!(
		document.fullscreenElement ||
		(document as any).webkitFullscreenElement ||
		(document as any).mozFullScreenElement
	);
}
