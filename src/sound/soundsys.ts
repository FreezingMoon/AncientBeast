import { BufferLoader } from './bufferloader';
import { getUrl } from '../assets';
import { MusicPlayer } from './musicplayer';
import { clamp } from '../utility/math';
import { resolveAudioContextCtor, unlockAudioContextOnGesture } from './audio-context';

export type AudioMode = 'full' | 'sfx' | 'muted';

// NOTE: Start with SFX only while developing so that
// music does not interfere with audio the developer is working on.
export const DEFAULT_AUDIO_MODE: AudioMode =
	process.env.NODE_ENV === 'development' ? 'sfx' : 'full';

/**
 * The turn-skip heartbeat is an ambient cue that fires on every turn handoff,
 * so it plays well below the requested heartbeat volume. The asset peaks at
 * 0 dBFS, which makes small reductions inaudible, hence the sizeable cut.
 */
const HEARTBEAT_VOLUME_SCALE = 0.25;

let currentAudioMode: AudioMode = DEFAULT_AUDIO_MODE;

export function getAudioMode(): AudioMode {
	return currentAudioMode;
}

type SoundSysConfig = {
	musicVolume?: number;
	effectsVolume?: number;
	heartbeatVolume?: number;
	announcerVolume?: number;
	paths?: string[];
};

export class SoundSys {
	musicPlayer: MusicPlayer;

	private envHasSound = resolveAudioContextCtor() !== null;
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
	/** Sounds currently being fetched, so repeated warm-ups do not re-decode. */
	private _pendingSoundPaths = new Set<string>();

	constructor(config: SoundSysConfig) {
		this.musicPlayer = new MusicPlayer();

		const AudioContextCtor = resolveAudioContextCtor();

		if (this.envHasSound && AudioContextCtor) {
			this.context = new AudioContextCtor();
			// WebKit suspends a context that wasn't created inside a user gesture,
			// so resume it on the first interaction or every effect stays silent.
			unlockAudioContextOnGesture(this.context);
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
			this.heartbeatGainNode.gain.value = HEARTBEAT_VOLUME_SCALE;
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

	get musicVolume() {
		return this._musicVol;
	}
	set musicVolume(level: number) {
		if (this.envHasSound) {
			this._musicVol = clamp(level, 0, 1);
			this.musicGainNode.gain.value = this._musicVol;
		}
	}
	get effectsVolume() {
		return this._effectsVol;
	}
	set effectsVolume(level: number) {
		if (this.envHasSound) {
			this._effectsVol = clamp(level, 0, 1);
			this.effectsGainNode.gain.value = this._effectsVol * this._allEffectsCoeff;
		}
	}

	get heartbeatVolume() {
		return this._heartbeatVol;
	}
	set heartbeatVolume(level: number) {
		if (this.envHasSound) {
			this._heartbeatVol = clamp(level, 0, 1);
			this.heartbeatGainNode.gain.value =
				this._heartbeatVol * HEARTBEAT_VOLUME_SCALE * this._allEffectsCoeff;
		}
	}

	get announcerVolume() {
		return this._announcerVol;
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
		if (!this.envHasSound) {
			return;
		}
		// The constructor already walks every path, and callers warm individual
		// sounds on top of that. Decoding an ogg is expensive, so only ever fetch
		// a given sound once: skip it if it has landed or is already in flight.
		if (
			this.loadedPaths.hasOwnProperty(relativePath) ||
			this._pendingSoundPaths.has(relativePath)
		) {
			return;
		}

		let url: string;
		try {
			url = getUrl(relativePath);
		} catch {
			console.warn(`[soundsys] unknown sound "${relativePath}"`);
			return;
		}

		this._pendingSoundPaths.add(relativePath);
		const bufferLoader = new BufferLoader(this.context, [url], (arraybuffer: AudioBuffer[]) => {
			this._pendingSoundPaths.delete(relativePath);
			this.loadedPaths[relativePath] = arraybuffer[0];
		});

		bufferLoader.load();
	}

	/** Stop a source returned by one of the play methods, tolerating an already-ended one. */
	stopSFX(source?: SoundSysAudioBufferSourceNode) {
		if (isNullAudioBufferSourcNode(source)) {
			return;
		}
		try {
			// Throws if the node never started or already stopped.
			(source as AudioBufferSourceNode).stop();
		} catch {
			// Already finished; nothing left to silence.
		}
	}

	/**
	 * @param duration - optional length in seconds to play, cutting the sound short.
	 * Useful for long stingers that would otherwise linger over the whole screen.
	 * @param loop - repeat the buffer until the returned node is passed to
	 * {@link stopSFX}. Used for continuous cues such as a unit in flight, whose
	 * length is not known up front.
	 */
	private playSound(
		sound: AudioBuffer,
		node: GainNode,
		duration?: number,
		loop?: boolean,
	): SoundSysAudioBufferSourceNode {
		if (!this.envHasSound) {
			return new NullAudioBufferSourceNode();
		}

		const source = this.context.createBufferSource();
		source.buffer = sound;
		if (loop) {
			source.loop = true;
		}
		source.connect(node);
		source.start(0, 0, duration);

		return source;
	}

	playSFX(relativePath: string, duration?: number): SoundSysAudioBufferSourceNode {
		if (this.envHasSound && this.loadedPaths.hasOwnProperty(relativePath)) {
			return this.playSound(this.loadedPaths[relativePath], this.effectsGainNode, duration);
		}
		return new NullAudioBufferSourceNode();
	}

	/**
	 * Start a repeating SFX. The caller owns the returned node and must hand it to
	 * {@link stopSFX} when the sound should stop, otherwise it plays forever.
	 */
	playSFXLoop(relativePath: string): SoundSysAudioBufferSourceNode {
		if (this.envHasSound && this.loadedPaths.hasOwnProperty(relativePath)) {
			return this.playSound(this.loadedPaths[relativePath], this.effectsGainNode, undefined, true);
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
	stop() {
		// pass
	}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isNullAudioBufferSourcNode(o: any) {
	if (!o) return false;
	return o instanceof NullAudioBufferSourceNode;
}

export type SoundSysAudioBufferSourceNode = AudioBufferSourceNode | NullAudioBufferSourceNode;

export function setAudioMode(mode, soundSysInstance, uiInstance) {
	currentAudioMode = mode;

	if (mode === 'muted') {
		soundSysInstance.musicVolume = 0;
		soundSysInstance.effectsVolume = 0;
		soundSysInstance.heartbeatVolume = 0;
		soundSysInstance.announcerVolume = 0;
		soundSysInstance.stopMusic();
	} else if (mode === 'sfx') {
		soundSysInstance.musicVolume = 0;
		soundSysInstance.effectsVolume = 1;
		soundSysInstance.heartbeatVolume = 1;
		soundSysInstance.announcerVolume = 1;
		soundSysInstance.stopMusic();
	} else if (mode === 'full') {
		soundSysInstance.musicVolume = 1;
		soundSysInstance.effectsVolume = 1;
		soundSysInstance.heartbeatVolume = 1;
		soundSysInstance.announcerVolume = 1;
		soundSysInstance.playMusic();
	}
	if (uiInstance) {
		uiInstance.updateAudioIcon(mode);
	}
}
export function cycleAudioMode(
	soundSysInstance: SoundSys,
	uiInstance?: { updateAudioIcon: (mode: AudioMode) => void },
): AudioMode {
	let newMode: AudioMode;

	if (currentAudioMode === 'full') {
		newMode = 'sfx';
	} else if (currentAudioMode === 'sfx') {
		newMode = 'muted';
	} else {
		newMode = 'full';
	}

	setAudioMode(newMode, soundSysInstance, uiInstance);
	return newMode;
}
