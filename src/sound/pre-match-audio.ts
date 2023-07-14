import { getUrl } from '../assets';

// TODO: Refactor this code to use ./src/sound/soundsys
// so that it respects user volume preferences held there.
export class PreMatchAudioPlayer {
	beastAudio: HTMLAudioElement;

	constructor() {
		this.beastAudio = new Audio(getUrl('sounds/AncientBeast'));
	}

	playBeast() {
		if (this.beastAudio.paused) {
			this.beastAudio.play();
		}
	}
}
