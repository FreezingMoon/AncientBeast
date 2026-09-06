/**
 * WebKit - every browser on iOS, plus desktop Safari - hands back an
 * AudioContext in the "suspended" state unless it was constructed inside a user
 * gesture, and it only leaves that state when something calls resume() from
 * inside one. SoundSys builds its context while the page is still loading, so
 * without an explicit unlock every effect stays silent for the whole session on
 * those browsers.
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

/** The interactions WebKit accepts as a gesture for unlocking audio. */
export const GESTURE_EVENTS = ['pointerdown', 'touchend', 'keydown'];

/**
 * Resolves the AudioContext constructor from a window object.
 *
 * Reading it as a property matters. Safari builds that only ship
 * `webkitAudioContext` have no global binding named `AudioContext` at all, so an
 * unqualified reference throws a ReferenceError instead of evaluating to
 * undefined and falling through to the prefixed constructor.
 */
export function resolveAudioContextCtor(win?: AudioContextWindow): AudioContextCtor | null {
	const target = win ?? (typeof window === 'undefined' ? undefined : window);

	if (!target) {
		return null;
	}

	return target.AudioContext ?? target.webkitAudioContext ?? null;
}

/**
 * Resumes a suspended AudioContext on the first user gesture, then stops
 * listening. If the resume is still refused the listeners stay armed for the
 * next gesture. Returns a function that cancels the pending unlock.
 */
export function unlockAudioContextOnGesture(
	context: ResumableContext,
	target?: GestureTarget,
): () => void {
	const listenTarget = target ?? (typeof document === 'undefined' ? undefined : document);

	if (!listenTarget || context.state === 'running') {
		return () => undefined;
	}

	function stop() {
		GESTURE_EVENTS.forEach((event) => listenTarget.removeEventListener(event, unlock));
	}

	function unlock() {
		Promise.resolve(context.resume()).then(stop, () => {
			// Still refused - leave the listeners armed for the next gesture.
		});
	}

	GESTURE_EVENTS.forEach((event) => listenTarget.addEventListener(event, unlock));

	return stop;
}
