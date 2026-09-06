import { beforeAll, describe, expect, jest, test } from '@jest/globals';
import type { Creature } from '../../creature';
import type { CreatureQueue } from '../../creature_queue';
import { Queue } from '../../ui/queue';

jest.mock('../../style/avatar-styles', () => ({
	getAvatarSet: () => 'default',
}));

beforeAll(() => {
	Element.prototype.animate = jest.fn().mockReturnValue({
		commitStyles: jest.fn(),
		onfinish: null,
	}) as unknown as typeof Element.prototype.animate;
});

const creature = ({ id, delayed = false, initiative = 10 }) =>
	({
		id,
		type: 0,
		team: 0,
		temp: false,
		dead: false,
		isDelayed: delayed,
		isDelayedInNextQueue: false,
		fatigueText: '',
		player: { controller: 'human' },
		getInitiative: () => initiative,
	} as unknown as Creature);

describe('Queue', () => {
	test('empties the HTML element argument', () => {
		const div = document.createElement('div');
		div.innerHTML = '<a>Hello</a>';
		expect(div.innerHTML).toBe('<a>Hello</a>');

		const queue = new Queue(div);
		expect(queue).toBeDefined();
		expect(div.innerHTML).toBe('');
	});

	test('shows an insertion marker where delay would place the active unit', () => {
		const div = document.createElement('div');
		const queue = new Queue(div);

		queue.setQueue(
			{
				queue: [
					creature({ id: 1, initiative: 30 }),
					creature({ id: 2, initiative: 20 }),
					creature({ id: 3, delayed: true, initiative: 10 }),
				],
				nextQueue: [],
			} as unknown as CreatureQueue,
			1,
		);

		queue.showDelayPreview();

		const preview = div.querySelector('.delay-preview-marker') as HTMLElement;
		expect(preview).not.toBeNull();
		expect(preview.getAttribute('aria-hidden')).toBe('true');
		expect(preview.classList.contains('vignette')).toBe(false);
		expect(preview.style.transform).toContain('translateX(260px)');

		queue.clearDelayPreview();

		expect(div.querySelector('.delay-preview')).toBeNull();
	});

	test('shows the delay insertion marker before the visible round marker when no unit is delayed', () => {
		const div = document.createElement('div');
		const queue = new Queue(div);

		queue.setQueue(
			{
				queue: [creature({ id: 1 }), creature({ id: 2 })],
				nextQueue: [],
			} as unknown as CreatureQueue,
			1,
		);

		queue.showDelayPreview();

		const preview = div.querySelector('.delay-preview-marker') as HTMLElement;
		expect(preview).not.toBeNull();
		expect(preview.style.transform).toContain('translateX(180px)');
	});

	test('clears stale delay preview whenever the queue is re-rendered', () => {
		const div = document.createElement('div');
		const queue = new Queue(div);

		queue.setQueue(
			{
				queue: [creature({ id: 1 }), creature({ id: 2 })],
				nextQueue: [],
			} as unknown as CreatureQueue,
			1,
		);
		queue.showDelayPreview();

		expect(div.querySelector('.delay-preview')).not.toBeNull();

		queue.setQueue(
			{
				queue: [creature({ id: 2 })],
				nextQueue: [],
			} as unknown as CreatureQueue,
			1,
		);

		expect(div.querySelector('.delay-preview')).toBeNull();
	});

	test('leaps into its new slot when a unit is delayed', () => {
		const div = document.createElement('div');
		const queue = new Queue(div);
		const animate = Element.prototype.animate as unknown as jest.Mock;

		queue.setQueue(
			{
				queue: [creature({ id: 1 }), creature({ id: 2 }), creature({ id: 3 })],
				nextQueue: [],
			} as unknown as CreatureQueue,
			1,
		);

		animate.mockClear();

		queue.setQueue(
			{
				queue: [creature({ id: 1, delayed: true }), creature({ id: 2 }), creature({ id: 3 })],
				nextQueue: [],
			} as unknown as CreatureQueue,
			1,
		);

		// The leap is the only animation with a raised midpoint at offset 0.5.
		const leaps = animate.mock.calls
			.map((call) => call[0] as Keyframe[])
			.filter((frames) =>
				frames.some(
					(frame) =>
						frame.offset === 0.5 && /translateY\(-\d+px\)/.test(String(frame.transform)),
				),
			);

		expect(leaps).toHaveLength(1);
	});

	test('slides without leaping when the queue merely shuffles forward', () => {
		const div = document.createElement('div');
		const queue = new Queue(div);
		const animate = Element.prototype.animate as unknown as jest.Mock;

		queue.setQueue(
			{
				queue: [creature({ id: 1 }), creature({ id: 2 }), creature({ id: 3 })],
				nextQueue: [],
			} as unknown as CreatureQueue,
			1,
		);

		animate.mockClear();

		queue.setQueue(
			{
				queue: [creature({ id: 2 }), creature({ id: 3 })],
				nextQueue: [],
			} as unknown as CreatureQueue,
			1,
		);

		const leaps = animate.mock.calls
			.map((call) => call[0] as Keyframe[])
			.filter((frames) => frames.some((frame) => frame.offset === 0.5));

		expect(leaps).toHaveLength(0);
	});
});
