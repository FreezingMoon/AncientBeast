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

	toggle() {
		if (document.fullscreenElement) {
			document.exitFullscreen();
		} else {
			const gameElement = document.getElementById('AncientBeast');
			if (gameElement) {
				gameElement.requestFullscreen();
			}
		}

		// Update button state after a short delay
		setTimeout(() => this.updateButtonState(), 100);
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
