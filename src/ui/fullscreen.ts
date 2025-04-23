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

		document.addEventListener('keydown', (e) => {
			if (e.key === 'F11') {
				setTimeout(() => this.updateButtonState(), 100);
			}
		});
	}

	toggle() {
		if (this.isInFullscreenMode()) {
			this.exitF11Fullscreen();
		} else {
			const gameElement = document.getElementById('AncientBeast');
			if (gameElement) {
				gameElement.requestFullscreen();
			}
		}

		// Update button state after a short delay
		setTimeout(() => this.updateButtonState(), 100);
	}

	exitF11Fullscreen() {
		if (document.exitFullscreen) {
			document.exitFullscreen();
		} else if (
			(document as Document & { webkitExitFullscreen?: () => Promise<void> }).webkitExitFullscreen
		) {
			(document as Document & { webkitExitFullscreen: () => Promise<void> }).webkitExitFullscreen();
		} else if (
			(document as Document & { mozCancelFullScreen?: () => Promise<void> }).mozCancelFullScreen
		) {
			(document as Document & { mozCancelFullScreen: () => Promise<void> }).mozCancelFullScreen();
		} else if (
			(document as Document & { msExitFullscreen?: () => Promise<void> }).msExitFullscreen
		) {
			(document as Document & { msExitFullscreen: () => Promise<void> }).msExitFullscreen();
		}
	}

	updateButtonState() {
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

	isInFullscreenMode(): boolean {
		return !!(
			document.fullscreenElement ||
			(document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement ||
			(document as Document & { mozFullScreenElement?: Element }).mozFullScreenElement ||
			(window.innerHeight === screen.height && window.innerWidth === screen.width)
		);
	}
}

export function isAppInNativeFullscreenMode(): boolean {
	return !!(
		document.fullscreenElement ||
		(document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement ||
		(document as Document & { mozFullScreenElement?: Element }).mozFullScreenElement ||
		(window.innerHeight === screen.height && window.innerWidth === screen.width)
	);
}
