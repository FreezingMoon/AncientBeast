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

	/**
	 * Running on iOS inside a regular browser tab (Safari/Chrome/etc.).
	 *
	 * The Fullscreen API doesn't work for arbitrary DOM elements on iOS, so the
	 * button can't actually toggle fullscreen here. The real fullscreen is
	 * achieved by adding the app to the home screen — but once that's done the
	 * app runs in standalone mode and is already chromeless, so this only
	 * applies to the browser-tab case.
	 */
	static isIosBrowserTab(): boolean {
		if (typeof navigator === 'undefined') return false;
		if (!/iPhone|iPad|iPod/i.test(navigator.userAgent)) return false;
		// `standalone` is true when the app was launched from the home screen.
		return !(navigator as any).standalone;
	}

	/**
	 * Running on iOS in standalone (home-screen) mode. The app is already
	 * chromeless and maximized, so there is nothing for the fullscreen button
	 * to do — it's a dead control and should be hidden.
	 */
	static isIosStandalone(): boolean {
		if (typeof navigator === 'undefined') return false;
		return /iPhone|iPad|iPod/i.test(navigator.userAgent) && !!(navigator as any).standalone;
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

	toggle() {
		// On iOS the Fullscreen API is unavailable for non-video elements, so the
		// button can't actually toggle fullscreen. The real fullscreen is achieved
		// by adding the app to the home screen — nudge the user toward that.
		if (Fullscreen.isIosBrowserTab()) {
			this.showNotification('iOS limitation: add to home for fullscreen mode!');
			return;
		}
		// In standalone (home-screen) mode the app is already chromeless and
		// maximized, so there is nothing to toggle — no-op silently.
		if (Fullscreen.isIosStandalone()) {
			return;
		}

		if (
			document.body.classList.contains('devvit-mode') ||
			document.body.classList.contains('crazygames-mode') ||
			!document.fullscreenEnabled
		) {
			return;
		}
		if (document.fullscreenElement) {
			// Leaving fullscreen rejects when the document is not in fullscreen
			// anyway (e.g. the user hit Esc first); there is nothing to report.
			document.exitFullscreen().catch(() => undefined);
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
