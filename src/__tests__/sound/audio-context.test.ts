import { expect, describe, test, jest } from '@jest/globals';
import {
	GESTURE_EVENTS,
	resolveAudioContextCtor,
	unlockAudioContextOnGesture,
} from '../../sound/audio-context';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function makeTarget() {
	const listeners = new Map<string, Set<() => void>>();

	return {
		addEventListener(type: string, listener: () => void) {
			if (!listeners.has(type)) {
				listeners.set(type, new Set());
			}

			listeners.get(type).add(listener);
		},
		removeEventListener(type: string, listener: () => void) {
			listeners.get(type)?.delete(listener);
		},
		fire(type: string) {
			[...(listeners.get(type) ?? [])].forEach((listener) => listener());
		},
		count() {
			return [...listeners.values()].reduce((total, set) => total + set.size, 0);
		},
	};
}

describe('resolveAudioContextCtor', () => {
	test('prefers the unprefixed constructor', () => {
		const AudioContextCtor = function () {} as unknown as typeof AudioContext;
		const webkitAudioContext = function () {} as unknown as typeof AudioContext;

		expect(resolveAudioContextCtor({ AudioContext: AudioContextCtor, webkitAudioContext })).toBe(
			AudioContextCtor,
		);
	});

	test('falls back to the webkit constructor without touching a missing global', () => {
		// Safari builds that only ship webkitAudioContext have no AudioContext
		// binding at all, so this must resolve by property lookup and not throw.
		const webkitAudioContext = function () {} as unknown as typeof AudioContext;

		expect(resolveAudioContextCtor({ webkitAudioContext })).toBe(webkitAudioContext);
	});

	test('returns null when neither constructor exists', () => {
		expect(resolveAudioContextCtor({})).toBeNull();
	});
});

describe('unlockAudioContextOnGesture', () => {
	test('does not listen when the context is already running', () => {
		const target = makeTarget();
		const resume = jest.fn(() => Promise.resolve());

		unlockAudioContextOnGesture({ state: 'running', resume }, target);

		expect(target.count()).toBe(0);
		expect(resume).not.toHaveBeenCalled();
	});

	test('resumes on the first gesture and then stops listening', async () => {
		const target = makeTarget();
		const resume = jest.fn(() => Promise.resolve());

		unlockAudioContextOnGesture({ state: 'suspended', resume }, target);
		expect(target.count()).toBe(GESTURE_EVENTS.length);

		target.fire('pointerdown');
		expect(resume).toHaveBeenCalledTimes(1);

		await flush();
		expect(target.count()).toBe(0);
	});

	test('stays armed when the resume is still refused', async () => {
		const target = makeTarget();
		const resume = jest.fn(() => Promise.reject(new Error('blocked')));

		unlockAudioContextOnGesture({ state: 'suspended', resume }, target);

		target.fire('pointerdown');
		await flush();

		expect(target.count()).toBe(GESTURE_EVENTS.length);

		target.fire('keydown');
		expect(resume).toHaveBeenCalledTimes(2);
	});

	test('the returned canceller removes every listener', () => {
		const target = makeTarget();
		const resume = jest.fn(() => Promise.resolve());

		const cancel = unlockAudioContextOnGesture({ state: 'suspended', resume }, target);
		expect(target.count()).toBe(GESTURE_EVENTS.length);

		cancel();
		expect(target.count()).toBe(0);
	});
});
