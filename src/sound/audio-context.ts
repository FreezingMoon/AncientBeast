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
 */

type AudioContextCtor = typeof AudioContext;

type AudioContextWindow = {
	AudioContext?: AudioContextCtor;
	webkitAudioContext?: AudioContextCtor;
};

type ResumableContext = Pick<AudioContext, 'state' | 'resume'>;

interface GestureTarget {
	addEventListener(type: string, listener: () => void, options?: boolean | object): void;
	removeEventListener(type: string, listener: () => void, options?: boolean | object): void;
}

/** The interactions WebKit accepts as a user gesture for unlocking audio. */
export const GESTURE_EVENTS = ['pointerdown', 'touchend', 'keydown'];

/** Additional events that work inside iframes (focus, visibility change). */
export const IFRAME_GESTURE_EVENTS = ['focus', 'visibilitychange'];

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
 *
 * In iframe contexts (e.g., CrazyGames), also listens for focus/visibility
 * events on the window and attempts to attach to the parent window when
 * same-origin accessible.
 */
export function unlockAudioContextOnGesture(
	context: ResumableContext,
	target?: GestureTarget,
): () => void {
	const doc = typeof document === 'undefined' ? undefined : (document as GestureTarget);
	const win = typeof window === 'undefined' ? undefined : (window as GestureTarget);

	const listenTargets: GestureTarget[] = [];

	// Primary target: explicit target or document
	if (target) {
		listenTargets.push(target);
	} else if (doc) {
		listenTargets.push(doc);
	}

	// Also listen on window for focus events (works in iframes)
	if (win) {
		listenTargets.push(win);
	}

	// Try to also listen on parent window if same-origin (for cross-origin iframes this will throw)
	// We test by adding a temporary listener to verify we have access.
	try {
		if (win && win !== window.parent) {
			const parentWin = window.parent as GestureTarget;
			if (parentWin) {
				// Test if we can actually add event listeners (cross-origin will throw here)
				const testListener = () => {
					// empty
				};
				parentWin.addEventListener('pointerdown', testListener);
				parentWin.removeEventListener('pointerdown', testListener);
				listenTargets.push(parentWin);
			}
		}
	} catch {
		// Cross-origin, ignore
	}

	if (listenTargets.length === 0 || context.state === 'running') {
		return () => undefined;
	}

	function stop() {
		listenTargets.forEach((t) => {
			GESTURE_EVENTS.forEach((event) => t.removeEventListener(event, unlock));
			IFRAME_GESTURE_EVENTS.forEach((event) => t.removeEventListener(event, unlock));
		});
	}

	function unlock() {
		Promise.resolve(context.resume()).then(stop, () => {
			// Still refused — leave the listeners armed for the next gesture.
		});
	}

	listenTargets.forEach((t) => {
		GESTURE_EVENTS.forEach((event) => t.addEventListener(event, unlock));
		IFRAME_GESTURE_EVENTS.forEach((event) => t.addEventListener(event, unlock));
	});

	return stop;
}

/**
 * One-shot retry helper for `<audio>`-based playback refused by the autoplay
 * policy. Arms listeners for the next user gesture; resolves true when the
 * play attempt eventually succeeds. The caller owns cancelling via the
 * returned function (used when the track changes or music stops).
 *
 * In iframe contexts (e.g., CrazyGames), also listens for focus/visibility
 * events on the window and attempts to attach to the parent window when
 * same-origin accessible.
 */
export function playAudioOnNextGesture(
	play: () => Promise<void>,
	target?: GestureTarget,
): () => void {
	const doc = typeof document === 'undefined' ? undefined : (document as GestureTarget);
	const win = typeof window === 'undefined' ? undefined : (window as GestureTarget);

	const listenTargets: GestureTarget[] = [];

	// Primary target: explicit target or document
	if (target) {
		listenTargets.push(target);
	} else if (doc) {
		listenTargets.push(doc);
	}

	// Also listen on window for focus events (works in iframes)
	if (win) {
		listenTargets.push(win);
	}

	// Try to also listen on parent window if same-origin
	// We test by adding a temporary listener to verify we have access.
	try {
		if (win && win !== window.parent) {
			const parentWin = window.parent as GestureTarget;
			if (parentWin) {
				// Test if we can actually add event listeners (cross-origin will throw here)
				const testListener = () => {
					// empty
				};
				parentWin.addEventListener('pointerdown', testListener);
				parentWin.removeEventListener('pointerdown', testListener);
				listenTargets.push(parentWin);
			}
		}
	} catch {
		// Cross-origin, ignore
	}

	if (listenTargets.length === 0) {
		return () => undefined;
	}

	function stop() {
		listenTargets.forEach((t) => {
			GESTURE_EVENTS.forEach((event) => t.removeEventListener(event, retry));
			IFRAME_GESTURE_EVENTS.forEach((event) => t.removeEventListener(event, retry));
		});
	}

	function retry() {
		play().then(stop, () => {
			// Still refused — stay armed for the next gesture.
		});
	}

	listenTargets.forEach((t) => {
		GESTURE_EVENTS.forEach((event) => t.addEventListener(event, retry));
		IFRAME_GESTURE_EVENTS.forEach((event) => t.addEventListener(event, retry));
	});

	return stop;
}
