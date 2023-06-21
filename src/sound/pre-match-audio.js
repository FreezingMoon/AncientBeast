export class PreMatchAudioPlayer {
  constructor() {
    var beastAudioFile = require("assets/sounds/AncientBeast.ogg");
		this.beastAudio = new Audio(beastAudioFile);
  }

  playBeast() {
    if (this.beastAudio.paused) {
      this.beastAudio.play();
    }
  }
}
