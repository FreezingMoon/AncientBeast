export class Fullscreen {
	private fullscreenElement: HTMLElement;

	constructor(fullscreenElement: HTMLElement, fullscreenMode = false) {
		this.fullscreenElement = fullscreenElement;
		if (fullscreenMode) {
			fullscreenElement.classList.add('fullscreenMode');
		}
	}

	toggle() {
		if (isNativeFullscreenAPIUse()) {
			disableFullscreenLayout(this.fullscreenElement);
			document.exitFullscreen();
		} else if (!isNativeFullscreenAPIUse() && window.innerHeight === screen.height) {
			alert('Use F11 to exit fullscreen');
		} else {
			enableFullscreenLayout(this.fullscreenElement);
			document.getElementById('AncientBeast').requestFullscreen();
		}
	}
}

const isNativeFullscreenAPIUse = () => {
	// NOTE: These properties were vendor-prefixed until very recently.
	// Keeping vendor prefixes, though they make TS report an error.
	return (
		// @ts-expect-error 2551
		document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement
	);
};

const disableFullscreenLayout = (fullscreenElement: HTMLElement) => {
	fullscreenElement.classList.remove('fullscreenMode');
	const labelNode = fullscreenElement.querySelector('.fullscreen__title');
	if (labelNode) {
		labelNode.textContent = 'Fullscreen';
	}
};

const enableFullscreenLayout = (fullscreenElement: HTMLElement) => {
	fullscreenElement.classList.add('fullscreenMode');
	const labelNode = fullscreenElement.querySelector('.fullscreen__title');
	if (labelNode) {
		labelNode.textContent = 'Contract';
	}
};
