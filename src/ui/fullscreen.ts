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
		if (document.body.classList.contains('devvit-mode') || !document.fullscreenEnabled) {
			return;
		}
		if (document.fullscreenElement) {
			document.exitFullscreen().catch(() => {});
		} else {
			// Use document.documentElement for browser-native fullscreen (matches F11 behavior)
			document.documentElement
				.requestFullscreen()
				.catch((error) => console.error('Error toggling fullscreen:', error));
		}
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
