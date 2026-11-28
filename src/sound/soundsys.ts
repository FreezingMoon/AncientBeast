import { BufferLoader } from './bufferloader';
import { getUrl } from '../assets';
import { MusicPlayer } from './musicplayer';
import { clamp } from '../utility/math';
import { resolveAudioContextCtor, unlockAudioContextOnGesture } from './audio-context';

export type AudioMode = 'full' | 'sfx' | 'muted';

const AUDIO_SETTINGS_STORAGE_KEY = 'ab:audio-settings';

// NOTE: Start with SFX only while developing so that
// music does not interfere with audio the developer is working on.
export const DEFAULT_AUDIO_MODE: AudioMode =
	process.env.NODE_ENV === 'development' ? 'sfx' : 'full';

export type AudioSettings = {
	mode: AudioMode;
	musicVolume: number;
	sfxLevel: number;
};

const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
	mode: DEFAULT_AUDIO_MODE,
	musicVolume: 0.25,
	sfxLevel: 1,
};

export function loadAudioSettings(): AudioSettings {
	if (typeof localStorage === 'undefined') {
		return { ...DEFAULT_AUDIO_SETTINGS };
	}
	try {
		const raw = localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY);
		if (!raw) {
			return { ...DEFAULT_AUDIO_SETTINGS };
		}
		const parsed = JSON.parse(raw) as Partial<AudioSettings>;
		const mode =
			parsed.mode === 'full' || parsed.mode === 'sfx' || parsed.mode === 'muted'
				? parsed.mode
				: DEFAULT_AUDIO_SETTINGS.mode;
		const musicVolume =
			typeof parsed.musicVolume === 'number' && isFinite(parsed.musicVolume)
				? clamp(parsed.musicVolume, 0, 1)
				: DEFAULT_AUDIO_SETTINGS.musicVolume;
		const sfxLevel =
			typeof parsed.sfxLevel === 'number' && isFinite(parsed.sfxLevel)
				? clamp(parsed.sfxLevel, 0, 1)
				: DEFAULT_AUDIO_SETTINGS.sfxLevel;
		return { mode, musicVolume, sfxLevel };
	} catch {
		return { ...DEFAULT_AUDIO_SETTINGS };
	}
}

export function saveAudioSettings(settings: AudioSettings): void {
	if (typeof localStorage === 'undefined') {
		return;
	}
	try {
		localStorage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
	} catch {
		// Storage may be unavailable or full.
	}
}

/**
 * The turn-skip heartbeat is an ambient cue that fires on every turn handoff,
 * so it plays well below the requested heartbeat volume. The asset peaks at
 * 0 dBFS, which makes small reductions inaudible, hence the sizeable cut.
 */
const HEARTBEAT_VOLUME_SCALE = 0.25;

let currentAudioMode: AudioMode = DEFAULT_AUDIO_SETTINGS.mode;

/**
 * Platform-level mute (e.g. the CrazyGames player bar). When true the effective
 * output is always muted regardless of the in-game toggle, and the in-game
 * toggle cannot unmute until the platform clears it.
 */
let platformMuted = false;

export function getAudioMode(): AudioMode {
	return platformMuted ? 'muted' : currentAudioMode;
}

export function setPlatformMuted(muted: boolean): void {
	platformMuted = muted;
}

export function isPlatformMuted(): boolean {
	return platformMuted;
}

/**
 * Apply a platform mute change and re-run the current in-game preference through
 * the effective mode (so music/SFX start or stop immediately). `soundSysInstance`
 * may be undefined before a match exists; the flag is still stored and applied by
 * the next `setAudioMode` call (game.ts setup).
 */
export function applyPlatformMute(
	muted: boolean,
	soundSysInstance?: any,
	uiInstance?: { updateAudioIcon: (mode: AudioMode) => void },
): void {
	platformMuted = muted;
	if (!soundSysInstance) {
		return;
	}
	setAudioMode(currentAudioMode, soundSysInstance, uiInstance);

	// When unmuting via platform (e.g., CrazyGames player bar), the user's click
	// on the mute button doesn't propagate to the iframe, so we must explicitly
	// resume the AudioContext if it's suspended.
	if (!muted && soundSysInstance.context?.state === 'suspended') {
		void soundSysInstance.context.resume();
	}
}

export function getCurrentAudioSettings(soundSysInstance?: {
	sfxLevel?: number;
	musicPlayer?: { audio?: { volume: number } };
}): AudioSettings {
	const musicVol =
		soundSysInstance?.musicPlayer?.audio &&
		typeof (soundSysInstance.musicPlayer.audio as any)._preferredVolume === 'number'
			? clamp((soundSysInstance.musicPlayer.audio as any)._preferredVolume, 0, 1)
			: soundSysInstance?.musicPlayer?.audio &&
			  typeof soundSysInstance.musicPlayer.audio.volume === 'number'
			? clamp(soundSysInstance.musicPlayer.audio.volume, 0, 1)
			: DEFAULT_AUDIO_SETTINGS.musicVolume;
	return {
		mode: currentAudioMode,
		musicVolume: musicVol,
		sfxLevel:
			soundSysInstance && typeof soundSysInstance.sfxLevel === 'number'
				? clamp(soundSysInstance.sfxLevel, 0, 1)
				: DEFAULT_AUDIO_SETTINGS.sfxLevel,
	};
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

	/** User-configured SFX/effects level (0..1), persisted across matches. */
	sfxLevel = 1;

	/**
	 * True while a fast replay (`replayMode === 'load'`) is running.
	 *
	 * When set, every effects/heartbeat/announcer gain is forced to zero — the
	 * same outcome as guarding each individual `playSFX`/`playShout` call site,
	 * but centralized: new sounds, sounds started mid-replay, and even a
	 * `setAudioMode()` call from `setup()` cannot un-mute it, because the
	 * volume setters consult this flag instead of blindly applying the
	 * requested level. Music is left alone so a muted match still has its
	 * background track.
	 */
	private _effectsMuted = false;

	constructor(config: SoundSysConfig) {
		this.musicPlayer = new MusicPlayer(
			typeof config.musicVolume === 'number' ? config.musicVolume : 0.25,
		);

		const initialSfxLevel =
			typeof config.effectsVolume === 'number' ? clamp(config.effectsVolume, 0, 1) : 1;
		this._allEffectsCoeff = initialSfxLevel;
		this.sfxLevel = initialSfxLevel;

		const AudioContextCtor = resolveAudioContextCtor();

		if (this.envHasSound && AudioContextCtor) {
			this.context = new AudioContextCtor();
			// WebKit suspends a context that was not created inside a user
			// gesture, so resume it on the first interaction (iOS/Safari,
			// issue #2530) — otherwise every effect stays silent.
			unlockAudioContextOnGesture(this.context);
			this.musicGainNode = this.context.createGain();
			this.musicGainNode.connect(this.context.destination);
			if ('musicVolume' in config) {
				this.musicVolume = config.musicVolume;
			}

			this.effectsGainNode = this.context.createGain();
			this.effectsGainNode.connect(this.context.destination);
			this.effectsVolume = 1;

			this.heartbeatGainNode = this.context.createGain();
			this.heartbeatGainNode.gain.value = HEARTBEAT_VOLUME_SCALE;
			this.heartbeatGainNode.connect(this.context.destination);
			if ('heartbeatVolume' in config) {
				this.heartbeatVolume = config.heartbeatVolume;
			} else {
				this.heartbeatVolume = 1;
			}

			this.announcerGainNode = this.context.createGain();
			this.announcerGainNode.connect(this.context.destination);
			if ('announcerVolume' in config) {
				this.announcerVolume = config.announcerVolume;
			} else {
				this.announcerVolume = 1;
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
			this.effectsGainNode.gain.value =
				this._effectsVol * this._allEffectsCoeff * (this._effectsMuted ? 0 : 1);
		}
	}

	get heartbeatVolume() {
		return this._heartbeatVol;
	}
	set heartbeatVolume(level: number) {
		if (this.envHasSound) {
			this._heartbeatVol = clamp(level, 0, 1);
			this.heartbeatGainNode.gain.value =
				this._heartbeatVol *
				HEARTBEAT_VOLUME_SCALE *
				this._allEffectsCoeff *
				(this._effectsMuted ? 0 : 1);
		}
	}

	get announcerVolume() {
		return this._announcerVol;
	}
	set announcerVolume(level: number) {
		if (this.envHasSound) {
			this._announcerVol = clamp(level, 0, 1);
			this.announcerGainNode.gain.value =
				this._announcerVol * this._allEffectsCoeff * (this._effectsMuted ? 0 : 1);
		}
	}

	set allEffectsMultiplier(level: number) {
		const v = clamp(level, 0, 1);
		this._allEffectsCoeff = v;
		this.sfxLevel = v;
		if (this.envHasSound) {
			// NOTE: Trigger all effects volume setters so that
			// volumes are updated with new _allEffectsCoeff value.
			this.effectsVolume = this._effectsVol;
			this.heartbeatVolume = this._heartbeatVol;
			this.announcerVolume = this._announcerVol;
		}
	}

	/**
	 * Force every effects/heartbeat/announcer gain to zero while a fast replay
	 * is running, without touching the music track.
	 *
	 * The gain is applied through the volume setters (not by zeroing the gain
	 * node directly) so a later `setAudioMode()` call — which setup() makes —
	 * cannot restore it. Music is intentionally left alone: a muted match
	 * still has its background track, and the drum roll on game over is a
	 * stinger that already guards on `getAudioMode() === 'full'`.
	 */
	setEffectsMuted(muted: boolean) {
		this._effectsMuted = muted;
		// Re-apply through the setters so the gain nodes pick up the flag.
		this.effectsVolume = this._effectsVol;
		this.heartbeatVolume = this._heartbeatVol;
		this.announcerVolume = this._announcerVol;
	}

	get effectsMuted(): boolean {
		return this._effectsMuted;
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

function getSfxLevel(
	soundSysInstance: { sfxLevel?: number; _allEffectsCoeff?: number } | null,
): number {
	if (!soundSysInstance) {
		return 1;
	}
	if (typeof soundSysInstance.sfxLevel === 'number') {
		return clamp(soundSysInstance.sfxLevel, 0, 1);
	}
	if (typeof soundSysInstance._allEffectsCoeff === 'number') {
		return clamp(soundSysInstance._allEffectsCoeff, 0, 1);
	}
	return 1;
}

function syncMusicPlayerVolume(soundSysInstance: any, volume: number, effective: boolean): void {
	const audio = soundSysInstance?.musicPlayer?.audio;
	if (audio) {
		const v = clamp(volume, 0, 1);
		if (effective) {
			audio.volume = v;
		} else {
			// Preserve user's preferred volume while output is muted by mode.
			(audio as any)._preferredVolume = v;
			audio.volume = 0;
		}
	}
}

export function setAudioMode(mode: AudioMode, soundSysInstance: any, uiInstance?: any) {
	currentAudioMode = mode;
	// Platform mute (e.g. CrazyGames) takes priority: the effective output is
	// always muted while it is active, whatever the player picks in-game.
	const effectiveMode: AudioMode = platformMuted ? 'muted' : mode;

	const sfxLevel = getSfxLevel(soundSysInstance);
	const audioEl = soundSysInstance?.musicPlayer?.audio;
	const preferredMusic =
		audioEl && typeof (audioEl as any)._preferredVolume === 'number'
			? clamp((audioEl as any)._preferredVolume, 0, 1)
			: audioEl && typeof audioEl.volume === 'number'
			? clamp(audioEl.volume, 0, 1)
			: DEFAULT_AUDIO_SETTINGS.musicVolume;

	// Keep the user-configured SFX level as the base for mode application.
	if (soundSysInstance && typeof soundSysInstance.allEffectsMultiplier !== 'undefined') {
		soundSysInstance.allEffectsMultiplier = sfxLevel;
	}

	if (effectiveMode === 'muted') {
		soundSysInstance.musicVolume = 0;
		soundSysInstance.effectsVolume = 0;
		soundSysInstance.heartbeatVolume = 0;
		soundSysInstance.announcerVolume = 0;
		syncMusicPlayerVolume(soundSysInstance, preferredMusic, false);
		soundSysInstance.stopMusic();
	} else if (effectiveMode === 'sfx') {
		soundSysInstance.musicVolume = 0;
		// Restore base channel volumes; audible level is controlled by allEffectsMultiplier (sfxLevel).
		soundSysInstance.effectsVolume = 1;
		soundSysInstance.heartbeatVolume = 1;
		soundSysInstance.announcerVolume = 1;
		syncMusicPlayerVolume(soundSysInstance, preferredMusic, false);
		soundSysInstance.stopMusic();
	} else if (effectiveMode === 'full') {
		if (audioEl) {
			(audioEl as any)._preferredVolume = preferredMusic;
		}
		soundSysInstance.musicVolume = preferredMusic;
		soundSysInstance.effectsVolume = 1;
		soundSysInstance.heartbeatVolume = 1;
		soundSysInstance.announcerVolume = 1;
		syncMusicPlayerVolume(soundSysInstance, preferredMusic, true);
		soundSysInstance.playMusic();
	}

	saveAudioSettings({ mode, musicVolume: preferredMusic, sfxLevel });

	if (uiInstance) {
		uiInstance.updateAudioIcon(effectiveMode);
	}
}
export function cycleAudioMode(
	soundSysInstance: SoundSys,
	uiInstance?: { updateAudioIcon: (mode: AudioMode) => void },
): AudioMode {
	// Platform mute has priority: keep output muted and don't advance the
	// preference (the player can change it again after the platform unmutes).
	if (platformMuted) {
		if (uiInstance) {
			uiInstance.updateAudioIcon('muted');
		}
		return currentAudioMode;
	}

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
