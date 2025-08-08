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
		const chatElement = document.getElementById('chat');

		if (document.fullscreenElement) {
			this.button.classList.add('fullscreenMode');
			this.button
				.querySelectorAll('.fullscreen__title')
				.forEach((el) => (el.textContent = 'Contract'));
			// Hide the chat when entering fullscreen
			if (chatElement) {
				chatElement.style.display = 'none';
			}
		} else {
			this.button.classList.remove('fullscreenMode');
			this.button
				.querySelectorAll('.fullscreen__title')
				.forEach((el) => (el.textContent = 'FullScreen'));

			// Show the chat when exiting fullscreen
			if (chatElement) {
				chatElement.style.display = 'block';
			}
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
