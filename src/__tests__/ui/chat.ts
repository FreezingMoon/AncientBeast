import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import type Game from '../../game';
import { Chat } from '../../ui/chat';

const VIEWPORT_HEIGHT = 100;
const ROW_HEIGHT = 34;

/** Scroll offset that shows the newest row. */
const bottomOf = (rows: number) => Math.max(0, rows * ROW_HEIGHT - VIEWPORT_HEIGHT);

const fakeGame = () =>
	({
		startMatchTime: new Date(0),
		channels: { ui: { on: jest.fn() } },
	} as unknown as Game);

/**
 * jsdom does no layout, so the log viewport's scroll metrics are installed by
 * hand. `scrollHeight` grows with the rendered rows — the real growth is what
 * makes an appended line sit outside the viewport — and `scrollTop` clamps the
 * way a real box does.
 */
function setUpLog() {
	document.body.innerHTML =
		'<div id="chat"><div id="chatbox"><div id="chatcontent"></div></div></div>';

	const viewport = document.getElementById('chatbox') as HTMLElement;
	const content = document.getElementById('chatcontent') as HTMLElement;
	let scrollTop = 0;
	const rows = () => content.childElementCount;

	Object.defineProperties(viewport, {
		scrollHeight: { get: () => Math.max(VIEWPORT_HEIGHT, rows() * ROW_HEIGHT), configurable: true },
		clientHeight: { get: () => VIEWPORT_HEIGHT, configurable: true },
		scrollTop: {
			get: () => scrollTop,
			set: (value: number) => {
				scrollTop = Math.min(Math.max(value, 0), bottomOf(rows()));
			},
			configurable: true,
		},
	});

	const chat = new Chat(fakeGame());

	/** Render `count` rows, as a match already in progress would have. */
	const fill = (count: number) => {
		for (let i = 0; i < count; i++) {
			chat.addMsg(`line ${i}`, '');
		}
	};

	return {
		chat,
		fill,
		rows,
		atBottom: () => scrollTop === bottomOf(rows()),
		scrollTo(position: number) {
			scrollTop = position;
		},
	};
}

describe('Chat auto-scroll', () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	test('follows new messages while the log rests at the newest line', () => {
		const log = setUpLog();
		log.chat.show();
		log.fill(30);

		expect(log.atBottom()).toBe(true);
	});

	test('keeps following across several messages after expanding', () => {
		const log = setUpLog();
		log.fill(30);
		log.chat.toggle();
		log.scrollTo(bottomOf(log.rows()));

		log.chat.addMsg('newest line', '');
		expect(log.atBottom()).toBe(true);

		log.chat.addMsg('a later line', '');
		expect(log.atBottom()).toBe(true);
	});

	test('holds its position while the player reads back through the log', () => {
		const log = setUpLog();
		log.chat.show();
		log.fill(30);
		log.scrollTo(0);

		log.chat.addMsg('a line the player is not reading', '');

		expect(log.atBottom()).toBe(false);
		expect(document.getElementById('chatbox').scrollTop).toBe(0);
	});

	test('treats a near-bottom scroll as resting at the newest line', () => {
		const log = setUpLog();
		log.chat.show();
		log.fill(30);
		log.scrollTo(bottomOf(log.rows()) - 2);

		log.chat.addMsg('newest line', '');

		expect(log.atBottom()).toBe(true);
	});

	test('pins to the newest line while the log is minimized', () => {
		const log = setUpLog();
		log.chat.show();
		log.fill(30);
		log.scrollTo(0);
		log.chat.hide();

		log.chat.addMsg('a line nobody is reading', '');

		expect(log.atBottom()).toBe(true);
	});

	test('snaps to the newest line when the player expands a scrolled-back log', () => {
		const log = setUpLog();
		log.chat.hide();
		log.fill(30);
		log.scrollTo(0);

		log.chat.toggle();

		expect(log.atBottom()).toBe(true);
	});
});
