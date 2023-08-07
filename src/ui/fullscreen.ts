import * as $j from 'jquery';

export class Fullscreen {
	fullscreenElement: any;

	constructor(fullscreenElement, fullscreenMode = false) {
		this.fullscreenElement = fullscreenElement;
		if (fullscreenMode) {
			fullscreenElement.addClass('fullscreenMode');
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
			$j('#AncientBeast')[0].requestFullscreen();
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

const disableFullscreenLayout = (fullscreenElement) => {
	fullscreenElement.removeClass('fullscreenMode');
	fullscreenElement.find('.fullscreen__title').text('Fullscreen');
};

const enableFullscreenLayout = (fullscreenElement) => {
	fullscreenElement.addClass('fullscreenMode');
	fullscreenElement.find('.fullscreen__title').text('Contract');
};
