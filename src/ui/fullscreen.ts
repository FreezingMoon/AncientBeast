export class Fullscreen {
	public button: HTMLElement;
	private isIOS: boolean;
	// Track fullscreen state internally for iOS
	private isInIOSFullscreen = false;

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
		if (this.isInIOSFullscreen) {
			this.exitIOSFullscreen();
		} else {
			this.enterIOSFullscreen();
		}
	}

	private enterIOSFullscreen() {
		// Main elements we need to modify
		const gameElement = document.getElementById('AncientBeast');
		const htmlElement = document.documentElement;
		const bodyElement = document.body;

		// Save current scroll position to restore later
		const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
		const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

		if (!gameElement) return;

		// 1. Apply fullscreen classes to main elements
		htmlElement.classList.add('ios-fullscreen-html');
		bodyElement.classList.add('ios-fullscreen-body');
		gameElement.classList.add('ios-fullscreen');

		// 2. Set game container to fill screen
		const gameContainer = document.getElementById('combatwrapper') || 
							  document.getElementById('matchMaking') || 
							  gameElement;

		if (gameContainer) {
			gameContainer.classList.add('ios-fullscreen-container');

			// Make sure the game container is visible
			gameContainer.style.display = 'block';
		}

		// 3. Update button state
		this.button.classList.add('fullscreenMode');
		this.button
			.querySelectorAll('.fullscreen__title')
			.forEach((el) => (el.textContent = 'Contract'));

		// 4. Handle iOS specific viewport settings
		this.setIOSViewport(true);

		// 5. Force layout recalculation
		window.scrollTo(0, 0);
		document.body.scrollTop = 0;

		// 6. Set internal state
		this.isInIOSFullscreen = true;

		// 7. Add orientation change handler
		this.addOrientationChangeHandler();
	}

	private exitIOSFullscreen() {
		// Main elements to modify
		const gameElement = document.getElementById('AncientBeast');
		const htmlElement = document.documentElement;
		const bodyElement = document.body;

		if (!gameElement) return;

		// 1. Remove fullscreen classes
		htmlElement.classList.remove('ios-fullscreen-html');
		bodyElement.classList.remove('ios-fullscreen-body');
		gameElement.classList.remove('ios-fullscreen');

		// 2. Restore game container
		const gameContainer = document.getElementById('combatwrapper') || document.getElementById('matchMaking') ||gameElement;

		if (gameContainer) {
			gameContainer.classList.remove('ios-fullscreen-container');
		}

		// 3. Update button state
		this.button.classList.remove('fullscreenMode');
		this.button
			.querySelectorAll('.fullscreen__title')
			.forEach((el) => (el.textContent = 'FullScreen'));

		// 4. Restore viewport settings
		this.setIOSViewport(false);

		// 5. Reset internal state
		this.isInIOSFullscreen = false;
	}

	private setIOSViewport(fullscreen: boolean) {
		let viewport = document.querySelector('meta[name="viewport"]');

		if (!viewport) {
			viewport = document.createElement('meta');
			viewport.setAttribute('name', 'viewport');
			document.head.appendChild(viewport);
		}

		if (fullscreen) {
			viewport.setAttribute(
				'content',
				'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover',
			);
		} else {
			viewport.setAttribute(
				'content',
				'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no',
			);
		}
	}

	private addOrientationChangeHandler() {
		// Add a one-time orientation change handler to ensure proper fullscreen on orientation change
		window.addEventListener(
			'orientationchange',
			() => {
				if (this.isInIOSFullscreen) {
					// Wait for orientation change to complete
					setTimeout(() => {
						window.scrollTo(0, 0);

						// Force redraw of fullscreen elements
						const gameElement = document.getElementById('AncientBeast');
						if (gameElement) {
							// Briefly toggle a class to force redraw
							gameElement.classList.add('ios-fullscreen-redraw');
							setTimeout(() => {
								gameElement.classList.remove('ios-fullscreen-redraw');
							}, 50);
						}
					}, 300);
				}
			},
			{ once: true },
		);
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
