import audioFile from 'assets/sounds/AncientBeast.ogg';

export class PreMatchAudioPlayer {
	constructor() {
		var beastAudioFile = audioFile;
		this.beastAudio = new Audio(beastAudioFile);
	}

	playBeast() {
		if (this.beastAudio.paused) {
			this.beastAudio.play();
		}
	}
}
