import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import {
	CURSOR_HIDE_DELAY_MS,
	CURSOR_HIDDEN_CLASS,
	startCursorAutoHide,
	stopCursorAutoHide,
} from '../../game-display/cursor-auto-hide';

describe('bot-only-match cursor auto-hide', () => {
	let teardown: (() => void) | null = null;

	beforeEach(() => {
		jest.useFakeTimers();
		// The auto-hider toggles the body and the game canvas. Give the canvas an
		// anchor in the DOM so `querySelectorAll('body, canvas')` sees it.
		document.body.innerHTML = '<canvas id="game"></canvas>';
		teardown = null;
	});

	afterEach(() => {
		teardown?.();
		teardown = null;
		// Belt-and-suspenders: clear any singleton state a test left behind so the
		// module-level timer/listener never leaks into the next suite.
		stopCursorAutoHide();
		jest.useRealTimers();
	});

	const canvas = () => document.querySelector('canvas') as HTMLElement;

	test('is off immediately after starting', () => {
		teardown = startCursorAutoHide();

		expect(document.body.classList.contains(CURSOR_HIDDEN_CLASS)).toBe(false);
		expect(canvas().classList.contains(CURSOR_HIDDEN_CLASS)).toBe(false);
	});

	test('blanks the cursor on the body and canvas after the delay', () => {
		teardown = startCursorAutoHide();

		jest.advanceTimersByTime(CURSOR_HIDE_DELAY_MS - 1);
		expect(document.body.classList.contains(CURSOR_HIDDEN_CLASS)).toBe(false);
		expect(canvas().classList.contains(CURSOR_HIDDEN_CLASS)).toBe(false);

		jest.advanceTimersByTime(1);
		expect(document.body.classList.contains(CURSOR_HIDDEN_CLASS)).toBe(true);
		expect(canvas().classList.contains(CURSOR_HIDDEN_CLASS)).toBe(true);
	});

	test('restores the cursor on pointer movement and restarts the countdown', () => {
		teardown = startCursorAutoHide();

		jest.advanceTimersByTime(CURSOR_HIDE_DELAY_MS);
		expect(document.body.classList.contains(CURSOR_HIDDEN_CLASS)).toBe(true);

		// A single mouse nudge brings the cursor back.
		window.dispatchEvent(new Event('pointermove', { bubbles: true }));
		expect(document.body.classList.contains(CURSOR_HIDDEN_CLASS)).toBe(false);
		expect(canvas().classList.contains(CURSOR_HIDDEN_CLASS)).toBe(false);

		// …and re-arms the timer, so it takes a full delay of inactivity again.
		jest.advanceTimersByTime(CURSOR_HIDE_DELAY_MS - 1);
		expect(document.body.classList.contains(CURSOR_HIDDEN_CLASS)).toBe(false);

		jest.advanceTimersByTime(1);
		expect(document.body.classList.contains(CURSOR_HIDDEN_CLASS)).toBe(true);
	});

	test('the returned teardown reveals the cursor and stops hiding', () => {
		teardown = startCursorAutoHide();

		jest.advanceTimersByTime(CURSOR_HIDE_DELAY_MS);
		expect(document.body.classList.contains(CURSOR_HIDDEN_CLASS)).toBe(true);

		teardown();
		teardown = null;
		expect(document.body.classList.contains(CURSOR_HIDDEN_CLASS)).toBe(false);
		expect(canvas().classList.contains(CURSOR_HIDDEN_CLASS)).toBe(false);

		// Nothing should hide the cursor again after teardown, even after the delay.
		jest.advanceTimersByTime(CURSOR_HIDE_DELAY_MS);
		expect(document.body.classList.contains(CURSOR_HIDDEN_CLASS)).toBe(false);
	});

	test('stopCursorAutoHide is a safe no-op when never started', () => {
		expect(() => stopCursorAutoHide()).not.toThrow();
		// And a second start/teardown cycles cleanly.
		teardown = startCursorAutoHide();
		stopCursorAutoHide();
		teardown = null;
	});
});
