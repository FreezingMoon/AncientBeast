import * as $j from 'jquery';
import { BufferLoader } from './bufferloader';

export class SoundSys {
	constructor(o, game) {
		this.game = game;

		o = $j.extend(
			{
				music_volume: 0.1,
				effects_volume: 0.6,
				heartbeats_volume: 0.3,
				announcer_volume: 0.6,
			},
			o || {},
		);

		$j.extend(this, o);

		window.AudioContext = window.AudioContext || window.webkitAudioContext;

		if (!window.AudioContext) {
			return false;
		}

		this.context = new AudioContext();

		// Music
		this.musicGainNode = this.context.createGain();
		this.musicGainNode.connect(this.context.destination);
		this.musicGainNode.gain.value = this.music_volume;

		// Effects
		this.effectsGainNode = this.context.createGain();
		this.effectsGainNode.connect(this.context.destination);
		this.effectsGainNode.gain.value = this.effects_volume;

		// HeartBeat
		this.heartbeatGainNode = this.context.createGain();
		this.heartbeatGainNode.connect(this.context.destination);
		this.heartbeatGainNode.gain.value = this.heartbeats_volume;

		// Announcner
		this.announcerGainNode = this.context.createGain();
		this.announcerGainNode.connect(this.context.destination);
		this.announcerGainNode.gain.value = this.announcer_volume;
	}

	playMusic() {
		this.game.musicPlayer.playRandom();
	}

	stopMusic() {
		this.game.musicPlayer.stopMusic();
	}

	getSound(url, id) {
		let bufferLoader = new BufferLoader(this.context, [url], (arraybuffer) => {
			this.game.soundLoaded[id] = arraybuffer[0];
		});

		bufferLoader.load();
	}

	playSound(sound, node) {
		if (!window.AudioContext) {
			return false;
		}

		let source = this.context.createBufferSource();
		source.buffer = sound;
		source.connect(node);
		source.start(0);

		return source;
	}

	setEffectsVolume(value) {
		this.effectsGainNode.gain.value = this.effects_volume * value;
		this.heartbeatGainNode.gain.value = this.heartbeats_volume * value;
		this.announcerGainNode.gain.value = this.announcer_volume * value;
	}
}
