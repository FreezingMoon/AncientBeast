import { BufferLoader } from './bufferloader';
import { getUrl } from '../assets';
import { MusicPlayer } from './musicplayer';
import { clamp } from '../utility/math';

type SoundSysConfig = {
	musicVolume?: number;
	effectsVolume?: number;
	heartbeatVolume?: number;
	announcerVolume?: number;
	paths?: string[];
};

export class SoundSys {
	musicPlayer: MusicPlayer;

	private envHasSound = window && ('AudioContext' in window || 'webkitAudioContext' in window);
	private context: AudioContext;
	private loadedPaths: Record<string, AudioBuffer> = {};

	private musicGainNode: GainNode;
	private effectsGainNode: GainNode;
	private heartbeatGainNode: GainNode;
	private announcerGainNode: GainNode;

	private _musicVol = 1;
	private _effectsVol = 1;
	private _heartbeatVol = 1;
	private _announcerVol = 1;
	private _allEffectsCoeff = 1;

	constructor(config: SoundSysConfig) {
		this.musicPlayer = new MusicPlayer();

		if (this.envHasSound) {
			this.context = new (AudioContext || (window as any).webkitAudioContext)();

			this.musicGainNode = this.context.createGain();
			this.musicGainNode.connect(this.context.destination);
			if ('musicVolume' in config) {
				this.musicVolume = config.musicVolume;
			}

			this.effectsGainNode = this.context.createGain();
			this.effectsGainNode.connect(this.context.destination);
			if ('effectsVolume' in config) {
				this.effectsVolume = config.effectsVolume;
			}

			this.heartbeatGainNode = this.context.createGain();
			this.heartbeatGainNode.connect(this.context.destination);
			if ('heartbeatVolume' in config) {
				this.heartbeatVolume = config.heartbeatVolume;
			}

			this.announcerGainNode = this.context.createGain();
			this.announcerGainNode.connect(this.context.destination);
			if ('announcerVolume' in config) {
				this.announcerVolume = config.announcerVolume;
			}

			if ('paths' in config) {
				for (const path of config.paths) {
					this.loadSound(path);
				}
			}
		}
	}

	set musicVolume(level: number) {
		if (this.envHasSound) {
			this._musicVol = clamp(level, 0, 1);
			this.musicGainNode.gain.value = this._musicVol;
		}
	}

	set effectsVolume(level: number) {
		if (this.envHasSound) {
			this._effectsVol = clamp(level, 0, 1);
			this.effectsGainNode.gain.value = this._effectsVol * this._allEffectsCoeff;
		}
	}

	set heartbeatVolume(level: number) {
		if (this.envHasSound) {
			this._heartbeatVol = clamp(level, 0, 1);
			this.heartbeatGainNode.gain.value = this._heartbeatVol * this._allEffectsCoeff;
		}
	}

	set announcerVolume(level: number) {
		if (this.envHasSound) {
			this._announcerVol = clamp(level, 0, 1);
			this.announcerGainNode.gain.value = this._announcerVol * this._allEffectsCoeff;
		}
	}

	set allEffectsMultiplier(level: number) {
		if (this.envHasSound) {
			this._allEffectsCoeff = clamp(level, 0, 1);
			// NOTE: Trigger all effects volume setters so that
			// volumes are updated with new _allEffectsCoeff value.
			this.effectsVolume = this._effectsVol;
			this.heartbeatVolume = this._heartbeatVol;
			this.announcerVolume = this._announcerVol;
		}
	}

	playMusic() {
		this.musicPlayer.playRandom();
	}

	stopMusic() {
		this.musicPlayer.stopMusic();
	}

	loadSound(relativePath: string) {
		if (this.envHasSound) {
			const url = getUrl(relativePath);
			const bufferLoader = new BufferLoader(this.context, [url], (arraybuffer: AudioBuffer[]) => {
				this.loadedPaths[relativePath] = arraybuffer[0];
			});

			bufferLoader.load();
		}
	}

	private playSound(sound: AudioBuffer, node: GainNode): SoundSysAudioBufferSourceNode {
		if (!this.envHasSound) {
			return new NullAudioBufferSourceNode();
		}

		const source = this.context.createBufferSource();
		source.buffer = sound;
		source.connect(node);
		source.start(0);

		return source;
	}

	playSFX(relativePath: string): SoundSysAudioBufferSourceNode {
		if (this.envHasSound && this.loadedPaths.hasOwnProperty(relativePath)) {
			return this.playSound(this.loadedPaths[relativePath], this.effectsGainNode);
		}
		return new NullAudioBufferSourceNode();
	}

	playHeartBeat(relativePath: string): SoundSysAudioBufferSourceNode {
		if (this.envHasSound && this.loadedPaths.hasOwnProperty(relativePath)) {
			return this.playSound(this.loadedPaths[relativePath], this.heartbeatGainNode);
		}
		return new NullAudioBufferSourceNode();
	}

	playShout(shoutName: string): SoundSysAudioBufferSourceNode {
		const SHOUT_PATH_PREFIX = 'units/shouts/';
		const path = SHOUT_PATH_PREFIX + shoutName;
		if (this.envHasSound && this.loadedPaths.hasOwnProperty(path)) {
			return this.playSound(this.loadedPaths[path], this.announcerGainNode);
		} else {
			return new NullAudioBufferSourceNode();
		}
	}

	get playableSounds() {
		return Object.keys(this.loadedPaths);
	}
}

class NullAudioBufferSourceNode {
	play() {
		// pass
	}
	pause() {
		// pass
	}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isNullAudioBufferSourcNode(o: any) {
	if (!o) return false;
	return o instanceof NullAudioBufferSourceNode;
}

type SoundSysAudioBufferSourceNode = AudioBufferSourceNode | NullAudioBufferSourceNode;
