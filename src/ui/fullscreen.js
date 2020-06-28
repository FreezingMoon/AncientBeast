import * as $j from 'jquery';

export class Fullscreen {
	constructor(fullscreenElement) {
		this.fullscreenElement = fullscreenElement;
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

const isNativeFullscreenAPIUse = () =>
	document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement;

const disableFullscreenLayout = (fullscreenElement) => {
	fullscreenElement.removeClass('fullscreenMode');
	fullscreenElement.find('.fullscreen__title').text('Fullscreen');
};

const enableFullscreenLayout = (fullscreenElement) => {
	fullscreenElement.addClass('fullscreenMode');
	fullscreenElement.find('.fullscreen__title').text('Contract');
};
