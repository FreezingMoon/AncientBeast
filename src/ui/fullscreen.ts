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

	private isFullscreenSupported(): boolean {
		// Fullscreen API is not supported on iOS Safari/Chrome for arbitrary DOM elements
		// Check for any of the vendor-prefixed or standard fullscreen support
		const doc = document as Document & {
			webkitFullscreenEnabled?: boolean;
			mozFullScreenEnabled?: boolean;
			msFullscreenEnabled?: boolean;
		};
		return !!(
			document.fullscreenEnabled ||
			doc.webkitFullscreenEnabled ||
			doc.mozFullScreenEnabled ||
			doc.msFullscreenEnabled
		);
	}

	private showNotification(message: string) {
		// Remove existing notification if any
		const existing = document.getElementById('fullscreen-notification');
		if (existing) {
			existing.remove();
		}

		const notification = document.createElement('div');
		notification.id = 'fullscreen-notification';
		notification.textContent = message;
		document.body.appendChild(notification);

		// Trigger fade-in animation
		requestAnimationFrame(() => {
			notification.classList.add('visible');
		});

		// Remove after 2.5 seconds
		setTimeout(() => {
			notification.classList.remove('visible');
			setTimeout(() => notification.remove(), 300);
		}, 2500);
	}

	async toggle() {
		// Check if fullscreen API is supported
		if (!this.isFullscreenSupported()) {
			this.showNotification('Fullscreen not supported on iOS. Add to home screen for fullscreen mode.');
			return;
		}

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
			// On iOS, requestFullscreen may fail silently; notify user
			if ((error as Error).name === 'TypeError' && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
				this.showNotification('Fullscreen not supported on iOS. Add to home screen for fullscreen mode.');
			} else {
				console.error('Error toggling fullscreen:', error);
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
