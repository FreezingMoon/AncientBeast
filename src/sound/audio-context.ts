/**
 * iOS/Safari audio unlock helpers (issue #2530).
 *
 * Every browser on iOS is WebKit under the hood, and WebKit hands back an
 * `AudioContext` in the "suspended" state unless it was constructed inside a
 * user gesture. SoundSys builds its context during page load, so without an
 * explicit unlock every Web Audio effect (SFX, heartbeat, shouts) stays
 * silent for the whole session on those browsers. The `<audio>`-based music
 * player has the same problem one level up: a `play()` rejected with
 * `NotAllowedError` never gets retried.
 *
 * Limitation: all audio assets in the repo are Ogg Vorbis (83 `.ogg` files,
 * zero mp3/m4a/aac/wav), which WebKit cannot decode. This module fixes the
 * code side (context resume, constructor fallback, music retry); the music
 * tracks additionally need a non-Ogg encoding before they will actually
 * sound on iOS. That is an asset change, intentionally out of scope here.
 */

type AudioContextCtor = typeof AudioContext;

type AudioContextWindow = {
	AudioContext?: AudioContextCtor;
	webkitAudioContext?: AudioContextCtor;
};

type ResumableContext = Pick<AudioContext, 'state' | 'resume'>;

type GestureTarget = {
	addEventListener(type: string, listener: () => void): void;
	removeEventListener(type: string, listener: () => void): void;
};

/** The interactions WebKit accepts as a user gesture for unlocking audio. */
export const GESTURE_EVENTS = ['pointerdown', 'touchend', 'keydown'];

/**
 * Resolve the AudioContext constructor from a window-like object.
 *
 * Property lookup matters here: Safari builds that only ship
 * `webkitAudioContext` have no global binding named `AudioContext` at all, so
 * reading it as a bare identifier throws a ReferenceError instead of
 * evaluating to undefined and falling through to the prefixed constructor.
 */
export function resolveAudioContextCtor(win?: AudioContextWindow): AudioContextCtor | null {
	// The DOM Window type does not declare WebKit's prefixed constructor, so
	// keep the browser fallback inside the narrow shape this helper actually
	// consumes — the same property lookup Safari needs at runtime.
	const target: AudioContextWindow | undefined =
		win ?? (typeof window === 'undefined' ? undefined : (window as AudioContextWindow));

	if (!target) {
		return null;
	}

	return target.AudioContext ?? target.webkitAudioContext ?? null;
}

/**
 * Resume a suspended AudioContext on the first user gesture, then stop
 * listening. If the resume is still refused, the listeners stay armed for
 * the next gesture. Returns a function that cancels the pending unlock.
 */
export function unlockAudioContextOnGesture(
	context: ResumableContext,
	target?: GestureTarget,
): () => void {
	const listenTarget =
		target ?? (typeof document === 'undefined' ? undefined : (document as GestureTarget));

	if (!listenTarget || context.state === 'running') {
		return () => undefined;
	}

	function stop() {
		GESTURE_EVENTS.forEach((event) => listenTarget.removeEventListener(event, unlock));
	}

	function unlock() {
		Promise.resolve(context.resume()).then(stop, () => {
			// Still refused — leave the listeners armed for the next gesture.
		});
	}

	GESTURE_EVENTS.forEach((event) => listenTarget.addEventListener(event, unlock));

	return stop;
}

/**
 * One-shot retry helper for `<audio>`-based playback refused by the autoplay
 * policy. Arms listeners for the next user gesture; resolves true when the
 * play attempt eventually succeeds. The caller owns cancelling via the
 * returned function (used when the track changes or music stops).
 */
export function playAudioOnNextGesture(
	play: () => Promise<void>,
	target?: GestureTarget,
): () => void {
	const listenTarget =
		target ?? (typeof document === 'undefined' ? undefined : (document as GestureTarget));

	if (!listenTarget) {
		return () => undefined;
	}

	function stop() {
		GESTURE_EVENTS.forEach((event) => listenTarget.removeEventListener(event, retry));
	}

	function retry() {
		play().then(stop, () => {
			// Still refused — stay armed for the next gesture.
		});
	}

	GESTURE_EVENTS.forEach((event) => listenTarget.addEventListener(event, retry));

	return stop;
}
