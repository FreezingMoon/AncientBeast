import beastAudioFile from 'assets/sounds/AncientBeast.ogg';

export class PreMatchAudioPlayer {
	constructor() {
		this.beastAudio = new Audio(beastAudioFile);
	}

	playBeast() {
		if (this.beastAudio.paused) {
			this.beastAudio.play();
		}
	}
}
