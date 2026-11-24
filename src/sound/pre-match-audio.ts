import { getUrl } from '../assets';
import { getAudioMode } from './soundsys';

// TODO: Refactor this code to use ./src/sound/soundsys
// so that it respects user volume preferences held there.
export class PreMatchAudioPlayer {
	beastAudio: HTMLAudioElement;

	constructor() {
		this.beastAudio = new Audio(getUrl('sounds/AncientBeast'));
	}

	playBeast() {
		// Respect a platform/system mute (e.g. the CrazyGames player bar) and the
		// in-game mute preference before playing the title roar.
		if (getAudioMode() === 'muted') {
			return;
		}
		if (this.beastAudio.paused) {
			this.beastAudio.play();
		}
	}
}
